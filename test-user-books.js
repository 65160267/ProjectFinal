const { pool } = require('./db');

async function testUserBooks() {
    try {
        console.log('=== Testing User Books ===');
        
        // ดูข้อมูลผู้ใช้ทั้งหมด
        const [users] = await pool.query('SELECT id, username FROM users');
        console.log('\n--- All Users ---');
        users.forEach(user => {
            console.log(`User ID: ${user.id}, Username: ${user.username}`);
        });
        
        // ดูข้อมูลหนังสือทั้งหมด
        const [books] = await pool.query('SELECT id, title, owner_id FROM books');
        console.log('\n--- All Books ---');
        books.forEach(book => {
            console.log(`Book ID: ${book.id}, Title: ${book.title}, Owner ID: ${book.owner_id}`);
        });
        
        // ตรวจสอบหนังสือแต่ละ user
        console.log('\n--- Books Per User ---');
        for (const user of users) {
            const [userBooks] = await pool.query('SELECT * FROM books WHERE owner_id = ?', [user.id]);
            console.log(`User ${user.username} (ID: ${user.id}) has ${userBooks.length} books`);
            userBooks.forEach(book => {
                console.log(`  - ${book.title}`);
            });
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
    
    process.exit(0);
}

testUserBooks();