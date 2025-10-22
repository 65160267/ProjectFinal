const { pool } = require('./db');

async function checkDatabase() {
    try {
        console.log('=== Checking Database ===');
        
        // ตรวจสอบตาราง users
        const [users] = await pool.query('SELECT id, username, display_name FROM users');
        console.log('\n--- Users Table ---');
        console.log('Total users:', users.length);
        users.forEach(user => {
            console.log(`ID: ${user.id}, Username: ${user.username}, Display: ${user.display_name}`);
        });
        
        // ตรวจสอบตาราง books
        const [books] = await pool.query('SELECT id, title, author, owner_id, is_available FROM books');
        console.log('\n--- Books Table ---');
        console.log('Total books:', books.length);
        books.forEach(book => {
            console.log(`ID: ${book.id}, Title: ${book.title}, Author: ${book.author}, Owner ID: ${book.owner_id}, Available: ${book.is_available}`);
        });
        
        // ตรวจสอบ books ที่มี owner_id
        const [booksWithOwner] = await pool.query('SELECT * FROM books WHERE owner_id IS NOT NULL');
        console.log('\n--- Books with Owner ---');
        console.log('Books with owner:', booksWithOwner.length);
        
        // ตรวจสอบ structure ของตาราง books
        const [columns] = await pool.query('DESCRIBE books');
        console.log('\n--- Books Table Structure ---');
        columns.forEach(col => {
            console.log(`${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
        });
        
    } catch (error) {
        console.error('Database error:', error);
    } finally {
        process.exit(0);
    }
}

checkDatabase();