const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Apply admin middleware to all routes
router.use(adminController.requireAdmin);

// Admin routes
router.get('/', adminController.dashboard);
router.get('/dashboard', adminController.dashboard);
router.get('/users', adminController.users);
router.get('/books', adminController.books);
router.get('/exchanges', adminController.exchanges);
router.get('/settings', adminController.settings);
router.post('/books/assign-orphans', adminController.assignOrphansToAdmin);
router.get('/reports', adminController.reports);
router.post('/reports', adminController.createReport);
router.post('/reports/:id/resolve', adminController.resolveReport);

// API routes for admin actions
router.delete('/api/users/:id', adminController.deleteUser);
router.post('/api/users/:id/toggle-status', adminController.toggleUserStatus);
router.delete('/api/books/:id', adminController.deleteBook);

module.exports = router;