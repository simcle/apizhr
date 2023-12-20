const express = require('express');
const router = express.Router();

const analyticsController = require('../controllers/analytics');

router.get('/categories', analyticsController.getCategories);
router.get('/products', analyticsController.getProducts);
router.get('/products/detail', analyticsController.detailProducts);


module.exports = router;