import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import db from "@/lib/db";
import analyzeQueue from "@/lib/queue";

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

        // CREATE A BACKGROUND JOB
        const jobId = uuidv4();

        // Initial entry in jobs table
        await db.query(`
            INSERT INTO jobs (id, status, progress, message, updatedAt)
            VALUES (?, ?, ?, ?, ?)
        `, [jobId, 'queued', 0, 'Job added to queue...', new Date().toISOString()]);

        // Add to BullMQ
        await analyzeQueue.add('workbook-analysis', {
            jobId,
            workbookId: id,
            options: {
                selectedColumn,
                confirmedBuckets,
                uniqueValues,
                provider
            }
        });

        console.log(`>>> PROMOTED ANALYSIS TO BACKGROUND JOB: ${jobId}`);

        return NextResponse.json({
            jobId,
            message: "Analysis started in background"
        });

    } catch (error: any) {
        console.error(">>> QUEUEING ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
