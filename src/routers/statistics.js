const express = require('express');
const router = express.Router();

const statisticsController = require('../controllers/statistics');

router.get('/', statisticsController.getStats);
router.get('/items', statisticsController.getStatItems);
router.get('/receipts', statisticsController.getStatsReceipts);
router.get('/items/detail', statisticsController.detailItems);
router.get('/outlet', statisticsController.getOutletStats);
router.get('/out-of-stock', statisticsController.getOutOfStock);
router.get('/summary/:productId', statisticsController.getSummary);

module.exports = router;