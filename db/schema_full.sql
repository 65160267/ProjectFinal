-- Full schema for Book Exchange application (MySQL)
-- Usage:
-- 1) Run as a MySQL admin user (root) to create the database and grant a dedicated user.
-- 2) Connect using the dedicated user and run the table creation (or run the whole file as admin).

-- 1) Create database and dedicated user (edit user/password as needed)
CREATE DATABASE IF NOT EXISTS `book_exchange` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'be_user'@'localhost' IDENTIFIED BY 'be_password';
GRANT ALL PRIVILEGES ON `book_exchange`.* TO 'be_user'@'localhost';
FLUSH PRIVILEGES;

-- 2) Use the database
USE `book_exchange`;

-- Drop existing tables if you want a fresh start
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS users;

-- 3) Create users table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) Create books table
CREATE TABLE books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NULL,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255),
  description TEXT,
  is_available TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5) Create messages table (chat messages per book)
CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  user_id INT NULL,
  username VARCHAR(255) NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6) Indexes for performance
CREATE INDEX idx_books_owner ON books(owner_id);
CREATE INDEX idx_messages_book ON messages(book_id);
CREATE INDEX idx_messages_user ON messages(user_id);

-- 7) Insert a sample admin user
-- NOTE: For security, store password as bcrypt hash. Replace '<bcrypt_hash_here>' with a real bcrypt hash
-- Example: run node -e "console.log(require('bcrypt').hashSync('your-admin-password', 10))"
INSERT INTO users (username, password_hash, display_name, role)
VALUES ('admin', '<bcrypt_hash_here>', 'Administrator', 'admin');

-- 8) Optional: sample book
-- If you inserted the admin user above and know its id (e.g., 1), you can insert a sample book:
-- INSERT INTO books (owner_id, title, author, description) VALUES (1, 'Sample Book', 'Author Name', 'A sample book description');

-- End of schema
