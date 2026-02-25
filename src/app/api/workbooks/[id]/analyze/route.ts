import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs/promises";
import Papa from "papaparse";
import fsStream from "fs";
import { getUniqueValues } from "@/lib/csv";
import { proposeTaxonomy, mapBatchToTaxonomy } from "@/lib/ai";
import db from "@/lib/db";
import { BucketNode } from "@/types";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const { selectedColumn, provider = "none", guide = null } = await req.json();

    try {
        const workbook = await db.getOne("SELECT * FROM workbooks WHERE id = ?", [id]);
        if (!workbook) {
            return NextResponse.json({ error: "Workbook not found" }, { status: 404 });
        }

        console.log(`>>> STARTING ANALYSIS PROPOSAL FOR: ${selectedColumn}`);
        const { uniqueValues, totalRows, emptyCount } = await getUniqueValues(workbook.storagePath, selectedColumn);

        if (provider === "none") {
            // Simplified return for non-AI mode
            return finalizeDeterministic(id, selectedColumn, uniqueValues, workbook);
        }

        const sampleValues = Object.entries(uniqueValues)
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => b.count - a.count);

        // Phase 1: Propose Taxonomy
        const proposedBuckets = await proposeTaxonomy(selectedColumn, sampleValues, provider as any, guide);

        return NextResponse.json({
            needsTaxonomyConfirmation: true,
            proposedBuckets,
            stats: { uniqueValues: Object.keys(uniqueValues).length, totalRows, emptyCount },
            originalAnalysis: {
                workbookId: id,
                selectedColumn,
                provider,
                uniqueValues
            }
        });

    } catch (error: any) {
        console.error("Analysis error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function finalizeDeterministic(
    workbookId: string,
    selectedColumn: string,
    uniqueValues: Record<string, number>,
    workbook: any
) {
    const generalBucket: BucketNode = {
        id: uuidv4(),
        name: "General / Unformatted",
        rowCount: 0,
        childrenCount: 0,
        children: [],
        rowIndices: [],
        depth: 0
    };

    const sortedValues = Object.entries(uniqueValues)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100);

    const rootBuckets: BucketNode[] = [generalBucket, ...sortedValues.map(([val]) => ({
        id: uuidv4(),
        name: val,
        rowCount: 0,
        childrenCount: 0,
        children: [],
        rowIndices: [],
        depth: 0
    }))];

    const valueMap: Record<string, BucketNode> = {};
    rootBuckets.forEach(b => {
        if (b.name !== "General / Unformatted") valueMap[b.name] = b;
    });

    // Stream through CSV
    const fileStream = fsStream.createReadStream(workbook.storagePath);
    let rowIndex = 0;

    await new Promise((resolve, reject) => {
        Papa.parse(fileStream, {
            header: true,
            skipEmptyLines: true,
            step: (results: any) => {
                const val = results.data[selectedColumn]?.toString().trim();
                let target = val ? valueMap[val] : generalBucket;
                if (!target) target = generalBucket;
                target.rowIndices.push(rowIndex);
                target.rowCount++;
                rowIndex++;
            },
            complete: resolve,
            error: reject
        });
    });

    const analysisId = uuidv4();
    const result = {
        workbookId,
        selectedColumn,
        createdAt: new Date().toISOString(),
        rootBuckets,
        stats: { uniqueValues: Object.keys(uniqueValues).length, emptyCount: generalBucket.rowCount }
    };

    const analysisDir = path.join(process.cwd(), "data", "analysis");
    await fs.mkdir(analysisDir, { recursive: true });
    await fs.writeFile(path.join(analysisDir, `${analysisId}.json`), JSON.stringify(result));

    await db.query(`INSERT INTO analyses (id, workbookId, selectedColumn, createdAt, stats) VALUES (?, ?, ?, ?, ?)`,
        [analysisId, workbookId, selectedColumn, result.createdAt, JSON.stringify(result.stats)]);

    return NextResponse.json({ analysisId, ...result });
}
