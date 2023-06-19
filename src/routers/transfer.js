const express = require('express');
const router = express.Router();

const transferController = require('../controllers/transfer');

router.get('/', transferController.getAllTransfer);
router.get('/shop', transferController.getShopTransfer);
router.post('/', transferController.insertTransfer);
router.get('/detail/:transferId', transferController.getDetailTransfer);
router.get('/create', transferController.createTransfer);

module.exports = router;