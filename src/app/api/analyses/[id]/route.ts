import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import db from "@/lib/db";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const analysisDir = path.join(process.cwd(), "data", "analysis");
        const filePath = path.join(analysisDir, `${id}.json`);

        try {
            const data = await fs.readFile(filePath, "utf-8");
            return NextResponse.json(JSON.parse(data));
        } catch (e) {
            // If file not found, try DB metadata at least? 
            // Better to check if the analysis exists in DB.
            const analysis = await db.getOne("SELECT * FROM analyses WHERE id = ?", [id]);
            if (!analysis) {
                return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
            }
            return NextResponse.json({ error: "Analysis data file missing but record exists" }, { status: 404 });
        }
    } catch (error: any) {
        console.error("Fetch analysis error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
