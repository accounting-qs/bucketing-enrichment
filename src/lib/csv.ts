import Papa from 'papaparse';
import fs from 'fs';

export async function getCSVMetadata(filePath: string) {
    return new Promise<{ columns: string[]; rowCount: number }>((resolve, reject) => {
        let rowCount = 0;
        let columns: string[] = [];

        const fileStream = fs.createReadStream(filePath);

        Papa.parse(fileStream, {
            header: true,
            step: (results) => {
                if (rowCount === 0 && results.meta.fields) {
                    columns = results.meta.fields;
                }
                rowCount++;
            },
            complete: () => {
                resolve({ columns, rowCount });
            },
            error: (error: any) => {
                reject(error);
            }
        });
    });
}

export async function getUniqueValues(filePath: string, columnName: string, limit: number = 200000) {
    return new Promise<{ uniqueValues: Record<string, number>; totalRows: number; emptyCount: number }>((resolve, reject) => {
        const uniqueValues: Record<string, number> = {};
        let totalRows = 0;
        let emptyCount = 0;

        const fileStream = fs.createReadStream(filePath);

        Papa.parse(fileStream, {
            header: true,
            skipEmptyLines: true,
            step: (results: any) => {
                if (totalRows >= limit) return;

                const val = results.data[columnName];
                if (val === undefined || val === null || val.toString().trim() === "") {
                    emptyCount++;
                } else {
                    const normalized = val.toString().trim();
                    uniqueValues[normalized] = (uniqueValues[normalized] || 0) + 1;
                }
                totalRows++;
            },
            complete: () => {
                resolve({ uniqueValues, totalRows, emptyCount });
            },
            error: (error: any) => {
                reject(error);
            }
        });
    });
}

export async function getBucketRows(filePath: string, rowIndices: number[], limit: number = 50, injectRowIndex: boolean = false) {
    return new Promise<any[]>((resolve, reject) => {
        const rows: any[] = [];
        const indexSet = new Set(rowIndices);
        let currentRowIndex = 0;

        const fileStream = fs.createReadStream(filePath);

        Papa.parse(fileStream, {
            header: true,
            skipEmptyLines: true,
            step: (results, parser) => {
                if (indexSet.has(currentRowIndex)) {
                    if (injectRowIndex) {
                        (results.data as any).__rowIndex = currentRowIndex;
                    }
                    rows.push(results.data);
                }
                currentRowIndex++;
                if (rows.length >= limit) {
                    parser.abort(); // Optimization: stop reading the big file once limit is reached
                    resolve(rows);
                }
            },
            complete: () => {
                resolve(rows);
            },
            error: (error: any) => {
                reject(error);
            }
        });
    });
}
