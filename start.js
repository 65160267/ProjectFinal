// start.js — CommonJS wrapper to require server.js and start app
try {
  const serverModule = require('./server');
  // server.js starts the server; export app for compatibility
  module.exports = serverModule.app;
} catch (err) {
  console.error('Failed to start server from start.js:', err);
  throw err;
}
