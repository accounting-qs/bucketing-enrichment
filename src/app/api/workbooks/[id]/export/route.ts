import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getBucketRows } from "@/lib/csv";
import db from "@/lib/db";
import Papa from "papaparse";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    
    try {
        const { analysisId, bucketIds } = await req.json();

        if (!analysisId || !bucketIds || !Array.isArray(bucketIds) || bucketIds.length === 0) {
            return NextResponse.json({ error: "Missing or invalid parameters" }, { status: 400 });
        }

        const workbook = await db.getOne("SELECT * FROM workbooks WHERE id = ?", [id]);
        if (!workbook) {
            return NextResponse.json({ error: "Workbook not found" }, { status: 404 });
        }

        const analysisPath = path.join(process.cwd(), "data", "analysis", `${analysisId}.json`);
        const analysisData = JSON.parse(await fs.readFile(analysisPath, "utf-8"));

        const originalColumns = JSON.parse(workbook.columns);
        const exportColumns = [...originalColumns, "Bucket 3 (Root)", "Bucket 2 (Parent)", "Bucket 1 (Leaf)", "AI Confidence", "Is Generic", "Is Disqualified", "AI Reasoning"];

        // Need to traverse tree and map nodes by ID so we can get path info quickly
        const nodeMap = new Map<string, any>();
        
        const buildNodeMap = (nodes: any[], parentNames: string[] = []) => {
            for (const node of nodes) {
                const currentPath = [...parentNames, node.name];

                nodeMap.set(node.id, {
                    ...node,
                    path: currentPath
                });
                
                if (node.children && node.children.length > 0) {
                    buildNodeMap(node.children, currentPath);
                }
            }
        };

        buildNodeMap(analysisData.rootBuckets);

        // Fetch all selected rows from all selected nodes and all their children
        const allIndicesToFetch = new Set<number>();
        const rowToBucketMapping = new Map<number, string[]>();

        const collectIndicesRecursively = (nodeId: string) => {
            const nodeInfo = nodeMap.get(nodeId);
            if (!nodeInfo) return;

            // Map the rows for this specific node
            nodeInfo.rowIndices.forEach((rowIndex: number) => {
                allIndicesToFetch.add(rowIndex);
                // In case of overlaps, keep the most specific one. 
                rowToBucketMapping.set(rowIndex, nodeInfo.path);
            });

            // Recurse to children if they exist
            if (nodeInfo.children) {
                nodeInfo.children.forEach((child: any) => collectIndicesRecursively(child.id));
            }
        };

        // For every requested ID, go down its tree and collect row indices
        for (const bucketId of bucketIds) {
            collectIndicesRecursively(bucketId);
        }

        const indicesArray = Array.from(allIndicesToFetch);

        if (indicesArray.length === 0) {
            return NextResponse.json({ error: "No records found in selected buckets" }, { status: 404 });
        }

        // Fetch rows and inject their row indices so we know who is who. Limit extremely large to get everything.
        const rows = await getBucketRows(workbook.storagePath, indicesArray, 10_000_000, true);

        // Enhance the CSV rows with full Hierarchical Buckets and Metadata
        const metadataMap = analysisData.valueMetadata || {};
        const selectedColumn = analysisData.selectedColumn;

        const processedRows = rows.map((row) => {
            const rowIndex = row.__rowIndex;
            delete row.__rowIndex; // Clean it up before exporting
            
            const mappingPath = rowToBucketMapping.get(rowIndex) || ["Uncategorized"];
            
            // Extract original string from column
            const cellValue = row[selectedColumn] ? String(row[selectedColumn]).toLowerCase().trim() : "";
            const meta = metadataMap[cellValue] || {};
            
            return {
                ...row,
                "Bucket 3 (Root)": mappingPath[0] || "",
                "Bucket 2 (Parent)": mappingPath[1] || "",
                "Bucket 1 (Leaf)": mappingPath[2] || "",
                "AI Confidence": meta.confidence !== undefined ? meta.confidence : "",
                "Is Generic": meta.is_generic || false,
                "Is Disqualified": meta.is_disqualified || false,
                "AI Reasoning": meta.reason || ""
            };
        });

        const csvString = Papa.unparse({
            fields: exportColumns,
            data: processedRows
        });

        const filename = `${workbook.filename.replace(/\.csv$/i, "")}_exported.csv`;

        return new NextResponse(csvString, {
            status: 200,
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="${filename}"`
            }
        });

    } catch (error: any) {
        console.error("Export error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
