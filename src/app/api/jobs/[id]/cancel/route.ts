import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        await db.query(`UPDATE jobs SET status = ?, message = ? WHERE id = ?`,
            ['cancelling', 'Pausing analysis... wrapping up current batch.', id]);

        return NextResponse.json({ success: true, message: "Cancellation signal sent." });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
