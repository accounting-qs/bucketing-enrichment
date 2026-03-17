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
import { Database } from 'duckdb-async';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// No dummy HTTP server needed here anymore as Next.js handles the listening port

console.log(`>>> WORKER PROCESS INITIALIZED [PID: ${process.pid}]`);
console.log('>>> WORKER CONNECTING TO REDIS:', REDIS_URL.split('@').pop());

const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
});

connection.on('connect', () => console.log('>>> REDIS CONNECTED'));
connection.on('error', (err) => console.error('>>> REDIS ERROR:', err));

console.log('>>> Background Worker Starting...');

// --- Helper Functions ---|

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
    const { selectedColumn, confirmedBuckets, provider, minClusterSize = 50 } = options;

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
        
        // RECACULATE UNIQUE VALUES USING DUCKDB (Avoiding memory explosion over Redis)
        const safePath = workbook.storagePath.replace(/'/g, "''");
        const initDuckDB = await Database.create(':memory:');
        const countQuery = `
            SELECT "${selectedColumn}" as val, count(*) as count
            FROM read_csv('${safePath}', header=True, auto_detect=True)
            WHERE "${selectedColumn}" IS NOT NULL AND "${selectedColumn}" != ''
            GROUP BY "${selectedColumn}"
            ORDER BY count DESC
        `;
        const frequencyRows = await initDuckDB.all(countQuery);
        await initDuckDB.close();

        // OPTIMIZATION: Sort unique values by frequency, and only send the top N to AI.
        // This is crucial for large datasets (60k+ unique values) to avoid API fatigue and timeouts.
        const sortedUniqueStrings = frequencyRows.map(row => row.val?.toString().trim()).filter(Boolean);

        // --- NEW HYBRID WORKFLOW (OPTION C) ---

        // 1. Build an exact match lookup dictionary from the user's approved taxonomy
        const exactMatchLookup = new Map<string, BucketNode>();
        function fillExactMatches(nodes: BucketNode[]) {
            for (const node of nodes) {
                if (node.name !== "General / Unformatted") {
                    exactMatchLookup.set(node.name.toLowerCase().trim(), node);
                }
                if (node.children) fillExactMatches(node.children);
            }
        }
        fillExactMatches(rootBuckets);

        // 2. Separate strictly Exact Matches from Unknowns
        const aiTargetStrings: string[] = [];
        for (const str of sortedUniqueStrings) {
            const key = str.toLowerCase();
            if (exactMatchLookup.has(key)) {
                // Instantly map exact matches for free and speed!
                valueMap[key] = exactMatchLookup.get(key)!;
            } else {
                aiTargetStrings.push(str);
            }
        }

        // We only send the top Unknowns to AI (Cost savings & limits)
        const cappedAiTargets = aiTargetStrings.slice(0, 5000);
        
        const BATCH_SIZE = 150; // Increased batch size since models can handle 150 easy
        const nodeToPath: Map<string, BucketNode[]> = new Map();

        // 3. AI Mapping Phase (Only applied as a Fallback Rescue for Unknowns)
        await db.query(`UPDATE jobs SET message = ?, progress = 10, updatedAt = ? WHERE id = ?`,
            [`AI processing ${cappedAiTargets.length} unmapped values...`, new Date().toISOString(), jobId]);

        let totalMappingsReceived = 0;
        for (let i = 0; i < cappedAiTargets.length; i += BATCH_SIZE) {
            const batch = cappedAiTargets.slice(i, i + BATCH_SIZE);
            const batchProgress = 10 + Math.floor((i / cappedAiTargets.length) * 40); 

            await db.query(`UPDATE jobs SET progress = ?, updatedAt = ? WHERE id = ?`, [batchProgress, new Date().toISOString(), jobId]);
            console.log(`>>> Job [${jobId}] AI Mapping Batch ${i / BATCH_SIZE + 1}/${Math.ceil(cappedAiTargets.length / BATCH_SIZE)}...`);

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
                totalMappingsReceived += result.mappings.length;
                result.mappings.forEach((m: any) => {
                    if (!m.path || m.path.length === 0) return;
                    
                    const pathArray = Array.isArray(m.path) ? m.path : m.path.split('>').map((s: string) => s.trim());
                    
                    let currParent: BucketNode | undefined = undefined;
                    let lastNode: BucketNode | undefined;

                    for (let d = 0; d < pathArray.length; d++) {
                        const segment = pathArray[d];
                        const siblings: BucketNode[] = currParent ? currParent.children : rootBuckets;
                        let node: BucketNode | undefined = siblings.find((b: BucketNode) => b.name.toLowerCase().trim() === segment.toLowerCase().trim());

                        if (!node) {
                            // STRICT CONSTRAINT: Do not allow AI to hallucinate directories. Break and flag undefined.
                            lastNode = undefined;
                            break;
                        }
                        currParent = node;
                        lastNode = node;
                    }

                    if (m.value) {
                        const originalKey = batch.find(k => k.toLowerCase().trim() === m.value.toLowerCase().trim()) || m.value;
                        if (lastNode) {
                            valueMap[originalKey.toLowerCase().trim()] = lastNode;
                            const fullPath = findPathToNode(rootBuckets, lastNode.id);
                            if (fullPath) nodeToPath.set(lastNode.id, fullPath);
                        } else {
                            // Fallback to General Bucket if AI hallucinated paths or couldn't classify it properly
                            valueMap[originalKey.toLowerCase().trim()] = generalBucket;
                        }
                    }
                });
            }
        }
        console.log(`>>> Job [${jobId}] AI Rescue done. Total mappings processed: ${totalMappingsReceived}`);

        // 4. Grouping & Assigning Phase using DuckDB
        await db.query(`UPDATE jobs SET message = ?, progress = 55, updatedAt = ? WHERE id = ?`,
            ['Assigning matched records directly to CSV... (DuckDB)', new Date().toISOString(), jobId]);

        const unmappedRows: { index: number, value: string }[] = [];
        let totalRowsProcessed = 0;

        const duckDB = await Database.create(':memory:');
        
        // We use row_number()-1 to get 0-based CSV rows for consistent row-indexing
        const duckQuery = `
            SELECT "${selectedColumn}" as val, list(row_idx) as indices, count(*) as row_count
            FROM (
                SELECT row_number() OVER () - 1 as row_idx, * 
                FROM read_csv('${safePath}', header=True, auto_detect=True)
            )
            GROUP BY "${selectedColumn}"
        `;
        
        const groupedRows = await duckDB.all(duckQuery);
        
        for (const row of groupedRows) {
            const val = row.val?.toString().trim();
            const indices: number[] = Array.isArray(row.indices) ? row.indices.map((i: any) => Number(i)) : [];
            const count = Number(row.row_count || 0);
            
            totalRowsProcessed += count;

            if (!val) {
                generalBucket.rowIndices.push(...indices);
                generalBucket.rowCount += count;
            } else {
                const lookupKey = val.toLowerCase();
                let target: BucketNode | undefined = valueMap[lookupKey];

                if (target) {
                    const path = nodeToPath.get(target.id) || findPathToNode(rootBuckets, target.id);
                    if (path) {
                        path.forEach(node => {
                            node.rowCount += count;
                        });
                        target.rowIndices.push(...indices);
                    } else {
                        target.rowCount += count;
                        target.rowIndices.push(...indices);
                    }
                } else {
                    // For the unmapped rows, we push individual properties so auto-discovery can process them later
                    const mappedIndices = indices.map(idx => ({ index: idx, value: val }));
                    unmappedRows.push(...mappedIndices);
                    
                    generalBucket.rowIndices.push(...indices);
                    generalBucket.rowCount += count;
                }
            }
        }
        
        await duckDB.close();

        // Update progress since DuckDB is super fast, it happens all at once
        await db.query(`UPDATE jobs SET progress = 85, updatedAt = ? WHERE id = ?`, [new Date().toISOString(), jobId]).catch(() => { });

        // 5. Semantic Auto-Discovery Phase (Breaking The General Bucket) DELETED
        // Per strictly conforming mapping instructions, we will not create Auto-Discovered clusters and rely entirely on the exact taxonomy.

        // 6. Finalize and Save JSON Result
        const analysisId = uuidv4();
        const finalResult = {
            workbookId,
            selectedColumn,
            createdAt: new Date().toISOString(),
            rootBuckets,
            stats: {
                uniqueValues: sortedUniqueStrings.length,
                aiMapped: totalMappingsReceived,
                emptyCount: generalBucket.rowCount,
                totalProcessed: totalRowsProcessed
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
