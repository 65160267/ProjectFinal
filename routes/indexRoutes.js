const express = require('express');
const router = express.Router();
const indexController = require('../controllers/indexController');
const userController = require('../controllers/userController');
const newChatController = require('../controllers/newChatController');
const path = require('path');
const fs = require('fs');
// multer setup for profile uploads
const multer = require('multer');
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, uploadDir),
	filename: (req, file, cb) => {
		const safe = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-\_]/g, '_');
		cb(null, safe);
	}
});
const upload = multer({ storage });
router.get('/', indexController.getProducts);
// also expose /exchange explicitly so GET /exchange works
router.get('/exchange', indexController.getProducts);
router.get('/marketplace', indexController.marketplace);
router.get('/dashboard', indexController.dashboard);
router.get('/user', userController.profile);
router.get('/user/edit', userController.edit);
// public user profile
router.get('/users/:id', userController.viewPublic);
router.get('/messages', newChatController.inbox);
// (chat demo route removed — chat system replaced)
// attach multer middleware to handle avatar file upload (field name: avatar)
router.post('/user/edit', upload.single('avatar'), userController.update);

module.exports = router;
