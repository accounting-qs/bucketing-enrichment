import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import db from '../lib/db';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
});

console.log('>>> Background Worker Starting...');

const worker = new Worker('workbook-analysis', async (job: Job) => {
    const { jobId, workbookId, data } = job.data;

    try {
        console.log(`>>> Starting Job [${jobId}] for Workbook [${workbookId}]`);

        // Update status to processing
        await db.query(`UPDATE jobs SET status = ?, message = ?, updatedAt = ? WHERE id = ?`,
            ['processing', 'Starting analysis...', new Date().toISOString(), jobId]);

        // TODO: Move logic from API routes here
        // For now, let's pretend we are doing something
        for (let i = 0; i <= 100; i += 10) {
            await new Promise(r => setTimeout(r, 1000));
            await db.query(`UPDATE jobs SET progress = ?, updatedAt = ? WHERE id = ?`, [i, new Date().toISOString(), jobId]);
            console.log(`>>> Job [${jobId}] Progress: ${i}%`);
        }

        await db.query(`UPDATE jobs SET status = ?, message = ?, progress = 100, updatedAt = ? WHERE id = ?`,
            ['completed', 'Analysis finished!', new Date().toISOString(), jobId]);

        return { success: true };

    } catch (error: any) {
        console.error(`!!! Job [${jobId}] Failed:`, error);
        await db.query(`UPDATE jobs SET status = ?, message = ?, updatedAt = ? WHERE id = ?`,
            ['failed', error.message, new Date().toISOString(), jobId]);
        throw error;
    }
}, { connection });

worker.on('failed', (job, err) => {
    console.error(`>>> Worker Job ${job?.id} failed with ${err.message}`);
});
