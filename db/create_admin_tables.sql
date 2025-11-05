-- Create admin_reports table for admin panel (tickets removed)

CREATE TABLE IF NOT EXISTS admin_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reporter_username VARCHAR(191) DEFAULT NULL,
  title VARCHAR(255) DEFAULT NULL,
  description TEXT,
  status VARCHAR(32) DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- tickets table removed per application cleanup; use admin_reports or another workflow instead.
