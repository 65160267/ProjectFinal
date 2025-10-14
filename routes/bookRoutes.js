const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');

router.get('/', bookController.listBooks);
router.get('/new', bookController.showCreateForm);
router.post('/create', bookController.createBook);
router.get('/:id', bookController.viewBook);

module.exports = router;
