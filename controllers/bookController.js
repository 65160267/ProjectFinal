const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const router = express.Router();

exports.listBooks = async (req, res) => {
  try {
    const [rows] = await db.pool.query('SELECT id, title, author, description FROM books ORDER BY id DESC');
    res.render('books/list', { books: rows });
  } catch (err) {
    res.status(500).send('DB error: ' + err.message);
  }
};

exports.showCreateForm = (req, res) => {
  res.render('books/new');
};

exports.createBook = async (req, res) => {
  const { title, author, description } = req.body;
  try {
    await db.pool.query('INSERT INTO books (title, author, description) VALUES (?, ?, ?)', [title, author, description]);
    res.redirect('/books');
  } catch (err) {
    res.status(500).send('DB error: ' + err.message);
  }
};

exports.viewBook = async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await db.pool.query('SELECT id, title, author, description FROM books WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).send('Book not found');
    res.render('books/view', { book: rows[0] });
  } catch (err) {
    res.status(500).send('DB error: ' + err.message);
  }
};
