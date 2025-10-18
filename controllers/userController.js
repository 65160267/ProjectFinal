const db = require('../db');

exports.profile = async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/auth/login');
  try {
    const [rows] = await db.pool.query('SELECT id, username, full_name, avatar, location FROM users WHERE id = ?', [req.session.userId]);
    const user = rows[0] || { id: req.session.userId, username: req.session.username };
    res.render('user', { user });
  } catch (err) {
    console.error('User profile error', err);
    res.status(500).send('DB error: ' + err.message);
  }
};

module.exports = exports;
