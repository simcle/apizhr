const express = require('express');
const router = express.Router();

const shopController = require('../controllers/shops');

router.get('/shops', shopController.getShops);
router.post('/shops', shopController.postShop);
router.put('/shops', shopController.putShop);

module.exports = router;