const express = require('express')
const router = express.Router()

const controller = require(
    '../../controllers/supervisor/inventory.controller'
)

const authenticate = require(
    '../../../authenticate'
)

const authorize = require(
    '../../middleware/authorize'
)

router.use(authenticate)

router.use(
    authorize(
        'admin',
        'supervisor'
    )
)

router.get(
    '/summary',
    controller.getSummary
)

router.get(
    '/by-shop',
    controller.getByShop
)

router.get(
    '/priority',
    controller.getPriority
)

router.get(
    '/supply-plan/:shopId',
    controller.getSupplyPlan
)

router.get(
    '/:id/replenishment',
    controller.getReplenishment
)

router.get(
    '/',
    controller.getList
)

module.exports = router