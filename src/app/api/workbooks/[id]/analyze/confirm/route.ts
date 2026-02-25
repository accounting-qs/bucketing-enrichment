import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs/promises";
import Papa from "papaparse";
import fsStream from "fs";
import db from "@/lib/db";
import { BucketNode } from "@/types";

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const { id } = await params;
    const {
        selectedColumn,
        mappedBuckets,
        confirmedSuggestedBuckets,
        denyAllSuggestions
    } = await req.json();

    try {
        const workbook = await db.getOne("SELECT * FROM workbooks WHERE id = ?", [id]);
        if (!workbook) return NextResponse.json({ error: "Workbook not found" }, { status: 404 });

        const rootBuckets: BucketNode[] = [];
        const valueMap: Record<string, BucketNode> = {};

        // 1. Setup General Bucket
        const generalBucket: BucketNode = {
            id: uuidv4(),
            name: "General / Unformatted",
            rowCount: 0,
            childrenCount: 0,
            children: [],
            rowIndices: [],
            depth: 0
        };
        rootBuckets.push(generalBucket);

        // 2. Setup Mapped Buckets (from taxonomy)
        if (mappedBuckets) {
            mappedBuckets.forEach((b: any) => {
                const node: BucketNode = {
                    id: uuidv4(),
                    name: b.name,
                    rowCount: 0,
                    childrenCount: 0,
                    children: [],
                    rowIndices: [],
                    depth: 0
                };
                rootBuckets.push(node);
                b.match.forEach((val: string) => {
                    valueMap[val] = node;
                });
            });
        }

        // 3. Setup Confirmed Suggestions
        if (!denyAllSuggestions && confirmedSuggestedBuckets) {
            confirmedSuggestedBuckets.forEach((b: any) => {
                const node: BucketNode = {
                    id: uuidv4(),
                    name: b.name,
                    rowCount: 0,
                    childrenCount: 0,
                    children: [],
                    rowIndices: [],
                    depth: b.type === "sub" ? 1 : 0
                };

                if (b.type === "sub" && b.parentSuggested) {
                    let parent = rootBuckets.find(r => r.name === b.parentSuggested);
                    if (parent) {
                        parent.children.push(node);
                        parent.childrenCount++;
                    } else {
                        rootBuckets.push(node);
                    }
                } else {
                    rootBuckets.push(node);
                }

                b.match.forEach((val: string) => {
                    valueMap[val] = node;
                });
            });
        }

        // 4. Streaming final assignment
        const fileStream = fsStream.createReadStream(workbook.storagePath);
        let rowIndex = 0;

        await new Promise((resolve, reject) => {
            Papa.parse(fileStream, {
                header: true,
                skipEmptyLines: true,
                step: (results: any) => {
                    const val = results.data[selectedColumn]?.toString().trim();
                    if (!val) {
                        generalBucket.rowIndices.push(rowIndex);
                        generalBucket.rowCount++;
                    } else {
                        let target: BucketNode | undefined = valueMap[val];

                        // Fallback: If AI didn't map it, try keyword matching against bucket names
                        if (!target && rootBuckets.length > 1) {
                            const lowerVal = val.toLowerCase();
                            target = rootBuckets.find(b =>
                                b.name !== "General / Unformatted" &&
                                (lowerVal.includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(lowerVal))
                            );
                        }

                        if (target) {
                            target.rowIndices.push(rowIndex);
                            target.rowCount++;
                        } else {
                            generalBucket.rowIndices.push(rowIndex);
                            generalBucket.rowCount++;
                        }
                    }
                    rowIndex++;
                },
                complete: resolve,
                error: reject
            });
        });

        // 5. Finalize Statistics
        const analysisId = uuidv4();
        const result = {
            workbookId: id,
            selectedColumn,
            createdAt: new Date().toISOString(),
            rootBuckets,
            stats: {
                uniqueValues: Object.keys(valueMap).length,
                emptyCount: generalBucket.rowCount
            }
        };

        const analysisDir = path.join(process.cwd(), "data", "analysis");
        await fs.mkdir(analysisDir, { recursive: true });
        await fs.writeFile(path.join(analysisDir, `${analysisId}.json`), JSON.stringify(result));

        await db.query(`INSERT INTO analyses (id, workbookId, selectedColumn, createdAt, stats) VALUES (?, ?, ?, ?, ?)`,
            [analysisId, id, selectedColumn, result.createdAt, JSON.stringify(result.stats)]);

        return NextResponse.json({ analysisId, ...result });

    } catch (error: any) {
        console.error(">>> CONFIRMED ANALYSIS ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
