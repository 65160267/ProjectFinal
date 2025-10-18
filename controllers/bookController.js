const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const router = express.Router();

exports.listBooks = async (req, res) => {
  try {
    // select all columns; compute friendly fields in JS to avoid referencing missing columns
    const [rows] = await db.pool.query('SELECT * FROM books ORDER BY id DESC');
    rows.forEach(b => {
      const thumb = (b.image || b.thumbnail || '/images/placeholder.png');
      if (thumb && typeof thumb === 'string') {
        b.thumbnail = (thumb.startsWith('/') || thumb.startsWith('http')) ? thumb : ('/uploads/' + thumb);
      } else {
        b.thumbnail = '/images/placeholder.png';
      }
      b.tags = b.tags || b.category || b.wanted || '';
      // condition and location left as-is
    });
    res.render('books/list', { books: rows });
  } catch (err) {
    res.status(500).send('DB error: ' + err.message);
  }
};

exports.showCreateForm = (req, res) => {
  res.render('books/new');
};

exports.createBook = async (req, res) => {
  // defensive: avoid destructuring from undefined
  const {
    title = null,
    author = null,
    description = null,
    category = null,
    condition = null,
    wanted = null,
    location = null
  } = req.body || {};
  try {
    const imageFile = req.file ? req.file.filename : null;

    // Gather possible columns and build an insert dynamically depending on what's available
    const [cols] = await db.pool.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='books'");
    const colSet = new Set(cols.map(c => c.COLUMN_NAME));

    // Map form fields to DB columns if they exist
    const insertCols = [];
    const insertPlaceholders = [];
    const insertValues = [];

    // Always insert title (if column exists)
    if (colSet.has('title')) { insertCols.push('title'); insertPlaceholders.push('?'); insertValues.push(title || null); }
    if (colSet.has('author')) { insertCols.push('author'); insertPlaceholders.push('?'); insertValues.push(author || null); }
    if (colSet.has('description')) { insertCols.push('description'); insertPlaceholders.push('?'); insertValues.push(description || null); }

    // prefer 'tags' column for wanted/category aggregation, fallback to 'category' if available
    const tagsValue = wanted || category || null;
    if (colSet.has('tags')) { insertCols.push('tags'); insertPlaceholders.push('?'); insertValues.push(tagsValue); }
    else if (colSet.has('category')) { insertCols.push('category'); insertPlaceholders.push('?'); insertValues.push(category || null); }

    if (colSet.has('condition')) { insertCols.push('condition'); insertPlaceholders.push('?'); insertValues.push(condition || null); }
    if (colSet.has('location')) { insertCols.push('location'); insertPlaceholders.push('?'); insertValues.push(location || null); }

    // save image into 'thumbnail' if exists, otherwise 'image'
    if (imageFile) {
      if (colSet.has('thumbnail')) { insertCols.push('thumbnail'); insertPlaceholders.push('?'); insertValues.push('/uploads/' + imageFile); }
      else if (colSet.has('image')) { insertCols.push('image'); insertPlaceholders.push('?'); insertValues.push('/uploads/' + imageFile); }
    }

    if (insertCols.length === 0) {
      // nothing to insert? return error
      return res.status(500).send('No writable columns found in books table');
    }

  // wrap column names in backticks to avoid reserved-word collisions (e.g., `condition`)
  const safeCols = insertCols.map(c => '`' + c + '`').join(',');
  const sql = `INSERT INTO books (${safeCols}) VALUES (${insertPlaceholders.join(',')})`;
    await db.pool.query(sql, insertValues);

    // redirect to dashboard so newly posted item appears there
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Create book error', err);
    res.status(500).send('DB error: ' + err.message);
  }
};

exports.viewBook = async (req, res) => {
  const id = req.params.id;
  try {
  const [rows] = await db.pool.query(`SELECT id, title, author, description, COALESCE(image, thumbnail, '') AS thumbnail, COALESCE(tags, category, wanted, '') AS tags, location, \`condition\` FROM books WHERE id = ?`, [id]);
    if (!rows.length) return res.status(404).send('Book not found');
    const book = rows[0];
    if (book.thumbnail && typeof book.thumbnail === 'string') {
      if (!book.thumbnail.startsWith('/') && !book.thumbnail.startsWith('http')) book.thumbnail = '/uploads/' + book.thumbnail;
    }
    res.render('books/view', { book });
  } catch (err) {
    res.status(500).send('DB error: ' + err.message);
  }
};
