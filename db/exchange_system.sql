-- SQL script สำหรับสร้างระบบแลกเปลี่ยน
-- รันไฟล์นี้เพื่อเพิ่มตารางใหม่ลงในฐานข้อมูล

USE book_exchange;

-- สร้างตาราง exchange_requests สำหรับจัดการคำขอแลกเปลี่ยน
CREATE TABLE IF NOT EXISTS exchange_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  requester_id INT NOT NULL,
  book_owner_id INT NOT NULL,
  requested_book_id INT NOT NULL,
  offered_book_id INT NULL,
  message TEXT,
  status ENUM('pending', 'accepted', 'rejected', 'completed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (offered_book_id) REFERENCES books(id) ON DELETE SET NULL,
  
  INDEX idx_requester (requester_id),
  INDEX idx_owner (book_owner_id),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- เพิ่มคอลัมน์ exchange_count ในตาราง users เพื่อนับจำนวนการแลกเปลี่ยน
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS exchange_count INT DEFAULT 0;

-- สร้าง view สำหรับดูข้อมูลคำขอแลกเปลี่ยนแบบละเอียด
CREATE OR REPLACE VIEW exchange_requests_detailed AS
SELECT 
    er.*,
    ru.username as requester_username,
    ru.full_name as requester_name,
    ou.username as owner_username,
    ou.full_name as owner_name,
    rb.title as requested_book_title,
    rb.author as requested_book_author,
    rb.thumbnail as requested_book_thumbnail,
    ob.title as offered_book_title,
    ob.author as offered_book_author,
    ob.thumbnail as offered_book_thumbnail
FROM exchange_requests er
LEFT JOIN users ru ON er.requester_id = ru.id
LEFT JOIN users ou ON er.book_owner_id = ou.id  
LEFT JOIN books rb ON er.requested_book_id = rb.id
LEFT JOIN books ob ON er.offered_book_id = ob.id;

-- สร้างข้อมูลตัวอย่าง (optional)
-- INSERT INTO exchange_requests (requester_id, book_owner_id, requested_book_id, message) 
-- VALUES (2, 1, 1, 'สวัสดีครับ ผมสนใจหนังสือเล่มนี้มาก ขอแลกเปลี่ยนได้ไหมครับ');

SELECT 'Exchange system tables created successfully!' as status;