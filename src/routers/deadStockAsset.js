const router = require('express').Router()
const controller = require('../controllers/deadStockAsset')

router.get('/asset-summary', controller.getDeadStockAssetSummary)

module.exports = router


// GET /api/dead-stock/asset-summary
// GET /api/dead-stock/asset-summary?level=CRITICAL
// GET /api/dead-stock/asset-summary?date=2026-06-05