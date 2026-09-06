const express = require('express')
const router = express.Router()

const controller = require('../../controllers/supervisor/dailyChecklist.controller')

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
| OVERVIEW
|--------------------------------------------------------------------------
*/

router.get(
    '/',
    controller.getOverview
)


/*
|--------------------------------------------------------------------------
| BY SHOP
|--------------------------------------------------------------------------
*/

router.get(
    '/shop/:shopId',
    controller.getByShop
)

router.get(
    '/history',
    controller.getHistory
)

/*
|--------------------------------------------------------------------------
| DETAIL
|--------------------------------------------------------------------------
*/

router.get(
    '/:id',
    controller.getDetail
)


/*
|--------------------------------------------------------------------------
| ACTION
|--------------------------------------------------------------------------
*/

router.post(
    '/:id/start',
    controller.start
)

router.patch(
    '/:id/items/:itemId',
    controller.updateItem
)

router.post(
    '/:id/complete',
    controller.complete
)


module.exports = router