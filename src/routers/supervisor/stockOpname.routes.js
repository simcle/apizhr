const express = require('express')
const router = express.Router()

const authenticate = require('../../../authenticate')
const authorize = require('../../middleware/authorize')

const controller = require('../../controllers/supervisor/stockOpname.controller')

router.use(
    authenticate,
    authorize('admin', 'supervisor')
)

router.get( '/summary', controller.getSummary)

router.get('/', controller.getSessions)

router.post('/', controller.createSession)

router.get('/:id', controller.getDetail)

router.post('/:id/generate', controller.generateItems)

router.get('/:id/items', controller.getItems)

router.post('/:id/generate-zero-count', controller.generateZeroCount)

router.post('/:id/post', controller.postBatch)

module.exports = router



// GET    /api/supervisor/stock-opnames
// POST   /api/supervisor/stock-opnames

// GET    /api/supervisor/stock-opnames/:id

// POST   /api/supervisor/stock-opnames/:id/generate
// GET    /api/supervisor/stock-opnames/:id/items

// POST   /api/supervisor/stock-opnames/:id/generate-zero-count
// POST   /api/supervisor/stock-opnames/:id/post