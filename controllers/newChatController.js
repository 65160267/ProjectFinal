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
  // Try to load a list of users (possible conversation partners). If DB isn't ready, fall back to sample data.
  let conversations = [];
  try {
    // select some users to show as recent conversations (exclude self)
    const [rows] = await db.pool.query('SELECT id, username, full_name, avatar FROM users WHERE id != ? ORDER BY id DESC LIMIT 30', [me.userId]);
    conversations = (rows || []).map(r => ({
      id: r.id,
      username: r.username || r.full_name || ('user' + r.id),
      avatar: r.avatar || '/images/profile-placeholder.svg',
      snippet: ''
    }));
  } catch (err) {
    console.log('Could not load users for conversations (DB may be missing):', err && err.message);
    // fallback single sample conversation
    conversations = [{ id: 12, username: 'weqweqweqw', avatar: '/images/profile-placeholder.svg', snippet: 'ตัวอย่างข้อความ' }];
  }

  return res.render('newchat/index', { me, conversations, user: userProfile });
}

module.exports = { inbox };
