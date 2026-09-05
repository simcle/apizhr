const express = require('express')
const router = express.Router()

const authenticate = require('../../../authenticate')
const authorize = require('../../middleware/authorize')

const controller = require('../../controllers/supervisor/shop.controller')

router.use(
    authenticate,
    authorize('admin', 'supervisor')
)

router.get(
    '/',
    controller.getStores
)

module.exports = router