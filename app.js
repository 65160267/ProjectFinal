const express = require('express');
const bodyParser = require('body-parser');
const { pool } = require('./db');

const app = express();
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

// Bootstrap: delegate to server.js which configures middleware, routes and starts the HTTP server.
try {
  require('./server');
} catch (err) {
  console.error('Failed to start server from app.js:', err);
  // don't rethrow here so the app file can still be required safely by tests/tools
}

async function checkMySQLConnection() {
  try {
    const conn = await pool.getConnection();
    // ping or simple query
    await conn.ping();
    console.log('✅ MySQL connected successfully!');
    conn.release();
  } catch (error) {
    console.error('❌ MySQL connection failed:', error.message || error);
  }
}

// run a one-off check (non-blocking)
checkMySQLConnection();

module.exports = app;