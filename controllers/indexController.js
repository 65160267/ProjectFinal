const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const router = express.Router();

exports.getProducts = async (req, res) => {
  // ถ้าผู้ใช้ล็อกอิน (มี session.userId หรือเป็น admin) ให้ไปที่ dashboard แทน
  if (req.session && (req.session.userId || req.session.isAdmin)) {
    return res.redirect('/dashboard');
  }
  try {
  const [rows] = await db.pool.query('SELECT id, title, author FROM books ORDER BY id DESC LIMIT 10');
  res.render('exchange', { books: rows });
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
};

exports.dashboard = async (req, res) => {
  // require login
  if (!req.session || (!req.session.userId && !req.session.isAdmin)) return res.redirect('/auth/login');
  try {
    const [[{booksCount}]] = await db.pool.query('SELECT COUNT(*) AS booksCount FROM books');
    const [[{usersCount}]] = await db.pool.query('SELECT COUNT(*) AS usersCount FROM users');

    // Recent books for dashboard marketplace view
    // prefer `image` column (used by create) then `thumbnail`, fall back to placeholder
    const [books] = await db.pool.query(
      `SELECT id, title, author, 
        COALESCE(image, thumbnail, '/images/placeholder.png') AS thumbnail, 
        COALESCE(tags, category, wanted, '') AS tags, 
        location, condition
      FROM books ORDER BY id DESC LIMIT 12`
    );

    res.render('dashboard', {
      user: { id: req.session.userId, username: req.session.username, isAdmin: req.session.isAdmin },
      stats: { booksCount, usersCount },
      books
    });
  } catch (err) {
    console.error('Dashboard error', err);
    res.render('dashboard', { user: { id: req.session.userId, username: req.session.username, isAdmin: req.session.isAdmin }, stats: { booksCount: 0, usersCount: 0 }, books: [] });
  }
};

exports.marketplace = async (req, res) => {
  try {
    const [rows] = await db.pool.query('SELECT id, title, author, thumbnail, location, tags FROM books ORDER BY id DESC LIMIT 12');
    res.render('marketplace', { books: rows });
  } catch (err) {
    console.error('Marketplace error', err);
    res.render('marketplace', { books: [] });
  }
};