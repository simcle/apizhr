const express = require('express')
const router = express.Router()

const storeOperationalCashController = require('../controllers/storeOperationalCash')

router.get('/shop/:shopId', storeOperationalCashController.getCashByShop),
router.get('/shop/:shopId/transactions', storeOperationalCashController.getTransactions)
router.get('/shop/:shopId/summary', storeOperationalCashController.getSummary),
// topup dana
router.post('/shop/:shopId/funds', storeOperationalCashController.addFunds)
router.get('/shop', storeOperationalCashController.getReport)
router.get('/shop/range/operational', storeOperationalCashController.getPengeluaranByRange)

module.exports = router
