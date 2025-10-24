const { pool } = require('./db');

async function simpleSetup() {
  try {
    console.log('🔧 การติดตั้งระบบแลกเปลี่ยนแบบง่าย...');
    
    // ทดสอบการเชื่อมต่อก่อน
    console.log('🔌 ทดสอบการเชื่อมต่อฐานข้อมูล...');
    const connection = await pool.getConnection();
    console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ');
    connection.release();
    
    // สร้างตาราง exchange_requests แบบง่าย
    console.log('📋 สร้างตาราง exchange_requests...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exchange_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        requester_id INT NOT NULL,
        book_owner_id INT NOT NULL,
        requested_book_id INT NOT NULL,
        offered_book_id INT NULL,
        message TEXT,
        status ENUM('pending', 'accepted', 'rejected', 'completed') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ สร้างตาราง exchange_requests สำเร็จ');
    
    // เพิ่มคอลัมน์ exchange_count ในตาราง users
    console.log('👤 เพิ่มคอลัมน์ exchange_count...');
    try {
      await pool.query('ALTER TABLE users ADD COLUMN exchange_count INT DEFAULT 0');
      console.log('✅ เพิ่มคอลัมน์ exchange_count สำเร็จ');
    } catch (e) {
      console.log('⚠️ คอลัมน์ exchange_count มีอยู่แล้ว');
    }

    // เพิ่มคอลัมน์ owner_id ในตาราง books (ถ้ายังไม่มี)
    console.log('📚 ตรวจสอบคอลัมน์ owner_id ในตาราง books...');
    try {
      await pool.query('ALTER TABLE books ADD COLUMN owner_id INT NULL');
      console.log('✅ เพิ่มคอลัมน์ owner_id สำเร็จ');
    } catch (e) {
      console.log('⚠️ คอลัมน์ owner_id มีอยู่แล้ว');
    }

    // สร้าง View แบบง่าย
    console.log('👁️ สร้าง View exchange_requests_detailed...');
    await pool.query(`
      CREATE OR REPLACE VIEW exchange_requests_detailed AS
      SELECT 
          er.*,
          ru.username as requester_username,
          ou.username as owner_username,
          rb.title as requested_book_title,
          rb.author as requested_book_author,
          ob.title as offered_book_title,
          ob.author as offered_book_author
      FROM exchange_requests er
      LEFT JOIN users ru ON er.requester_id = ru.id
      LEFT JOIN users ou ON er.book_owner_id = ou.id  
      LEFT JOIN books rb ON er.requested_book_id = rb.id
      LEFT JOIN books ob ON er.offered_book_id = ob.id
    `);
    console.log('✅ สร้าง View สำเร็จ');
    
    // ทดสอบ
    console.log('\n🧪 ทดสอบการทำงาน...');
    const [count] = await pool.query('SELECT COUNT(*) as count FROM exchange_requests');
    console.log('🔄 จำนวนคำขอแลกเปลี่ยน:', count[0].count);
    
    const [viewTest] = await pool.query('SELECT COUNT(*) as count FROM exchange_requests_detailed');
    console.log('👁️ View ทำงานได้ปกติ');
    
    console.log('\n🎉 ติดตั้งระบบแลกเปลี่ยนเสร็จสิ้น!');
    console.log('✨ ตอนนี้สามารถใช้งานได้แล้ว:');
    console.log('   - /exchange/incoming (คำขอที่ได้รับ)');
    console.log('   - /exchange/outgoing (คำขอที่ส่งไป)');
    console.log('   ก่อนผู้ส่งคำขอในหน้ารายละเอียดหนังสือ');
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 วิธีแก้ไข:');
      console.log('1. เปิด XAMPP และเริ่ม MySQL service');
      console.log('2. หรือตรวจสอบการตั้งค่าฐานข้อมูลในไฟล์ db.js');
      console.log('3. หรือรัน: mysql -u root -p เพื่อทดสอบการเชื่อมต่อ');
    }
  }
  
  process.exit(0);
}

simpleSetup();