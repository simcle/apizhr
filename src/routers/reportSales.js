const express = require('express')
const router = express.Router()

const reportSalesController = require('../controllers/reportSales')

router.get('/', reportSalesController.getSalesReport)
router.get('/shop', reportSalesController.getSalesShop)
module.exports = router