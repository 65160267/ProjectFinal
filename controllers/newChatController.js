const path = require('path');
const db = require('../db');

async function inbox(req, res) {
  if (!req.session || !req.session.userId) return res.redirect('/auth/login');
  const me = req.session;
  // Load current user profile to match dashboard footer expectations
  let userProfile = { id: me.userId, username: me.username, isAdmin: me.isAdmin };
  try {
    const [userRows] = await db.pool.query('SELECT username, full_name, avatar, location FROM users WHERE id = ?', [me.userId]);
    if (userRows && userRows.length > 0) {
      userProfile = { ...userProfile, ...userRows[0] };
    }
  } catch (e) {
    console.error('Failed to load user profile for messages footer:', e && e.message);
  }
  // Build conversation list ONLY from rooms that this user has sent a message in ("started by me").
  // Fallback: if chat_messages table missing or empty, show an empty list.
    let conversations = [];
    try {
      const [rooms] = await db.pool.query(
        'SELECT DISTINCT room FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC',
        [me.userId]
      );
      const otherIds = new Set();
      (rooms || []).forEach(r => {
        const parts = String(r.room || '').split('_');
        if (parts.length === 3) {
          const a = Number(parts[1]);
          const b = Number(parts[2]);
          if (a && b) otherIds.add(a === Number(me.userId) ? b : a);
        }
      });
      if (otherIds.size > 0) {
        const ids = Array.from(otherIds);
        const [users] = await db.pool.query(`SELECT id, username, full_name, avatar FROM users WHERE id IN (${ids.map(()=>'?').join(',')})`, ids);
        conversations = (users || []).map(r => {
          const raw = r.avatar || '';
          const normalized = raw ? (String(raw).startsWith('/') ? String(raw) : ('/uploads/' + String(raw))) : '/images/profile-placeholder.svg';
          return { id: r.id, username: r.username || r.full_name || ('user' + r.id), avatar: normalized, snippet: '' };
        });
      }
  } catch (err) {
    console.log('Conversations limited to self-started chats; chat_messages may be missing:', err && err.message);
    conversations = [];
  }

  // If user opens with ?open=<id>, include that user in the list so they can start a first chat
  try {
    const openId = req && req.query && req.query.open ? Number(req.query.open) : null;
    if (openId && !Number.isNaN(openId) && !conversations.find(c => Number(c.id) === Number(openId))) {
      const [uRows] = await db.pool.query('SELECT id, username, full_name, avatar FROM users WHERE id = ? LIMIT 1', [openId]);
      if (uRows && uRows[0]) {
        const r = uRows[0];
        const raw = r.avatar || '';
        const normalized = raw ? (String(raw).startsWith('/') ? String(raw) : ('/uploads/' + String(raw))) : '/images/profile-placeholder.svg';
        conversations.unshift({ id: r.id, username: r.username || r.full_name || ('user' + r.id), avatar: normalized, snippet: '' });
      }
    }
  } catch (e) {
    // ignore errors here
  }

  return res.render('newchat/index', { me, conversations, user: userProfile });
}

module.exports = { inbox };
