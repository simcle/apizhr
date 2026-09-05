const express = require('express')
const router = express.Router()

const controller = require('../../controllers/supervisor/deadStock.controller')

const authenticate = require('../../../authenticate')
const authorize = require('../../middleware/authorize')

router.use(authenticate)

router.use(
    authorize(
        'admin',
        'supervisor'
    )
)


/*
|--------------------------------------------------------------------------
| SUMMARY
|--------------------------------------------------------------------------
*/

router.get(
    '/summary',
    controller.getSummary
)

router.get(
    '/by-shop',
    controller.getByShop
)

router.get(
    '/top-value',
    controller.getTopValue
)


/*
|--------------------------------------------------------------------------
| ACTION
|--------------------------------------------------------------------------
*/

router.get(
    '/actions',
    controller.getActionList
)

router.patch(
    '/actions/:actionId/cancel',
    controller.cancelAction
)
/*
|--------------------------------------------------------------------------
| REVIEW
|--------------------------------------------------------------------------
*/

router.get(
    '/:id/review',
    controller.getReview
)

router.get(
    '/:id/actions',
    controller.getActions
)

router.post(
    '/:id/actions',
    controller.createAction
)


/*
|--------------------------------------------------------------------------
| LIST
|--------------------------------------------------------------------------
*/

router.get(
    '/',
    controller.getList
)

module.exports = router