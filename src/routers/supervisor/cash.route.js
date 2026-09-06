const express = require('express')
const router = express.Router()

const controller = require(
    '../../controllers/supervisor/cash.controller'
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
    '/expense-report',
    controller.getExpenseReport
)

router.get(
    '/overview',
    controller.getOverview
)

router.get(
    '/expenses',
    controller.getExpenses
)

router.get(
    '/transactions',
    controller.getTransactions
)

module.exports = router