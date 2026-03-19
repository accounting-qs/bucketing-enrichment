import { NextResponse } from "next/server";
import { fetchAllModels } from "@/lib/modelCatalog";

export async function GET() {
  try {
    const models = await fetchAllModels();
    return NextResponse.json({ models });
  } catch (error) {
    console.error("Failed to fetch models:", error);
    return NextResponse.json({ models: [], error: "Failed to fetch models" }, { status: 500 });
  }
}
