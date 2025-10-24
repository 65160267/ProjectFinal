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

    // Get user profile information including avatar
    let userProfile = { id: req.session.userId, username: req.session.username, isAdmin: req.session.isAdmin };
    if (req.session.userId) {
      try {
        const [userRows] = await db.pool.query('SELECT username, full_name, avatar, location FROM users WHERE id = ?', [req.session.userId]);
        if (userRows.length > 0) {
          userProfile = { ...userProfile, ...userRows[0] };
        }
      } catch (userErr) {
        console.error('Failed to load user profile:', userErr);
      }
    }

    // Recent books for dashboard marketplace view - reduced to 6 items for better performance
    // prefer `image` column (used by create) then `thumbnail`, fall back to placeholder
    // Select all columns so we don't reference columns that may not exist in every schema
    const [books] = await db.pool.query('SELECT * FROM books ORDER BY id DESC LIMIT 6');

    // Compute friendly fields in JS side to avoid SQL errors when a column is missing
    books.forEach(b => {
      // thumbnail: prefer image then thumbnail then placeholder
      const thumb = (b.image || b.thumbnail || '/images/placeholder.png');
      if (thumb && typeof thumb === 'string') {
        b.thumbnail = (thumb.startsWith('/') || thumb.startsWith('http')) ? thumb : ('/uploads/' + thumb);
      } else {
        b.thumbnail = '/images/placeholder.png';
      }

      // tags: coalesce several possible columns
      b.tags = b.tags || b.category || b.wanted || '';

      // condition: leave as-is (may be undefined)
      // location: leave as-is
    });

    res.render('dashboard', {
      user: userProfile,
      stats: { booksCount, usersCount },
      books
    });
  } catch (err) {
    console.error('Dashboard error', err);
    res.render('dashboard', { 
      user: { id: req.session.userId, username: req.session.username, isAdmin: req.session.isAdmin }, 
      stats: { booksCount: 0, usersCount: 0 }, 
      books: [] 
    });
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