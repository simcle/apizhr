
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


/*
|--------------------------------------------------------------------------
| HISTORY
|--------------------------------------------------------------------------
*/

router.get(
    '/history',
    controller.getHistory
)


/*
|--------------------------------------------------------------------------
| REPORTING
|--------------------------------------------------------------------------
*/

router.get(
    '/report',
    controller.getReport
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


router.get(
    '/report/pdf',
    controller.downloadReportPdf
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
