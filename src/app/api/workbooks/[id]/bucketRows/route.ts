import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getBucketRows } from "@/lib/csv";
import db from "@/lib/db";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const analysisId = searchParams.get("analysisId");
    const bucketId = searchParams.get("bucketId");

    if (!analysisId || !bucketId) {
        return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    try {
        const workbook = await db.getOne("SELECT * FROM workbooks WHERE id = ?", [id]);
        if (!workbook) {
            return NextResponse.json({ error: "Workbook not found" }, { status: 404 });
        }

        const analysisPath = path.join(process.cwd(), "data", "analysis", `${analysisId}.json`);
        const analysisData = JSON.parse(await fs.readFile(analysisPath, "utf-8"));

        // Find bucket in tree
        let targetBucket: any = null;
        const findBucket = (nodes: any[]) => {
            for (const node of nodes) {
                if (node.id === bucketId) {
                    targetBucket = node;
                    return;
                }
                if (node.children) findBucket(node.children);
            }
        };
        findBucket(analysisData.rootBuckets);

        if (!targetBucket) {
            return NextResponse.json({ error: "Bucket not found" }, { status: 404 });
        }

        // Collect all indices from this bucket and all sub-buckets
        const allIndices: number[] = [];
        const collectIndices = (node: any) => {
            allIndices.push(...node.rowIndices);
            if (node.children) {
                node.children.forEach(collectIndices);
            }
        };
        collectIndices(targetBucket);

        const rows = await getBucketRows(workbook.storagePath, allIndices);

        return NextResponse.json({
            bucketName: targetBucket.name,
            rowCount: targetBucket.rowCount,
            rows,
            columns: JSON.parse(workbook.columns)
        });
    } catch (error: any) {
        console.error("Bucket rows error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
