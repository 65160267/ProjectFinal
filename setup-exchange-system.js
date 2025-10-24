const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

async function setupExchangeSystem() {
  try {
    console.log('🔧 เริ่มติดตั้งระบบแลกเปลี่ยนหนังสือ...');
    
    // อ่านไฟล์ SQL
    const sqlPath = path.join(__dirname, 'db', 'exchange_system_complete.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // แยกคำสั่ง SQL แต่ละตัว
    const statements = sqlContent
      .split(/;[\s]*(?=\n|$)/) // แยกด้วย ; ที่ตามด้วย newline หรือจบ
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));
    
    console.log(`📝 พบ ${statements.length} คำสั่ง SQL`);
    
    // รันคำสั่งทีละตัว
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.toLowerCase().includes('delimiter')) {
        console.log(`⏭️ ข้าม DELIMITER command (${i + 1})`);
        continue;
      }
      
      console.log(`▶️ รันคำสั่งที่ ${i + 1}: ${statement.substring(0, 50).replace(/\n/g, ' ')}...`);
      
      try {
        await pool.query(statement);
        console.log(`   ✅ สำเร็จ`);
      } catch (error) {
        if (error.message.includes('already exists') || 
            error.message.includes('Duplicate column') ||
            error.message.includes('Multiple primary key')) {
          console.log(`   ⚠️ ข้าม (มีอยู่แล้ว): ${error.message.split('\n')[0]}`);
        } else {
          console.log(`   ❌ ข้อผิดพลาด: ${error.message.split('\n')[0]}`);
        }
      }
    }
    
    console.log('\n🧪 ทดสอบการติดตั้ง...');
    
    // ตรวจสอบตารางที่สร้าง
    const [tables] = await pool.query("SHOW TABLES LIKE '%exchange%'");
    console.log('📋 ตารางที่เกี่ยวข้องกับ exchange:', 
      tables.map(t => Object.values(t)[0]).join(', '));
    
    // ตรวจสอบ Views
    const [views] = await pool.query("SHOW FULL TABLES WHERE Table_type = 'VIEW' AND Tables_in_db LIKE '%exchange%'");
    console.log('👁️ Views ที่เกี่ยวข้อง:', 
      views.map(v => v.Tables_in_db).join(', '));
    
    // ตรวจสอบจำนวนข้อมูล
    try {
      const [count] = await pool.query("SELECT COUNT(*) as count FROM exchange_requests");
      console.log('🔄 จำนวนคำขอแลกเปลี่ยนปัจจุบัน:', count[0].count);
    } catch (e) {
      console.log('❌ ไม่สามารถนับจำนวนคำขอแลกเปลี่ยน:', e.message);
    }
    
    console.log('\n🎉 การติดตั้งระบบแลกเปลี่ยนหนังสือเสร็จสิ้น!');
    console.log('📚 ตอนนี้คุณสามารถใช้งานระบบแลกเปลี่ยนหนังสือได้แล้ว');
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการติดตั้ง:', error);
  }
  
  process.exit(0);
}

setupExchangeSystem();