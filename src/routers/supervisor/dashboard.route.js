const express = require('express')
const router = express.Router()

const controller = require(
    '../../controllers/supervisor/dashboard.controller'
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
    '/',
    controller.getDashboard
)

module.exports = router