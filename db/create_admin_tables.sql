-- Create admin_reports and tickets tables for admin panel

CREATE TABLE IF NOT EXISTS admin_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reporter_username VARCHAR(191) DEFAULT NULL,
  title VARCHAR(255) DEFAULT NULL,
  description TEXT,
  status VARCHAR(32) DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
