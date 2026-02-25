export interface Workbook {
  id: string;
  filename: string;
  uploadedAt: string;
  columns: string[];
  rowCount: number;
  storagePath: string;
}

export interface BucketNode {
  id: string;
  name: string;
  rowCount: number;
  childrenCount: number;
  children: BucketNode[];
  rowIndices: number[];
  depth: number;
}

export interface AnalysisResult {
  workbookId: string;
  selectedColumn: string;
  createdAt: string;
  rootBuckets: BucketNode[];
  stats: {
    uniqueValues: number;
    emptyCount: number;
  };
}

export type AIProvider = "gemini" | "openai" | "none";
