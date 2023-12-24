const express = require('express');
const router = express.Router();

const analyticsController = require('../controllers/analytics');

router.get('/categories', analyticsController.getCategories);
router.get('/shops', analyticsController.getShop)
router.get('/products', analyticsController.getProducts);
router.get('/products/detail', analyticsController.detailProducts);
router.get('/products/sku', analyticsController.getAnalyticSKU)
router.get('/products/consumptive', analyticsController.getProductKonsumtif);
router.get('/products/task-so', analyticsController.taskStockOpname);

module.exports = router;