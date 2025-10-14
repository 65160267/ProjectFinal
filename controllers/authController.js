const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const router = express.Router();


// For MVP keep a single admin user in env or hardcoded (replace in production)
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PW_HASH = process.env.ADMIN_PW_HASH || null; // if provided

exports.showLogin = (req, res) => {
  res.render('auth/login');
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USER) return res.render('auth/login', { error: 'Invalid credentials' });
  if (ADMIN_PW_HASH) {
    const ok = await bcrypt.compare(password, ADMIN_PW_HASH);
    if (!ok) return res.render('auth/login', { error: 'Invalid credentials' });
  } else {
    // fallback: simple plaintext check for development
    if (password !== (process.env.ADMIN_PASSWORD || 'password')) return res.render('auth/login', { error: 'Invalid credentials' });
  }
  req.session.isAdmin = true;
  res.redirect('/books');
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/'));
};
