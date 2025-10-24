const { pool } = require('./db');

async function testConnection() {
  try {
    console.log('🔌 ทดสอบการเชื่อมต่อฐานข้อมูล...');
    console.log('📋 การตั้งค่าปัจจุบัน:');
    console.log('   Host: localhost');
    console.log('   Port: 3306');
    console.log('   User: root');
    console.log('   Password: (ว่างเปล่า)');
    console.log('   Database: db');
    
    const connection = await pool.getConnection();
    console.log('✅ เชื่อมต่อสำเร็จ!');
    
    // ทดสอบ query
    const [result] = await connection.query('SELECT 1 as test');
    console.log('📊 ทดสอบ query สำเร็จ:', result[0]);
    
    // ตรวจสอบฐานข้อมูล
    const [databases] = await connection.query('SHOW DATABASES');
    console.log('🗄️ ฐานข้อมูลที่มี:', databases.map(db => Object.values(db)[0]).join(', '));
    
    // ตรวจสอบตารางใน db
    try {
      const [tables] = await connection.query('SHOW TABLES');
      console.log('📋 ตารางใน database "db":', tables.map(t => Object.values(t)[0]).join(', '));
    } catch (e) {
      console.log('⚠️ ไม่สามารถดูตารางได้:', e.message);
    }
    
    connection.release();
    console.log('\n🎯 ขั้นตอนต่อไป: รัน node simple-setup.js เพื่อติดตั้งระบบแลกเปลี่ยน');
    
  } catch (error) {
    console.error('❌ การเชื่อมต่อล้มเหลว:', error.message);
    console.error('Code:', error.code);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 แก้ไข: ปัญหา username/password');
      console.log('1. ตรวจสอบ username และ password ใน db.js');
      console.log('2. หรือรีเซ็ต MySQL password: mysqladmin -u root password newpassword');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 แก้ไข: MySQL server ไม่ทำงาน');
      console.log('1. เริ่ม XAMPP และ start MySQL');
      console.log('2. หรือรัน: net start mysql');
      console.log('3. หรือเปิด MySQL Workbench/phpMyAdmin');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('\n💡 แก้ไข: ไม่มีฐานข้อมูล "db"');
      console.log('1. สร้างฐานข้อมูล: CREATE DATABASE db;');
      console.log('2. หรือเปลี่ยนชื่อ database ในไฟล์ db.js');
    }
  }
  
  process.exit(0);
}

testConnection();