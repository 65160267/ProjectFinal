const express = require('express');
const router = express.Router();
const indexController = require('../controllers/indexController');
const userController = require('../controllers/userController');
router.get('/', indexController.getProducts);
// also expose /exchange explicitly so GET /exchange works
router.get('/exchange', indexController.getProducts);
router.get('/marketplace', indexController.marketplace);
router.get('/dashboard', indexController.dashboard);
router.get('/user', userController.profile);

module.exports = router;
