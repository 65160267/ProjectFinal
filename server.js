const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');

const { pool } = require('./db');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);

// (global error handlers removed during revert)

// middleware
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: true,
}));

// simple Socket.IO chat namespace for book rooms
io.on('connection', (socket) => {
  socket.on('joinRoom', (room) => {
    socket.join(room);
  });
  socket.on('chatMessage', ({ room, user, message }) => {
    io.to(room).emit('chatMessage', { user, message, time: new Date() });
  });
});

// routes (will be created)
const indexRoutes = require('./routes/indexRoutes');
const bookRoutes = require('./routes/bookRoutes');
const authRoutes = require('./routes/authRoutes');
const exchangeRoutes = require('./routes/exchangeRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminNotify = require('./controllers/adminNotify');
const reportRoutes = require('./routes/reportRoutes');
// design preview route (temporary)
app.get('/designed', (req, res) => res.render('designed'));

// debug route
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
                body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
                .container { max-width: 1200px; margin: 0 auto; }
                .section { margin: 20px 0; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .user { background: #f0f8ff; margin: 10px 0; padding: 15px; border-radius: 5px; }
                .book { background: #f5f5f5; margin: 5px 0; padding: 10px; border-radius: 3px; }
                .orphan { background: #ffe4e1; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; }
                .highlight { background: #fff3cd; }
                .nav { margin-bottom: 20px; }
                .nav a { display: inline-block; margin-right: 15px; padding: 8px 16px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
                .nav a:hover { background: #0056b3; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🔍 Database Debug Page</h1>
                
                <div class="nav">
                    <a href="/">← กลับหน้าหลัก</a>
                    <a href="/books">📚 รายการหนังสือ</a>
                    <a href="/auth/login">🔐 เข้าสู่ระบบ</a>
                    <a href="/books/new">➕ เพิ่มหนังสือ</a>
                </div>
                
                <div class="section">
                    <h2>📊 สรุปข้อมูล</h2>
                    <p><strong>จำนวนผู้ใช้:</strong> ${users.length} คน</p>
                    <p><strong>จำนวนหนังสือทั้งหมด:</strong> ${books.length} เล่ม</p>
                    <p><strong>หนังสือที่ไม่มีเจ้าของ:</strong> ${orphanBooks.length} เล่ม</p>
                    <p><strong>Session Info:</strong> ${req.session.userId ? `Logged in as User ID: ${req.session.userId}` : 'Not logged in'}</p>
                </div>
                
                <div class="section">
                    <h2>📚 รายการหนังสือทั้งหมด</h2>
                    <table>
                        <tr>
                            <th>ID</th>
                            <th>ชื่อหนังสือ</th>
                            <th>Owner ID</th>
                            <th>วันที่สร้าง</th>
                            <th>สถานะ</th>
                        </tr>
                        ${books.map(book => `
                            <tr class="${book.owner_id ? '' : 'highlight'}">
                                <td>${book.id}</td>
                                <td>${book.title}</td>
                                <td>${book.owner_id || '<span style="color: red;">NULL</span>'}</td>
                                <td>${new Date(book.created_at).toLocaleString('th-TH')}</td>
                                <td>${book.owner_id ? '✅ มีเจ้าของ' : '❌ ไม่มีเจ้าของ'}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
                
                <div class="section">
                    <h2>👥 ผู้ใช้และหนังสือของพวกเขา</h2>
                    ${Object.values(userBooksMap).map(userInfo => `
                        <div class="user">
                            <h3>👤 ${userInfo.user.username} (ID: ${userInfo.user.id})</h3>
                            <p><strong>จำนวนหนังสือ:</strong> ${userInfo.books.length} เล่ม</p>
                            ${userInfo.books.length > 0 ? `
                                ${userInfo.books.map(book => `
                                    <div class="book">📖 ${book.title} <small>(ID: ${book.id})</small></div>
                                `).join('')}
                            ` : '<p style="color: #666; font-style: italic;">ไม่มีหนังสือ</p>'}
                        </div>
                    `).join('')}
                </div>
                
                ${orphanBooks.length > 0 ? `
                <div class="section orphan">
                    <h2>🚫 หนังสือที่ไม่มีเจ้าของ</h2>
                    <p>หนังสือเหล่านี้ไม่มี owner_id จึงไม่แสดงในโปรไฟล์ของใคร:</p>
                    ${orphanBooks.map(book => `
                        <div class="book">📖 <strong>${book.title}</strong> (ID: ${book.id}) - สร้างเมื่อ: ${new Date(book.created_at).toLocaleString('th-TH')}</div>
                    `).join('')}
                    
                    <div style="margin-top: 15px; padding: 15px; background: #fff3cd; border-radius: 5px;">
                        <h4>💡 วิธีแก้ไข:</h4>
                        <ol>
                            <li>เข้าสู่ระบบ</li>
                            <li>เพิ่มหนังสือใหม่ผ่าน <a href="/books/new">หน้าเพิ่มหนังสือ</a></li>
                            <li>หนังสือใหม่จะมี owner_id อัตโนมัติ</li>
                        </ol>
                    </div>
                </div>
                ` : ''}
                
            </div>
        </body>
        </html>
        `;
        
        res.send(html);
    } catch (error) {
        res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
    }
});

// admin notification middleware - provide open reports count to templates
app.use(adminNotify);

app.use('/', indexRoutes);
app.use('/books', bookRoutes);
app.use('/auth', authRoutes);
app.use('/exchange', exchangeRoutes);
app.use('/admin', adminRoutes);
// public reports endpoint for users to submit issues
app.use('/reports', reportRoutes);

const port = process.env.PORT || 3000;

// Run lightweight migration: ensure exchange_history table exists so history feature works
async function runMigrationsAndStart() {
    try {
            // Create exchange_history table without strict foreign keys to avoid migration failure
            const createExchangeHistory = `
                CREATE TABLE IF NOT EXISTS exchange_history (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    exchange_request_id INT NOT NULL,
                    user1_id INT NOT NULL,
                    user2_id INT NOT NULL,
                    book1_id INT NOT NULL,
                    book2_id INT NULL,
                    exchange_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    rating_user1 INT NULL,
                    rating_user2 INT NULL,
                    review_user1 TEXT,
                    review_user2 TEXT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `;

        await pool.query(createExchangeHistory);
        console.log('Migrations: ensured exchange_history table exists');
        // ensure admin_reports (tickets) table exists for admin panel
        const createAdminReports = `
            CREATE TABLE IF NOT EXISTS admin_reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                reporter_username VARCHAR(191) DEFAULT NULL,
                title VARCHAR(255) DEFAULT NULL,
                description TEXT,
                status VARCHAR(32) DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `;
        await pool.query(createAdminReports);
        console.log('Migrations: ensured admin_reports table exists');

        // lightweight tickets table (optional alternate ticketing schema)
        const createTickets = `
            CREATE TABLE IF NOT EXISTS tickets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT DEFAULT NULL,
                subject VARCHAR(255) DEFAULT NULL,
                body TEXT,
                status VARCHAR(32) DEFAULT 'open',
                priority ENUM('low','medium','high') DEFAULT 'medium',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `;
        await pool.query(createTickets);
        console.log('Migrations: ensured tickets table exists');
        // ticket comments for threaded replies on tickets/reports
        const createTicketComments = `
            CREATE TABLE IF NOT EXISTS ticket_comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ticket_id INT NOT NULL,
                user_id INT DEFAULT NULL,
                username VARCHAR(191) DEFAULT NULL,
                body TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `;
        await pool.query(createTicketComments);
        console.log('Migrations: ensured ticket_comments table exists');
            try {
                await pool.query("ALTER TABLE exchange_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL");
                console.log('Migrations: ensured exchange_requests.completed_at exists');
            } catch (e) {
                // ignore
            }
    } catch (migErr) {
        console.error('Migration error (non-fatal):', migErr && migErr.message);
    }

    server.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

runMigrationsAndStart();

module.exports = { app, server, io };
