const router = require('express').Router()

const controller = require('../controllers/purchasingPlan')

router.get(
  '/summary',
  controller.getSummary
)

router.get(
  '/list',
  controller.getList
)

router.get(
  '/actions',
  controller.getActions
)

router.get(
  '/top-priority',
  controller.getTopPriority
)

module.exports = router

// GET /api/purchasing-plan/summary?date=2026-06-05
// GET /api/purchasing-plan/list?date=2026-06-05
// GET /api/purchasing-plan/list?date=2026-06-05&flow=Receipts
// GET /api/purchasing-plan/top-priority?date=2026-06-05