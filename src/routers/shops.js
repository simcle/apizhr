const express = require('express');
const router = express.Router();

const shopController = require('../controllers/shops');

router.get('/shops', shopController.getShops);
router.post('/shops', shopController.postShop);
router.put('/shops', shopController.putShop);
router.get('/shops/byid', shopController.getShopById);

module.exports = router;