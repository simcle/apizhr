const express = require('express');
const router = express.Router();

const ReceiptsController = require('../controllers/receipts');

router.get('/', ReceiptsController.getAllReceipts);
router.get('/detail/:receiptsId', ReceiptsController.getDetail);
router.post('/', ReceiptsController.insertReceipts);

module.exports = router;