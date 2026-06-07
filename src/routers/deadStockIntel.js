const router = require('express').Router()
const ctrl = require('../controllers/deadStockIntel')

router.get('/variants', ctrl.getVariantDeadStock)
router.get('/summary', ctrl.getDeadStockSummary)
module.exports = router

// GET /dead-stock-intel/variants?shopId=ID_TOKO
// GET /dead-stock-intel/variants?level=CRITICAL
// GET /dead-stock-intel/variants?shopId=ID_TOKO&level=SERIOUS&limit=50

// GET /api/dead-stock/summary
// GET /api/dead-stock/summary?shopId=ID_TOKO