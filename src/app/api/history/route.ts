import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
    try {
        // Fetch completed historical analyses
        const analyses = await db.query(`
            SELECT a.id, a.workbookId, a.selectedColumn, a.createdAt, a.stats, w.filename 
            FROM analyses a
            LEFT JOIN workbooks w ON w.id = a.workbookId
            ORDER BY a.createdAt DESC
            LIMIT 50
        `);

        // Fetch background jobs to see real-time failures or successes
        const jobs = await db.query(`
            SELECT id, status, progress, message, updatedAt, resultId
            FROM jobs
            ORDER BY updatedAt DESC
            LIMIT 50
        `);

        return NextResponse.json({ analyses, jobs });
    } catch (error: any) {
        console.error("Fetch history error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
