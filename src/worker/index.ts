import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import db from '../lib/db';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import Papa from 'papaparse';
import fsStream from 'fs';
import { BucketNode } from '../types';
import { mapBatchToTaxonomy, TaxonomyNode } from '../lib/ai';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PORT = process.env.PORT || 10000;

// Render Free tier expects a web service to listen on a port
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Worker is alive');
}).listen(PORT, () => {
    console.log(`>>> Worker health-check server listening on port ${PORT}`);
});

console.log(`>>> WORKER PROCESS INITIALIZED [PID: ${process.pid}]`);
console.log('>>> WORKER CONNECTING TO REDIS:', REDIS_URL.split('@').pop());

const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
});

connection.on('connect', () => console.log('>>> REDIS CONNECTED'));
connection.on('error', (err) => console.error('>>> REDIS ERROR:', err));

console.log('>>> Background Worker Starting...');

// --- Helper Functions ---

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

// --- Worker Logic ---

const worker = new Worker('workbook-analysis', async (job: Job) => {
    const { jobId, workbookId, options } = job.data;
    const { selectedColumn, confirmedBuckets, uniqueValues, provider } = options;

    try {
        console.log(`>>> Starting Job [${jobId}] for Workbook [${workbookId}]`);

        // 1. Initial Status
        await db.query(`UPDATE jobs SET status = ?, message = ?, progress = 5, updatedAt = ? WHERE id = ?`,
            ['processing', 'Initializing worker...', new Date().toISOString(), jobId]);

        const workbook = await db.getOne("SELECT * FROM workbooks WHERE id = ?", [workbookId]);
        if (!workbook) throw new Error("Workbook not found");

        // 2. Prepare Structure
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
        const taxonomyBuckets = buildBucketTree(confirmedBuckets as TaxonomyNode[]);
        rootBuckets.push(...taxonomyBuckets);

        const valueMap: Record<string, BucketNode> = {};
        const allUniqueStrings = Object.keys(uniqueValues);
        const BATCH_SIZE = 50;
        const nodeToPath: Map<string, BucketNode[]> = new Map();

        // 3. AI Mapping Phase
        await db.query(`UPDATE jobs SET message = ?, progress = 10, updatedAt = ? WHERE id = ?`,
            ['AI Mapping unique values...', new Date().toISOString(), jobId]);

        for (let i = 0; i < allUniqueStrings.length; i += BATCH_SIZE) {
            const batch = allUniqueStrings.slice(i, i + BATCH_SIZE);
            const batchProgress = 10 + Math.floor((i / allUniqueStrings.length) * 40); // 10% to 50%

            await db.query(`UPDATE jobs SET progress = ?, updatedAt = ? WHERE id = ?`, [batchProgress, new Date().toISOString(), jobId]);
            console.log(`>>> Job [${jobId}] Mapping Batch ${i / BATCH_SIZE + 1}...`);

            let result: any = null;
            let retries = 3;

            while (retries > 0) {
                try {
                    result = await mapBatchToTaxonomy(selectedColumn, batch, confirmedBuckets, provider);
                    if (result && result.mappings) break;
                    throw new Error("Empty mapping result");
                } catch (e: any) {
                    console.error(`!!! Batch error [${jobId}]:`, e.message);
                    retries--;
                    if (retries === 0) break;
                    await new Promise(r => setTimeout(r, 2000));
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
                        const fullPath = findPathToNode(rootBuckets, targetNode.id);
                        if (fullPath) nodeToPath.set(targetNode.id, fullPath);
                    }
                });
            }
        }

        // 4. Streaming Full CSV Assignment Phase
        await db.query(`UPDATE jobs SET message = ?, progress = 55, updatedAt = ? WHERE id = ?`,
            ['Reading large CSV file...', new Date().toISOString(), jobId]);

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

                        if (!target) {
                            target = findDeepMatch(rootBuckets, val);
                        }

                        if (target) {
                            const path = nodeToPath.get(target.id) || findPathToNode(rootBuckets, target.id);
                            if (path) {
                                path.forEach(node => {
                                    node.rowCount++;
                                });
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

                    // Progress every 5000 rows
                    if (rowIndex % 5000 === 0) {
                        const csvProgress = 60 + Math.min(35, Math.floor((rowIndex / workbook.rowCount) * 35));
                        db.query(`UPDATE jobs SET progress = ?, updatedAt = ? WHERE id = ?`, [csvProgress, new Date().toISOString(), jobId]).catch(() => { });
                    }
                },
                complete: resolve,
                error: reject
            });
        });

        // 5. Finalize and Save JSON Result
        const analysisId = uuidv4();
        const finalResult = {
            workbookId,
            selectedColumn,
            createdAt: new Date().toISOString(),
            rootBuckets,
            stats: {
                uniqueValues: allUniqueStrings.length,
                emptyCount: generalBucket.rowCount,
                totalProcessed: rowIndex
            }
        };

        const analysisDir = path.join(process.cwd(), "data", "analysis");
        await fs.mkdir(analysisDir, { recursive: true });
        await fs.writeFile(path.join(analysisDir, `${analysisId}.json`), JSON.stringify(finalResult));

        await db.query(`INSERT INTO analyses (id, workbookId, selectedColumn, createdAt, stats) VALUES (?, ?, ?, ?, ?)`,
            [analysisId, workbookId, selectedColumn, finalResult.createdAt, JSON.stringify(finalResult.stats)]);

        await db.query(`UPDATE jobs SET status = ?, message = ?, progress = 100, resultId = ?, updatedAt = ? WHERE id = ?`,
            ['completed', 'Analysis complete!', analysisId, new Date().toISOString(), jobId]);

        console.log(`>>> Job [${jobId}] DONE. Analysis ID: ${analysisId}`);
        return { success: true, analysisId };

    } catch (error: any) {
        console.error(`!!! Job [${jobId}] Failed:`, error.message);
        await db.query(`UPDATE jobs SET status = ?, message = ?, updatedAt = ? WHERE id = ?`,
            ['failed', error.message, new Date().toISOString(), jobId]);
        throw error;
    }
}, { connection });

worker.on('failed', (job, err) => {
    console.error(`>>> Worker Job ${job?.id} failed with ${err.message}`);
});
