const express = require('express');
const router = express.Router();
const db = require('../db');

// Public endpoint to create a report (used by footer modal)
router.post('/', async (req, res) => {
  try {
  const { title, description } = req.body || {};
  const reporterId = req.session && req.session.userId ? req.session.userId : null;
  const reporter = req.session && req.session.username ? req.session.username : (req.body.reporter_username || 'anonymous');

    if (!title || !description) return res.status(400).json({ error: 'Missing title or description' });

    try {
      await db.pool.query(
        'INSERT INTO admin_reports (reporter_id, reporter_username, title, description, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [reporterId, reporter, title, description, 'open']
      );
      return res.json({ success: true });
    } catch (err) {
      console.log('admin_reports table insert failed:', err.message);
      // If the table doesn't exist, still return success but log — avoids breaking UX
      return res.status(200).json({ success: true, warning: 'admin_reports table missing; report not persisted' });
    }
  } catch (err) {
    console.error('Create public report error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
