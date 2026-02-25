import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getUniqueValues } from "@/lib/csv";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const column = searchParams.get("column");

    if (!column) {
        return NextResponse.json({ error: "Missing column" }, { status: 400 });
    }

    try {
        const workbook = await db.getOne("SELECT * FROM workbooks WHERE id = ?", [id]);
        if (!workbook) {
            return NextResponse.json({ error: "Workbook not found" }, { status: 404 });
        }

        const { uniqueValues } = await getUniqueValues(workbook.storagePath, column, 1000);
        const samples = Object.entries(uniqueValues)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 25)
            .map(([value, count]) => ({ value, count }));

        return NextResponse.json({ samples });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
