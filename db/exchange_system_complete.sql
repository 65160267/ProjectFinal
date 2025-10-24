-- สคริปต์สร้างฐานข้อมูลสำหรับระบบแลกเปลี่ยนหนังสือ
-- รันคำสั่งนี้ใน MySQL เพื่อเพิ่มตารางที่จำเป็น

USE db; -- ใช้ฐานข้อมูลที่มีอยู่แล้ว

-- 1. ตาราง exchange_requests สำหรับจัดเก็บคำขอแลกเปลี่ยน
CREATE TABLE IF NOT EXISTS exchange_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requester_id INT NOT NULL COMMENT 'ผู้ขอแลกเปลี่ยน',
    book_owner_id INT NOT NULL COMMENT 'เจ้าของหนังสือ',
    requested_book_id INT NOT NULL COMMENT 'หนังสือที่ต้องการแลก',
    offered_book_id INT NULL COMMENT 'หนังสือที่เสนอแลก (ถ้ามี)',
    message TEXT COMMENT 'ข้อความจากผู้ขอแลกเปลี่ยน',
    status ENUM('pending', 'accepted', 'rejected', 'completed', 'cancelled') DEFAULT 'pending' COMMENT 'สถานะคำขอ',
    meeting_location VARCHAR(255) NULL COMMENT 'สถานที่นัดพบ',
    meeting_datetime DATETIME NULL COMMENT 'วันเวลานัดพบ',
    requester_confirmed TINYINT(1) DEFAULT 0 COMMENT 'ผู้ขอยืนยันแล้ว',
    owner_confirmed TINYINT(1) DEFAULT 0 COMMENT 'เจ้าของยืนยันแล้ว',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL COMMENT 'วันเวลาที่แลกเปลี่ยนสำเร็จ',
    
    -- Foreign Keys
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (offered_book_id) REFERENCES books(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_requester (requester_id),
    INDEX idx_owner (book_owner_id),
    INDEX idx_status (status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. ตาราง exchange_history สำหรับเก็บประวัติการแลกเปลี่ยน
CREATE TABLE IF NOT EXISTS exchange_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exchange_request_id INT NOT NULL,
    user1_id INT NOT NULL COMMENT 'ผู้แลกคนที่ 1',
    user2_id INT NOT NULL COMMENT 'ผู้แลกคนที่ 2',
    book1_id INT NOT NULL COMMENT 'หนังสือจากคนที่ 1',
    book2_id INT NULL COMMENT 'หนังสือจากคนที่ 2 (ถ้ามี)',
    exchange_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rating_user1 INT NULL CHECK (rating_user1 BETWEEN 1 AND 5) COMMENT 'คะแนนจากผู้ใช้คนที่ 1',
    rating_user2 INT NULL CHECK (rating_user2 BETWEEN 1 AND 5) COMMENT 'คะแนนจากผู้ใช้คนที่ 2',
    review_user1 TEXT COMMENT 'รีวิวจากผู้ใช้คนที่ 1',
    review_user2 TEXT COMMENT 'รีวิวจากผู้ใช้คนที่ 2',
    
    FOREIGN KEY (exchange_request_id) REFERENCES exchange_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book1_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (book2_id) REFERENCES books(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. ตาราง notifications สำหรับการแจ้งเตือน
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('exchange_request', 'exchange_accepted', 'exchange_rejected', 'exchange_completed', 'meeting_reminder') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_id INT NULL COMMENT 'ID ที่เกี่ยวข้อง เช่น exchange_request_id',
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_unread (user_id, is_read),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. เพิ่มคอลัมน์ในตาราง users สำหรับสถิติการแลกเปลี่ยน
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS exchange_count INT DEFAULT 0 COMMENT 'จำนวนการแลกเปลี่ยนสำเร็จ',
ADD COLUMN IF NOT EXISTS rating_average DECIMAL(3,2) DEFAULT 0.00 COMMENT 'คะแนนเฉลี่ย',
ADD COLUMN IF NOT EXISTS rating_count INT DEFAULT 0 COMMENT 'จำนวนการให้คะแนน',
ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NULL COMMENT 'เบอร์โทรศัพท์',
ADD COLUMN IF NOT EXISTS line_id VARCHAR(100) NULL COMMENT 'Line ID',
ADD COLUMN IF NOT EXISTS location VARCHAR(255) NULL COMMENT 'ที่อยู่หรือพื้นที่';

-- 5. เพิ่มคอลัมน์ในตาราง books สำหรับการแลกเปลี่ยน
ALTER TABLE books 
ADD COLUMN IF NOT EXISTS exchange_preference TEXT COMMENT 'ต้องการแลกกับหนังสือประเภทไหน',
ADD COLUMN IF NOT EXISTS exchange_location VARCHAR(255) COMMENT 'สถานที่ที่สะดวกในการแลกเปลี่ยน',
ADD COLUMN IF NOT EXISTS tags VARCHAR(500) COMMENT 'แท็กหมวดหมู่',
ADD COLUMN IF NOT EXISTS condition_detail ENUM('new', 'like_new', 'good', 'fair', 'poor') DEFAULT 'good' COMMENT 'สภาพหนังสือ',
ADD COLUMN IF NOT EXISTS thumbnail VARCHAR(500) COMMENT 'รูปปกหนังสือ',
ADD COLUMN IF NOT EXISTS isbn VARCHAR(20) COMMENT 'รหัส ISBN';

-- 6. สร้าง View สำหรับดูข้อมูลคำขอแลกเปลี่ยนแบบละเอียด
CREATE OR REPLACE VIEW exchange_requests_detailed AS
SELECT 
    er.*,
    -- ข้อมูลผู้ขอแลกเปลี่ยน
    ru.username as requester_username,
    ru.display_name as requester_name,
    ru.phone as requester_phone,
    ru.line_id as requester_line,
    ru.location as requester_location,
    ru.rating_average as requester_rating,
    ru.exchange_count as requester_exchange_count,
    
    -- ข้อมูลเจ้าของหนังสือ
    ou.username as owner_username,
    ou.display_name as owner_name,
    ou.phone as owner_phone,
    ou.line_id as owner_line,
    ou.location as owner_location,
    ou.rating_average as owner_rating,
    ou.exchange_count as owner_exchange_count,
    
    -- ข้อมูลหนังสือที่ต้องการแลก
    rb.title as requested_book_title,
    rb.author as requested_book_author,
    rb.thumbnail as requested_book_thumbnail,
    rb.condition_detail as requested_book_condition,
    rb.tags as requested_book_tags,
    rb.exchange_location as requested_book_exchange_location,
    
    -- ข้อมูลหนังสือที่เสนอแลก
    ob.title as offered_book_title,
    ob.author as offered_book_author,
    ob.thumbnail as offered_book_thumbnail,
    ob.condition_detail as offered_book_condition,
    ob.tags as offered_book_tags
    
FROM exchange_requests er
LEFT JOIN users ru ON er.requester_id = ru.id
LEFT JOIN users ou ON er.book_owner_id = ou.id  
LEFT JOIN books rb ON er.requested_book_id = rb.id
LEFT JOIN books ob ON er.offered_book_id = ob.id;

-- 7. สร้าง View สำหรับสถิติการแลกเปลี่ยน
CREATE OR REPLACE VIEW exchange_statistics AS
SELECT 
    u.id as user_id,
    u.username,
    u.display_name,
    u.exchange_count,
    u.rating_average,
    u.rating_count,
    COUNT(DISTINCT er1.id) as requests_sent,
    COUNT(DISTINCT er2.id) as requests_received,
    COUNT(DISTINCT CASE WHEN er1.status = 'completed' THEN er1.id END) as successful_requests_sent,
    COUNT(DISTINCT CASE WHEN er2.status = 'completed' THEN er2.id END) as successful_requests_received
FROM users u
LEFT JOIN exchange_requests er1 ON u.id = er1.requester_id
LEFT JOIN exchange_requests er2 ON u.id = er2.book_owner_id
GROUP BY u.id;

-- 8. สร้างข้อมูลตัวอย่าง (ถ้าต้องการ)
-- INSERT INTO exchange_requests (requester_id, book_owner_id, requested_book_id, message) 
-- VALUES (2, 1, 1, 'สวัสดีครับ ผมสนใจหนังสือเล่มนี้มาก ต้องการแลกเปลี่ยนครับ');

-- 9. สร้าง Stored Procedure สำหรับอัพเดทคะแนนเฉลี่ย
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS UpdateUserRating(IN user_id INT)
BEGIN
    UPDATE users 
    SET 
        rating_average = (
            SELECT COALESCE(AVG(
                CASE 
                    WHEN eh.user1_id = user_id THEN eh.rating_user2
                    WHEN eh.user2_id = user_id THEN eh.rating_user1
                END
            ), 0)
            FROM exchange_history eh 
            WHERE (eh.user1_id = user_id OR eh.user2_id = user_id)
            AND (
                (eh.user1_id = user_id AND eh.rating_user2 IS NOT NULL) OR
                (eh.user2_id = user_id AND eh.rating_user1 IS NOT NULL)
            )
        ),
        rating_count = (
            SELECT COUNT(*)
            FROM exchange_history eh 
            WHERE (eh.user1_id = user_id OR eh.user2_id = user_id)
            AND (
                (eh.user1_id = user_id AND eh.rating_user2 IS NOT NULL) OR
                (eh.user2_id = user_id AND eh.rating_user1 IS NOT NULL)
            )
        )
    WHERE id = user_id;
END$$
DELIMITER ;

-- 10. สร้าง Trigger สำหรับอัพเดทจำนวนการแลกเปลี่ยน
DELIMITER $$
CREATE TRIGGER IF NOT EXISTS update_exchange_count
AFTER UPDATE ON exchange_requests
FOR EACH ROW
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE users 
        SET exchange_count = exchange_count + 1 
        WHERE id IN (NEW.requester_id, NEW.book_owner_id);
    END IF;
END$$
DELIMITER ;

SELECT 'ระบบแลกเปลี่ยนหนังสือสร้างเสร็จเรียบร้อย!' as message;