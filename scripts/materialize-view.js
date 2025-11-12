const { pool } = require('../db');

async function materialize() {
    console.log('🔄  Starting materialized view setup...');

    // 1. Create the materialized table if it doesn't exist
    const createMaterializedTableSQL = `
        CREATE TABLE IF NOT EXISTS exchange_requests_detailed_mv (
            id INT NOT NULL,
            requester_id INT NULL,
            book_owner_id INT NULL,
            requested_book_id INT NULL,
            offered_book_id INT NULL,
            message TEXT,
            status ENUM('pending','accepted','rejected','completed','cancelled') DEFAULT 'pending',
            created_at TIMESTAMP NULL,
            updated_at TIMESTAMP NULL,
            completed_at TIMESTAMP NULL,
            requester_username VARCHAR(191),
            requester_name VARCHAR(255),
            owner_username VARCHAR(191),
            owner_name VARCHAR(255),
            requested_book_title VARCHAR(255),
            requested_book_author VARCHAR(255),
            requested_book_thumbnail VARCHAR(255),
            offered_book_title VARCHAR(255),
            offered_book_author VARCHAR(255),
            offered_book_thumbnail VARCHAR(255),
            PRIMARY KEY (id),
            INDEX idx_mv_requester (requester_id),
            INDEX idx_mv_owner (book_owner_id),
            INDEX idx_mv_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    try {
        await pool.query(createMaterializedTableSQL);
        console.log('✅  Table "exchange_requests_detailed_mv" is ready.');
    } catch (err) {
        console.error('❌  Failed to create materialized table:', err.message);
        throw err; // Stop if table creation fails
    }

    // 2. Refresh data from the base tables
    const refreshSQL = `
        INSERT INTO exchange_requests_detailed_mv (
            id, requester_id, book_owner_id, requested_book_id, offered_book_id, message, status, created_at, updated_at, completed_at,
            requester_username, requester_name, owner_username, owner_name,
            requested_book_title, requested_book_author, requested_book_thumbnail,
            offered_book_title, offered_book_author, offered_book_thumbnail
        )
        SELECT 
            er.id, er.requester_id, er.book_owner_id, er.requested_book_id, er.offered_book_id, er.message, er.status, er.created_at, er.updated_at, er.completed_at,
            ru.username AS requester_username,
            ru.full_name AS requester_name,
            ou.username AS owner_username,
            ou.full_name AS owner_name,
            rb.title AS requested_book_title,
            rb.author AS requested_book_author,
            rb.thumbnail AS requested_book_thumbnail,
            ob.title AS offered_book_title,
            ob.author AS offered_book_author,
            ob.thumbnail AS offered_book_thumbnail
        FROM exchange_requests er
        LEFT JOIN users ru ON er.requester_id = ru.id
        LEFT JOIN users ou ON er.book_owner_id = ou.id
        LEFT JOIN books rb ON er.requested_book_id = rb.id
        LEFT JOIN books ob ON er.offered_book_id = ob.id
        ON DUPLICATE KEY UPDATE
            requester_id = VALUES(requester_id),
            book_owner_id = VALUES(book_owner_id),
            requested_book_id = VALUES(requested_book_id),
            offered_book_id = VALUES(offered_book_id),
            message = VALUES(message),
            status = VALUES(status),
            created_at = VALUES(created_at),
            updated_at = VALUES(updated_at),
            completed_at = VALUES(completed_at),
            requester_username = VALUES(requester_username),
            requester_name = VALUES(requester_name),
            owner_username = VALUES(owner_username),
            owner_name = VALUES(owner_name),
            requested_book_title = VALUES(requested_book_title),
            requested_book_author = VALUES(requested_book_author),
            requested_book_thumbnail = VALUES(requested_book_thumbnail),
            offered_book_title = VALUES(offered_book_title),
            offered_book_author = VALUES(offered_book_author),
            offered_book_thumbnail = VALUES(offered_book_thumbnail);
    `;

    try {
        // Clear the table before refreshing to remove deleted requests
        await pool.query('DELETE FROM exchange_requests_detailed_mv');
        const [result] = await pool.query(refreshSQL);
        console.log(`✅  Materialized view refreshed. ${result.affectedRows} rows updated/inserted.`);
    } catch (err) {
        console.error('❌  Failed to refresh materialized view:', err.message);
        // Don't rethrow, as the app can still run with stale data
    }
}

// Allow running this script directly
if (require.main === module) {
    materialize()
        .then(() => {
            console.log('Materialization complete.');
            process.exit(0);
        })
        .catch(err => {
            console.error('Materialization failed:', err);
            process.exit(1);
        });
}

module.exports = { materialize };
