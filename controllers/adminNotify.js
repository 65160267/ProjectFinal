const db = require('../db');

// Middleware to populate open reports count for templates
module.exports = async function adminNotify(req, res, next) {
  res.locals.openReportsCount = 0;
  try {
    // Only query when admin feature is present
    const [rows] = await db.pool.query("SELECT COUNT(*) AS cnt FROM admin_reports WHERE status = 'open'");
    if (rows && rows[0]) res.locals.openReportsCount = rows[0].cnt || 0;
  } catch (err) {
    // ignore if table missing
    res.locals.openReportsCount = 0;
  }
  next();
};
