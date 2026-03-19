import { NextRequest, NextResponse } from "next/server";
import { query, getOne } from "@/lib/db";
import { getAnalysisQueue } from "@/lib/queue";

// POST — start analysis (queues a background job)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workbookId } = await params;
    const { column, provider, projectId } = await req.json();

    if (!column || !provider || !projectId) {
      return NextResponse.json(
        { error: "column, provider, and projectId required" },
        { status: 400 }
      );
    }

    // Verify workbook exists
    const workbook = await getOne(
      "SELECT * FROM workbooks WHERE id = $1",
      [workbookId]
    );
    if (!workbook) {
      return NextResponse.json({ error: "Workbook not found" }, { status: 404 });
    }

    // Create analysis record
    const [analysis] = await query(
      `INSERT INTO analyses (project_id, workbook_id, selected_column, ai_provider, status, total_rows)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       RETURNING *`,
      [projectId, workbookId, column, provider, (workbook as Record<string, unknown>).row_count]
    );

    // Create job record
    const [job] = await query(
      `INSERT INTO jobs (analysis_id, status, message)
       VALUES ($1, 'queued', 'Waiting to start...')
       RETURNING *`,
      [(analysis as Record<string, unknown>).id]
    );

    // Queue the job for background processing
    const queue = getAnalysisQueue();
    await queue.add("analyze", {
      analysisId: (analysis as Record<string, unknown>).id,
      workbookId,
      jobId: (job as Record<string, unknown>).id,
      column,
      provider,
    });

    return NextResponse.json({ analysis, job });
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json({ error: "Analysis failed to start" }, { status: 500 });
  }
}
