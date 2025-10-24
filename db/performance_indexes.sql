-- Database performance optimization
-- Add indexes for commonly queried columns

-- Index for books table performance
CREATE INDEX IF NOT EXISTS idx_books_owner_id ON books(owner_id);
CREATE INDEX IF NOT EXISTS idx_books_created_at ON books(created_at);
CREATE INDEX IF NOT EXISTS idx_books_is_available ON books(is_available);
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);

-- Index for users table performance  
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index for exchange_requests table (if exists)
CREATE INDEX IF NOT EXISTS idx_exchange_requests_requested_book_id ON exchange_requests(requested_book_id);
CREATE INDEX IF NOT EXISTS idx_exchange_requests_offered_book_id ON exchange_requests(offered_book_id);
CREATE INDEX IF NOT EXISTS idx_exchange_requests_requester_id ON exchange_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_exchange_requests_status ON exchange_requests(status);
CREATE INDEX IF NOT EXISTS idx_exchange_requests_created_at ON exchange_requests(created_at);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_books_owner_available ON books(owner_id, is_available);
CREATE INDEX IF NOT EXISTS idx_books_available_created ON books(is_available, created_at DESC);

SELECT 'Database indexes created successfully for performance optimization' as result;