const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const bookController = require('../controllers/bookController');

// prepare upload directory
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, uploadDir),
	filename: (req, file, cb) => {
		const ext = path.extname(file.originalname);
		const name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
		cb(null, name);
	}
});

const upload = multer({ storage });

router.get('/', bookController.listBooks);
router.get('/new', bookController.showCreateForm);
// handle multipart form with multer to populate req.body and req.file
router.post('/create', upload.single('image'), bookController.createBook);
router.get('/:id', bookController.viewBook);

module.exports = router;
