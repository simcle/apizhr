const express = require('express')
const router = express.Router()
const stockOrderContrller = require('../controllers/stockOrder')

router.get('/dashboard', stockOrderContrller.getStatistics)
router.get('/purchase', stockOrderContrller.getReport)
module.exports = router