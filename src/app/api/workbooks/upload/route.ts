import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs/promises";
import { getCSVMetadata } from "@/lib/csv";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const id = uuidv4();
        const filename = file.name;
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadsDir = path.join(process.cwd(), "data", "uploads");
        await fs.mkdir(uploadsDir, { recursive: true });

        const storagePath = path.join(uploadsDir, `${id}.csv`);
        await fs.writeFile(storagePath, buffer);

        const { columns, rowCount } = await getCSVMetadata(storagePath);
        const uploadedAt = new Date().toISOString();

        const workbook = {
            id,
            filename,
            uploadedAt,
            columns,
            rowCount,
            storagePath,
        };

        // Save to DB
        await db.query(`
          INSERT INTO workbooks (id, filename, uploadedAt, columns, rowCount, storagePath)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [id, filename, uploadedAt, JSON.stringify(columns), rowCount, storagePath]);

        return NextResponse.json(workbook);
    } catch (error: any) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
