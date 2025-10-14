-- Run this as a MySQL root/admin user to create the database and a dedicated user.
-- Update username/password as needed before running.

CREATE DATABASE IF NOT EXISTS `book_exchange` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create a dedicated user (change 'be_user' and password)
CREATE USER IF NOT EXISTS 'be_user'@'localhost' IDENTIFIED BY 'be_password';
GRANT ALL PRIVILEGES ON `book_exchange`.* TO 'be_user'@'localhost';
FLUSH PRIVILEGES;

-- Then connect to book_exchange and run the schema in init.sql
-- USE book_exchange;
-- SOURCE ./init.sql;
