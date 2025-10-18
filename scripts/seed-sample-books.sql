-- Seed 3 sample books for phpMyAdmin or MySQL client
-- Adjust owner_id if you have users, or set to NULL

INSERT INTO books (owner_id, title, description, tags, location, `condition`, image, is_available, created_at)
VALUES (NULL, 'Sample Product A', 'รายละเอียดสินค้าตัวอย่าง A', 'keyboard', 'กรุงเทพมหานคร', 'good', '/uploads/sample-a.png', 1, NOW());

INSERT INTO books (owner_id, title, description, tags, location, `condition`, image, is_available, created_at)
VALUES (NULL, 'Sample Product B', 'รายละเอียดสินค้าตัวอย่าง B', 'gaming chair', 'ชลบุรี', 'used', '/uploads/sample-b.png', 1, NOW());

INSERT INTO books (owner_id, title, description, tags, location, `condition`, image, is_available, created_at)
VALUES (NULL, 'Sample Product C', 'รายละเอียดสินค้าตัวอย่าง C', 'headset', 'กรุงเทพมหานคร', 'new', '/uploads/sample-c.png', 1, NOW());
