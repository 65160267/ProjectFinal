const express = require('express');
const router = express.Router();
const exchangeController = require('../controllers/exchangeController');

// หน้าแสดงคำขอแลกเปลี่ยนที่ส่งมาหาฉัน
router.get('/incoming', exchangeController.getIncomingRequests);

// หน้าแสดงคำขอแลกเปลี่ยนที่ฉันส่งไป
router.get('/outgoing', exchangeController.getOutgoingRequests);

// ส่งคำขอแลกเปลี่ยน
router.post('/request/:bookId', exchangeController.sendRequest);

// ยืนยันการแลกเปลี่ยน (อนุมัติ)
router.post('/accept/:requestId', exchangeController.acceptRequest);

// ปฏิเสธการแลกเปลี่ยน
router.post('/reject/:requestId', exchangeController.rejectRequest);

// ยืนยันการแลกเปลี่ยนสำเร็จ
router.post('/complete/:requestId', exchangeController.completeExchange);

module.exports = router;