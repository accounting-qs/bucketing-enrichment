import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET — export analysis results as CSV with all original columns + industry
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch analysis rows with all original columns
  const rows = await query<{
    all_columns: Record<string, unknown>;
    industry: string;
    bucket_name: string;
    root_category: string;
    direct_ancestor: string;
    confidence: number;
    reason: string;
    is_generic: boolean;
    is_disqualified: boolean;
  }>(
    `SELECT all_columns, industry, bucket_name, root_category, direct_ancestor, 
            confidence, reason, is_generic, is_disqualified
     FROM analysis_rows 
     WHERE analysis_id = $1 
     ORDER BY row_index ASC`,
    [id]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows found" }, { status: 404 });
  }

  // Build CSV with all original columns + enrichment columns
  const firstRow = rows[0].all_columns;
  const originalColumns = Object.keys(firstRow);
  const enrichmentColumns = [
    "industry",
    "bucket_name", 
    "root_category",
    "direct_ancestor",
    "confidence",
    "reason",
    "is_generic",
    "is_disqualified",
  ];

  const allColumns = [...originalColumns, ...enrichmentColumns];

  // Header
  const csvLines: string[] = [allColumns.map(escapeCSV).join(",")];

  // Data rows
  for (const row of rows) {
    const values: string[] = [];
    
    // Original columns
    for (const col of originalColumns) {
      values.push(escapeCSV(String(row.all_columns[col] ?? "")));
    }
    
    // Enrichment columns
    values.push(escapeCSV(row.industry));
    values.push(escapeCSV(row.bucket_name));
    values.push(escapeCSV(row.root_category || ""));
    values.push(escapeCSV(row.direct_ancestor || ""));
    values.push(String(row.confidence ?? ""));
    values.push(escapeCSV(row.reason || ""));
    values.push(String(row.is_generic));
    values.push(String(row.is_disqualified));

    csvLines.push(values.join(","));
  }

  const csv = csvLines.join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="enriched_export_${id.slice(0, 8)}.csv"`,
    },
  });
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
