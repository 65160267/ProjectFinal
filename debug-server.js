const express = require('express');
const { pool } = require('./db');

const app = express();

app.get('/debug', async (req, res) => {
    try {
        // ดูข้อมูลผู้ใช้
        const [users] = await pool.query('SELECT id, username FROM users');
        
        // ดูข้อมูลหนังสือ
        const [books] = await pool.query('SELECT id, title, owner_id, created_at FROM books ORDER BY created_at DESC');
        
        // สร้างการเชื่อมโยงระหว่าง user และ books
        const userBooksMap = {};
        users.forEach(user => {
            userBooksMap[user.id] = {
                user: user,
                books: books.filter(book => book.owner_id === user.id)
            };
        });
        
        // หนังสือที่ไม่มี owner
        const orphanBooks = books.filter(book => book.owner_id === null);
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Debug Database</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
                .user { background: #f0f8ff; }
                .book { background: #f5f5f5; margin: 5px 0; padding: 10px; }
                .orphan { background: #ffe4e1; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>🔍 Database Debug</h1>
            
            <div class="section">
                <h2>📊 Summary</h2>
                <p>Total Users: ${users.length}</p>
                <p>Total Books: ${books.length}</p>
                <p>Books without Owner: ${orphanBooks.length}</p>
            </div>
            
            <div class="section">
                <h2>📚 All Books</h2>
                <table>
                    <tr>
                        <th>ID</th>
                        <th>Title</th>
                        <th>Owner ID</th>
                        <th>Created At</th>
                    </tr>
                    ${books.map(book => `
                        <tr style="${book.owner_id ? '' : 'background: #ffe4e1;'}">
                            <td>${book.id}</td>
                            <td>${book.title}</td>
                            <td>${book.owner_id || 'NULL'}</td>
                            <td>${book.created_at}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>
            
            <div class="section">
                <h2>👥 Users and Their Books</h2>
                ${Object.values(userBooksMap).map(userInfo => `
                    <div class="user">
                        <h3>User: ${userInfo.user.username} (ID: ${userInfo.user.id})</h3>
                        <p>Books: ${userInfo.books.length}</p>
                        ${userInfo.books.length > 0 ? `
                            ${userInfo.books.map(book => `
                                <div class="book">📖 ${book.title} (ID: ${book.id})</div>
                            `).join('')}
                        ` : '<p style="color: #666;">No books found for this user</p>'}
                    </div>
                `).join('')}
            </div>
            
            ${orphanBooks.length > 0 ? `
            <div class="section orphan">
                <h2>🚫 Books without Owner</h2>
                ${orphanBooks.map(book => `
                    <div class="book">📖 ${book.title} (ID: ${book.id}) - Created: ${book.created_at}</div>
                `).join('')}
            </div>
            ` : ''}
            
            <div class="section">
                <h2>🔧 Quick Fix</h2>
                <p>If you have books without owners, you can fix them by:</p>
                <ol>
                    <li>Go to <a href="/books">Books List</a></li>
                    <li>Login as a user</li>
                    <li>Add new books - they should get proper owner_id</li>
                </ol>
            </div>
        </body>
        </html>
        `;
        
        res.send(html);
    } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
    }
});

app.listen(3001, () => {
    console.log('Debug server running on http://localhost:3001/debug');
});