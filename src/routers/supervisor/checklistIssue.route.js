const express = require('express')
const router = express.Router()

const controller = require('../../controllers/supervisor/checklistIssue.controller')

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

router.get(
    '/:id',
    controller.getDetail
)

router.patch(
    '/:id/resolve',
    controller.resolve
)


module.exports = router