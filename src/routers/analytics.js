const express = require('express');
const router = express.Router();

const analyticsController = require('../controllers/analytics');

router.get('/categories', analyticsController.getCategories);
router.get('/products', analyticsController.getProducts);
router.get('/products/detail', analyticsController.detailProducts);
router.get('/products/sku', analyticsController.getAnalyticSKU)


module.exports = router;