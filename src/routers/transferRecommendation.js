const express = require('express')

const router = express.Router()

const controller =
  require('../controllers/transferRecommendation')

router.get(
  '/',
  controller.getTransfers
)

router.get(
  '/summary',
  controller.getTransferSummary
)

router.get(
  '/:id',
  controller.getTransferDetail
)

module.exports = router


// GET /api/transfer-recommendation
// GET /api/transfer-recommendation?page=1&limit=20
// GET /api/transfer-recommendation?sourceShopId=xxx
// GET /api/transfer-recommendation?targetShopId=xxx
// GET /api/transfer-recommendation?search=kalista
// GET /api/transfer-recommendation/summary
// GET /api/transfer-recommendation/685.......