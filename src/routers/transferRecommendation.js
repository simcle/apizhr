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