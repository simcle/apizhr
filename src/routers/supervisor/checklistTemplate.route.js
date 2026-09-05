const express = require('express')
const router = express.Router()

const controller = require('../../controllers/supervisor/checklistTemplate.controller')

const authenticate = require('../../../authenticate')
const authorize = require('../../middleware/authorize')

router.use(authenticate)
router.use(
    authorize(
        'admin',
        'supervisor'
    )
)


router.get(
    '/',
    controller.getList
)

router.post(
    '/',
    controller.create
)

router.patch(
    '/:id',
    controller.update
)

router.patch(
    '/:id/toggle',
    controller.toggle
)


module.exports = router