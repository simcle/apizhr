// routes/stockOpnameV2.routes.js
const router = require('express').Router()
const invController = require('../controllers/inventory')
const controller = require('../controllers/stockOpnameV2.controller')

router.get('/summary', invController.getInvSummary)

router.post('/', controller.createSession)
router.get('/', controller.getSessions)
router.get('/:id', controller.getDetail)

router.post('/:id/generate', controller.generateItems)

router.get('/:id/items', controller.getItems)
router.post('/:id/post', controller.postBatch)

// moblie

router.get('/mobile/summary',controller.getMobileSummary)
router.post('/mobile/scan', controller.scanItem)
router.patch('/mobile/item/:id', controller.updateCounted)

module.exports = router

// topology
// create session => Generate items => Status = Counting

// POST /api/stock-opname-v2/ID_STOCK_OPNAME/generate

// GET /api/stock-opname-v2/STOCK_OPNAME_ID/items
// GET /api/stock-opname-v2/STOCK_OPNAME_ID/items?page=1&limit=100
// GET /api/stock-opname-v2/STOCK_OPNAME_ID/items?search=kalista
// GET /api/stock-opname-v2/STOCK_OPNAME_ID/items?countStatus=NOT_COUNTED
// GET /api/stock-opname-v2/STOCK_OPNAME_ID/items?onlyDifference=true