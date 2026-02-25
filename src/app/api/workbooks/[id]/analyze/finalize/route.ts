import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs/promises";
import Papa from "papaparse";
import fsStream from "fs";
import db from "@/lib/db";
import { BucketNode } from "@/types";
import { mapBatchToTaxonomy, TaxonomyNode } from "@/lib/ai";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const {
        selectedColumn,
        confirmedBuckets,
        uniqueValues,
        provider
    } = await req.json();

    try {
        const workbook = await db.getOne("SELECT * FROM workbooks WHERE id = ?", [id]);
        if (!workbook) return NextResponse.json({ error: "Workbook not found" }, { status: 404 });

        console.log(`>>> STARTING FINAL BATCHED ANALYSIS FOR: ${selectedColumn}`);

        // 1. Prepare Root Structure from Confirmed Recursive Taxonomy
        const generalBucket: BucketNode = {
            id: uuidv4(),
            name: "General / Unformatted",
            rowCount: 0,
            childrenCount: 0,
            children: [],
            rowIndices: [],
            depth: 0
        };

        const rootBuckets: BucketNode[] = [generalBucket];

        // Recursive helper to build BucketNodes from TaxonomyNodes
        function buildBucketTree(nodes: TaxonomyNode[], depth: number = 0): BucketNode[] {
            return nodes.map(node => ({
                id: uuidv4(),
                name: node.name,
                rowCount: 0,
                childrenCount: node.children ? node.children.length : 0,
                children: node.children ? buildBucketTree(node.children, depth + 1) : [],
                rowIndices: [],
                depth
            }));
        }

        // Add confirmed buckets to root
        const taxonomyBuckets = buildBucketTree(confirmedBuckets as TaxonomyNode[]);
        rootBuckets.push(...taxonomyBuckets);

        const valueMap: Record<string, BucketNode> = {};
        const allUniqueStrings = Object.keys(uniqueValues);
        const BATCH_SIZE = 50;

        // Path Map to find all parents for a target leaf efficiently
        const nodeToPath: Map<string, BucketNode[]> = new Map();

        // Helper for Deep Fuzzy Search
        function findDeepMatch(nodes: BucketNode[], searchValue: string): BucketNode | undefined {
            const lowerSearch = searchValue.toLowerCase();
            for (const node of nodes) {
                if (node.name === "General / Unformatted") continue;
                const lowerNode = node.name.toLowerCase();
                if (lowerSearch.includes(lowerNode) || lowerNode.includes(lowerSearch)) return node;
                if (node.children && node.children.length > 0) {
                    const childMatch = findDeepMatch(node.children, searchValue);
                    if (childMatch) return childMatch;
                }
            }
            return undefined;
        }

        // Helper to find path to a specific node (for bubble-up)
        function findPathToNode(nodes: BucketNode[], targetId: string, currentPath: BucketNode[] = []): BucketNode[] | null {
            for (const node of nodes) {
                if (node.id === targetId) return [...currentPath, node];
                if (node.children && node.children.length > 0) {
                    const p = findPathToNode(node.children, targetId, [...currentPath, node]);
                    if (p) return p;
                }
            }
            return null;
        }

        // 2. Batch Processing with AI
        console.log(`>>> TOTAL UNIQUE VALUES TO PROCESS: ${allUniqueStrings.length}`);

        // Process sequentially to respect rate limits, but with retry
        for (let i = 0; i < allUniqueStrings.length; i += BATCH_SIZE) {
            const batch = allUniqueStrings.slice(i, i + BATCH_SIZE);
            console.log(`>>> PROCESSING BATCH ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(allUniqueStrings.length / BATCH_SIZE)}`);

            let result: any = null;
            let retries = 2;

            while (retries > 0) {
                try {
                    result = await mapBatchToTaxonomy(selectedColumn, batch, confirmedBuckets, provider);
                    if (result && result.mappings) break;
                    throw new Error("Empty mapping result");
                } catch (e) {
                    console.error(`!!! Batch error (Retries left: ${retries - 1}):`, e);
                    retries--;
                    if (retries === 0) break;
                    await new Promise(r => setTimeout(r, 1000)); // Cool down
                }
            }

            if (result?.mappings) {
                result.mappings.forEach((m: any) => {
                    if (!m.path || m.path.length === 0) return;

                    let parentNode: BucketNode | undefined = undefined;
                    let targetNode: BucketNode | undefined;

                    for (let d = 0; d < m.path.length; d++) {
                        const segment = m.path[d];
                        const siblings: BucketNode[] = parentNode ? parentNode.children : rootBuckets;
                        let node: BucketNode | undefined = siblings.find((b: BucketNode) => b.name.toLowerCase() === segment.toLowerCase());

                        if (!node) {
                            node = {
                                id: uuidv4(),
                                name: segment,
                                rowCount: 0,
                                childrenCount: 0,
                                children: [],
                                rowIndices: [],
                                depth: parentNode ? parentNode.depth + 1 : 0
                            };
                            siblings.push(node);
                            if (parentNode) parentNode.childrenCount++;
                        }
                        parentNode = node;
                        targetNode = node;
                    }

                    if (m.value && targetNode) {
                        const foundKey = batch.find(k => k.toLowerCase().trim() === m.value.toLowerCase().trim());
                        if (foundKey) {
                            valueMap[foundKey] = targetNode;
                        } else if (valueMap.hasOwnProperty(m.value)) {
                            valueMap[m.value] = targetNode;
                        }
                        // Pre-calculate path for this node for fast bubble-up later
                        const fullPath = findPathToNode(rootBuckets, targetNode.id);
                        if (fullPath) nodeToPath.set(targetNode.id, fullPath);
                    }
                });
            }
        }

        // 3. Streaming Assignment
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

                        // Fuzzy Fallback
                        if (!target) {
                            target = findDeepMatch(rootBuckets, val);
                        }

                        if (target) {
                            // Bubble Up Implementation: Update target and all its ancestors
                            const path = nodeToPath.get(target.id) || findPathToNode(rootBuckets, target.id);
                            if (path) {
                                path.forEach(node => {
                                    node.rowCount++;
                                });
                                // Leaf also gets the index for preview
                                target.rowIndices.push(rowIndex);
                            } else {
                                target.rowCount++;
                                target.rowIndices.push(rowIndex);
                            }
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

        // Post-calculation: Calculate aggregate counts might be done in frontend.
        // We ensure structure is sound.

        // 4. Finalize
        const analysisId = uuidv4();
        const finalResult = {
            workbookId: id,
            selectedColumn,
            createdAt: new Date().toISOString(),
            rootBuckets,
            stats: { uniqueValues: allUniqueStrings.length, emptyCount: generalBucket.rowCount }
        };

        const analysisDir = path.join(process.cwd(), "data", "analysis");
        await fs.mkdir(analysisDir, { recursive: true });
        await fs.writeFile(path.join(analysisDir, `${analysisId}.json`), JSON.stringify(finalResult));

        await db.query(`INSERT INTO analyses (id, workbookId, selectedColumn, createdAt, stats) VALUES (?, ?, ?, ?, ?)`,
            [analysisId, id, selectedColumn, finalResult.createdAt, JSON.stringify(finalResult.stats)]);

        return NextResponse.json({ analysisId, ...finalResult });

    } catch (error: any) {
        console.error(">>> FINALIZATION ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
