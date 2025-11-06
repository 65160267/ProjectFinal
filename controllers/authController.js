const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const router = express.Router();


// For MVP keep a single admin user in env or hardcoded (replace in production)
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PW_HASH = process.env.ADMIN_PW_HASH || null; // if provided

exports.showLogin = (req, res) => {
  // allow optional messages (success after register) or error
  res.render('auth/login', { error: null, message: null });
};

exports.login = async (req, res) => {
  let { username, password } = req.body;
  username = (username || '').toString().trim();
  password = (password || '').toString();
  console.log(`Login attempt: username="${username}", password="${password}"`);
  if (!username || !password) return res.render('auth/login', { error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน', message: null });

  try {
    // 1) Try authenticate against users table (if exists)
    const [tables] = await db.pool.query("SHOW TABLES LIKE 'users'");
    if (tables && tables.length > 0) {
      // normalize username lookup to lower-case to avoid case mismatch
      const lookup = username.toLowerCase();
  const [rows] = await db.pool.query('SELECT id, password_hash, role, is_active, username, avatar FROM users WHERE LOWER(username) = ?', [lookup]);
      if (rows && rows.length > 0) {
        const user = rows[0];
        if (user.is_active === 0) return res.render('auth/login', { error: 'บัญชีถูกระงับ', message: null });
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.render('auth/login', { error: 'Invalid credentials', message: null });

    // authenticated
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isAdmin = (user.role === 'admin');
    // set avatar into session so headers can display it immediately
    try {
      const raw = user.avatar;
      if (raw && typeof raw === 'string') {
        const s = raw.trim();
        if (s.startsWith('http') || s.startsWith('/')) req.session.avatar = s; 
        else req.session.avatar = '/uploads/' + s;
      } else {
        req.session.avatar = undefined;
      }
    } catch (e) {
      req.session.avatar = undefined;
    }
    console.log(`User logged in: id=${user.id} username=${user.username} isAdmin=${req.session.isAdmin}`);
    // Redirect admins to admin panel, others to dashboard
    if (req.session.isAdmin) return res.redirect('/admin');
    return res.redirect('/dashboard');
      }
    }

    // 2) Fallback: existing single-admin env check
    console.log(`Checking fallback admin: username="${username}" vs ADMIN_USER="${ADMIN_USER}"`);
    if (username === ADMIN_USER) {
      console.log('Username matches admin, checking password...');
      if (ADMIN_PW_HASH) {
        console.log('Using bcrypt hash check');
        const ok = await bcrypt.compare(password, ADMIN_PW_HASH);
        if (!ok) return res.render('auth/login', { error: 'Invalid credentials', message: null });
      } else {
        console.log(`Using plain text check: "${password}" vs "${process.env.ADMIN_PASSWORD || 'password'}"`);
        if (password !== (process.env.ADMIN_PASSWORD || 'password')) return res.render('auth/login', { error: 'Invalid credentials', message: null });
      }
  req.session.isAdmin = true;
  req.session.username = ADMIN_USER;
  console.log(`Admin fallback login successful: username=${ADMIN_USER}`);
  return res.redirect('/admin');
    }

    // not found anywhere
    return res.render('auth/login', { error: 'Invalid credentials', message: null });
  } catch (err) {
    console.error('Login error:', err);
    return res.render('auth/login', { error: 'เกิดข้อผิดพลาดภายใน โปรดลองอีกครั้ง', message: null });
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Session destroy error:', err);
    // clear session cookie (default name used by express-session)
    try { res.clearCookie('connect.sid'); } catch (e) { /* ignore */ }
    return res.redirect('/auth/login');
  });
};

// Registration handlers
exports.showRegister = (req, res) => {
  res.render('auth/register', { error: null });
};

exports.register = async (req, res) => {
  let { username, display_name, password, confirm } = req.body;
  username = (username || '').toString().trim();
  display_name = (display_name || '').toString().trim();
  if (!username || !password || !confirm) return res.render('auth/register', { error: 'กรุณากรอกข้อมูลให้ครบ' });
  if (password !== confirm) return res.render('auth/register', { error: 'รหัสผ่านไม่ตรงกัน' });

  try {
    // check if users table exists and username is unique. If users table missing, return error.
    const [rows] = await db.pool.query("SHOW TABLES LIKE 'users'");
    if (!rows || rows.length === 0) {
      return res.render('auth/register', { error: 'ฐานข้อมูลผู้ใช้ยังไม่ถูกสร้าง โปรดรันสคริปต์ `db/init.sql`' });
    }

    // check username exists
    // normalize username for storage (lowercase)
    const lookup = username.toLowerCase();
    const [existing] = await db.pool.query('SELECT id FROM users WHERE LOWER(username) = ?', [lookup]);
    if (existing && existing.length > 0) return res.render('auth/register', { error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });

    const hash = await bcrypt.hash(password, 10);
    const [r] = await db.pool.query('INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)', [username, hash, display_name || null]);
    console.log('New user inserted, id=', r.insertId);

    // redirect to login with success message (render login with message)
    return res.render('auth/login', { error: null, message: 'สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ' });
  } catch (err) {
    console.error('Register error:', err);
    return res.render('auth/register', { error: 'เกิดข้อผิดพลาดภายใน โปรดลองอีกครั้ง' });
  }
};
