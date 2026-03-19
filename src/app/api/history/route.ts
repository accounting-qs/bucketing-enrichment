import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET all analyses with project and workbook info
export async function GET() {
  const analyses = await query(
    `SELECT 
       a.*,
       p.name as project_name,
       w.filename as workbook_filename
     FROM analyses a
     LEFT JOIN projects p ON p.id = a.project_id
     LEFT JOIN workbooks w ON w.id = a.workbook_id
     ORDER BY a.created_at DESC
     LIMIT 100`
  );

  return NextResponse.json({ analyses });
}
