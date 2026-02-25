import { BucketNode } from "@/types";
import { v4 as uuidv4 } from 'uuid';

export function heuristicBucketer(uniqueValues: Record<string, number>): BucketNode[] {
    const rootBuckets: Record<string, BucketNode> = {};
    const otherBucket: BucketNode = {
        id: uuidv4(),
        name: "Other / Unclassified",
        rowCount: 0,
        childrenCount: 0,
        children: [],
        rowIndices: [],
        depth: 0
    };

    for (const [value, count] of Object.entries(uniqueValues)) {
        const parts = value.split(/[|>,\->\/]/).map(p => p.trim()).filter(Boolean);

        if (parts.length === 0) continue;

        const topLevel = parts[0];
        const subLevel = parts[1] || null;

        if (!rootBuckets[topLevel]) {
            rootBuckets[topLevel] = {
                id: uuidv4(),
                name: topLevel,
                rowCount: 0,
                childrenCount: 0,
                children: [],
                rowIndices: [],
                depth: 0
            };
        }

        if (subLevel) {
            let subNode = rootBuckets[topLevel].children.find(c => c.name === subLevel);
            if (!subNode) {
                subNode = {
                    id: uuidv4(),
                    name: subLevel,
                    rowCount: 0,
                    childrenCount: 0,
                    children: [],
                    rowIndices: [],
                    depth: 1
                };
                rootBuckets[topLevel].children.push(subNode);
                rootBuckets[topLevel].childrenCount++;
            }
            // Note: we'll assign rowCount and rowIndices later in the main analysis flow
        }
    }

    const result = Object.values(rootBuckets);
    if (otherBucket.rowCount > 0) {
        result.push(otherBucket);
    }

    return result;
}
