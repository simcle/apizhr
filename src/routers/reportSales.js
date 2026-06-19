const express = require('express')
const router = express.Router()

const reportSalesController = require('../controllers/reportSales')

router.get('/', reportSalesController.getSalesReport)

module.exports = router