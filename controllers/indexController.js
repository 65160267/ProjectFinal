const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const router = express.Router();

exports.getProducts = async (req, res) => {
  try {
    const [rows] = await db.pool.query('SELECT id, title, author FROM books ORDER BY id DESC LIMIT 10');
    res.render('index', { books: rows });
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
};