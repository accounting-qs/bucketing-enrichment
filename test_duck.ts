import { Database } from 'duckdb-async';
import path from 'path';

(async () => {
    try {
        const db = await Database.create(':memory:');
        
        // I want to test querying a simple CSV
        // create a dummy csv
        const fs = require('fs');
        fs.writeFileSync('test.csv', 'id,val\n1,A\n2,B\n3,A\n4,C');
        
        // Let's get unique vals and their original rows. row_number() over() - 1 as index
        // group by val
        const res = await db.all(`
            SELECT val, list(row_idx) as indices, count(*) as c 
            FROM (SELECT row_number() OVER () - 1 as row_idx, * FROM read_csv_auto('test.csv')) 
            GROUP BY val
        `);
        console.log("DuckDB Async Works:", res);
    } catch (e) {
        console.error(e);
    }
})();
