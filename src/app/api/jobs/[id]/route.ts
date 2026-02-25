import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const { id } = await params;

    try {
        const job = await db.getOne("SELECT * FROM jobs WHERE id = ?", [id]);

        if (!job) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        return NextResponse.json(job);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
