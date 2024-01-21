const express = require('express')
const router = express.Router()

const reportController = require('../controllers/report')

router.get('/', reportController.getDashboard);
router.get('/statistic-offline', reportController.getStatisticsOffline)

module.exports = router