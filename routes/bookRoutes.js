const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const bookController = require('../controllers/bookController');

// prepare upload directory
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// multer setup for file uploads
const multer = require('multer');
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, uploadDir);
	},
	filename: function (req, file, cb) {
		// keep original name but prefix timestamp to avoid collisions
		const safeName = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
		cb(null, safeName);
	}
});
const upload = multer({ storage });

router.get('/', bookController.listBooks);
router.get('/mine', bookController.listUserBooks);
router.get('/new', bookController.showCreateForm);
// POST with multer middleware to handle file upload field named 'image'
router.post('/create', upload.single('image'), bookController.createBook);
router.get('/:id/edit', bookController.showEditForm);
router.post('/:id/edit', upload.single('image'), bookController.updateBook);
router.get('/:id', bookController.viewBook);

module.exports = router;
