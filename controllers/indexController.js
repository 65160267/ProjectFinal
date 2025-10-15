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

    // Featured: pick 3 random books (show thumbnails)
    const [featured] = await db.pool.query('SELECT id, title, author, thumbnail FROM books ORDER BY RAND() LIMIT 3');

    // Recommended sections: for example two sections each with 3 books (random sample)
    const [recommendedA] = await db.pool.query('SELECT id, title, author, thumbnail FROM books ORDER BY RAND() LIMIT 3');
    const [recommendedB] = await db.pool.query('SELECT id, title, author, thumbnail FROM books ORDER BY RAND() LIMIT 3');

    res.render('dashboard', {
      user: { id: req.session.userId, username: req.session.username, isAdmin: req.session.isAdmin },
      stats: { booksCount, usersCount },
      featured,
      recommendedA,
      recommendedB
    });
  } catch (err) {
    console.error('Dashboard error', err);
    res.render('dashboard', { user: { id: req.session.userId, username: req.session.username, isAdmin: req.session.isAdmin }, stats: { booksCount: 0, usersCount: 0 }, featured: [], recommendedA: [], recommendedB: [] });
  }
};