import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { uploadFile, getWorkbookKey } from "@/lib/storage";
import { v4 as uuid } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const projectId = formData.get("projectId") as string;

    if (!file || !projectId) {
      return NextResponse.json(
        { error: "file and projectId are required" },
        { status: 400 }
      );
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse CSV to get columns and row count
    const text = buffer.toString("utf-8");
    const lines = text.split("\n").filter((l) => l.trim());
    const headerLine = lines[0] || "";
    
    // Simple CSV header parsing (handles quoted headers)
    const columns = parseCSVLine(headerLine);
    const rowCount = Math.max(0, lines.length - 1);

    // Generate storage key and upload to R2
    const workbookId = uuid();
    const storageKey = getWorkbookKey(workbookId);
    await uploadFile(storageKey, buffer, "text/csv");

    // Save metadata to database
    const result = await query(
      `INSERT INTO workbooks (id, project_id, filename, display_name, storage_key, columns, row_count, file_size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        workbookId,
        projectId,
        file.name,
        file.name.replace(/\.csv$/i, ""),
        storageKey,
        JSON.stringify(columns),
        rowCount,
        buffer.length,
      ]
    );

    return NextResponse.json({ workbook: result[0] }, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result.map((col) => col.replace(/^"|"$/g, ""));
}
