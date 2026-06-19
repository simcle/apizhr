const router = require('express').Router()
const ctrl = require('../controllers/deadStockIntel')

router.get('/variants', ctrl.getVariantDeadStock)
router.get('/summary', ctrl.getDeadStockSummary)
router.get('/top-value', ctrl.getDeadStockTopValue)
router.get('/by-shop', ctrl.getDeadStockByShop)
router.get('/actions', ctrl.getDeadStockActions)
router.get('/global', ctrl.getGlobalDeadStock)
module.exports = router

// GET /dead-stock-intel/variants?shopId=ID_TOKO
// GET /dead-stock-intel/variants?level=CRITICAL
// GET /dead-stock-intel/variants?shopId=ID_TOKO&level=SERIOUS&limit=50

// GET /api/dead-stock-intel/summary
// GET /api/dead-stock-intel/summary?shopId=ID_TOKO


// GET /api/dead-stock-intel/top-value
// GET /api/dead-stock-intel/top-value?limit=20
// GET /api/dead-stock-intel/top-value?shopId=ID_TOKO
// GET /api/dead-stock-intel/top-value?level=CRITICAL

// GET /api/dead-stock-intel/by-shop
// GET /api/dead-stock-intel/by-shop?level=CRITICAL


// GET /api/dead-stock-intel/actions
// GET /api/dead-stock-intel/actions?action=PROMO
// GET /api/dead-stock-intel/actions?action=DISCOUNT
// GET /api/dead-stock-intel/actions?action=CLEARANCE
// GET /api/dead-stock-intel/actions?action=CLEARANCE&page=1&limit=20
// GET /api/dead-stock-intel/actions?shopId=ID_TOKO&action=PROMO


// GET /api/dead-stock-intel/global
// GET /api/dead-stock-intel/global?level=CRITICAL
// GET /api/dead-stock-intel/global?search=11935