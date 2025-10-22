const { pool } = require('./db');

async function addSampleBooks() {
    try {
        console.log('=== Adding Sample Books ===');
        
        // ดูผู้ใช้ที่มีอยู่
        const [users] = await pool.query('SELECT id, username FROM users ORDER BY id LIMIT 3');
        
        if (users.length === 0) {
            console.log('No users found. Please create a user first.');
            process.exit(1);
        }
        
        console.log('Available users:');
        users.forEach(user => {
            console.log(`- ID: ${user.id}, Username: ${user.username}`);
        });
        
        // ใช้ user แรกในการทดสอบ
        const testUser = users[0];
        console.log(`\nAdding books for user: ${testUser.username} (ID: ${testUser.id})`);
        
        // หนังสือตัวอย่าง
        const sampleBooks = [
            {
                title: 'Harry Potter และศิลาอาถรรพ์',
                author: 'J.K. Rowling',
                description: 'หนังสือแฟนตาซีที่มีชื่อเสียงโด่งดัง เล่าเรื่องของเด็กชายผู้มีพลังเวทมนตร์',
                condition: 'good',
                location: 'กรุงเทพมหานคร'
            },
            {
                title: 'เจ้าชายน้อย',
                author: 'Antoine de Saint-Exupéry',
                description: 'เรื่องราวสั้นที่เต็มไปด้วยความหมายลึกซึ้งเกี่ยวกับชีวิตและความรัก',
                condition: 'new',
                location: 'กรุงเทพมหานคร'
            },
            {
                title: 'ม.ค. เขียนโค้ดอย่างมืออาชีพ',
                author: 'Robert C. Martin',
                description: 'คู่มือการเขียนโปรแกรมสำหรับนักพัฒนาซอฟต์แวร์',
                condition: 'used',
                location: 'กรุงเทพมหานคร'
            }
        ];
        
        for (const book of sampleBooks) {
            const [result] = await pool.query(
                'INSERT INTO books (owner_id, title, author, description, `condition`, location, is_available) VALUES (?, ?, ?, ?, ?, ?, 1)',
                [testUser.id, book.title, book.author, book.description, book.condition, book.location]
            );
            
            console.log(`✅ Added: "${book.title}" (ID: ${result.insertId})`);
        }
        
        // ตรวจสอบผลลัพธ์
        const [userBooks] = await pool.query('SELECT * FROM books WHERE owner_id = ?', [testUser.id]);
        console.log(`\n🎉 User ${testUser.username} now has ${userBooks.length} books:`);
        userBooks.forEach(book => {
            console.log(`   - ${book.title} by ${book.author}`);
        });
        
        console.log('\n✨ Sample books added successfully!');
        console.log(`Now you can login as "${testUser.username}" and visit /user to see the books.`);
        
    } catch (error) {
        console.error('Error:', error);
    }
    
    process.exit(0);
}

addSampleBooks();