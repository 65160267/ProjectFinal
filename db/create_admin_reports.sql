-- Create table for admin-reported issues / error reports
-- Run this once (e.g. via MySQL client or phpMyAdmin SQL tab)

CREATE TABLE IF NOT EXISTS admin_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reporter_username VARCHAR(128) DEFAULT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(32) DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL
);
