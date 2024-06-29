const express = require('express')
const router = express.Router()

const reportController = require('../controllers/report')

router.get('/', reportController.getDashboard);
router.get('/statistic-offline', reportController.getStatisticsOffline)
router.get('/statistic-online', reportController.getStatisticsOnline);
router.get('/statistic-yearly', reportController.getStatisticsOneYear);
router.get('/best-seller', reportController.getBestSeller);
router.get('/detail/:sku', reportController.getDetailProduct);
router.get('/best-category', reportController.getCategorySales);

module.exports = router