const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const pool = mysql.createPool({
        host: process.env.DB_HOST || "localhost",
        port: process.env.DB_PORT || "3306",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "db",
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
});

async function init() {
    const sqlPath = path.join(__dirname, 'db', 'init.sql');
    if (!fs.existsSync(sqlPath)) {
        console.warn('No init.sql found at', sqlPath);
        return;
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const conn = await pool.getConnection();
    try {
        // split by semicolon and run statements
        const statements = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
        for (const st of statements) {
            await conn.query(st);
        }
        console.log('DB initialized');
    } finally {
        conn.release();
    }
}

module.exports = { pool, init };



