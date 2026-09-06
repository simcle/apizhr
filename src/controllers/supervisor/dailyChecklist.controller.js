const {
    getDailyOverview,
    getHistory,
    getChecklistDetail,
    getChecklistByShopAndDate,
    startChecklist,
    updateChecklistItem,
    completeChecklist
} = require('../../services/supervisor/dailyChecklist.service')


function handleError(res, error) {
    console.error(error)

    return res.status(
        error.statusCode || 500
    ).json({
        status: false,
        message:
            error.statusCode
                ? error.message
                : 'Terjadi kesalahan pada server'
    })
}


/*
 * GET /api/supervisor/daily-checklist
 *
 * Query:
 * ?date=2026-09-05
 */
exports.getOverview = async (req, res) => {
    try {
        const result = await getDailyOverview({
            date: req.query.date || null
        })

        return res.status(200).json({
            status: true,
            data: result
        })
    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}


/*
 * GET /api/supervisor/daily-checklist/shop/:shopId
 *
 * Query:
 * ?date=2026-09-05
 */
exports.getByShop = async (req, res) => {
    try {
        const result = await getChecklistByShopAndDate({
            shopId: req.params.shopId,
            date: req.query.date || null
        })

        return res.status(200).json({
            status: true,
            data: result
        })
    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}


/*
 * GET /api/supervisor/daily-checklist/:id
 */
exports.getDetail = async (req, res) => {
    try {
        const result = await getChecklistDetail(
            req.params.id
        )

        return res.status(200).json({
            status: true,
            data: result
        })
    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}


/*
 * POST /api/supervisor/daily-checklist/:id/start
 */
exports.start = async (req, res) => {
    try {
        const userId =
            req.user?._id ||
            null

        if (!userId) {
            return res.status(401).json({
                status: false,
                message: 'User tidak valid'
            })
        }

        const result = await startChecklist({
            checklistId: req.params.id,
            userId
        })

        return res.status(200).json({
            status: true,
            message: 'Checklist berhasil dimulai',
            data: result
        })
    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}


/*
 * PATCH /api/supervisor/daily-checklist/:id/items/:itemId
 *
 * Body:
 *
 * {
 *     "result": "OK",
 *     "notes": ""
 * }
 *
 * result:
 * OK | ISSUE | NA
 */
exports.updateItem = async (req, res) => {
    try {
        const userId =
            req.user?._id ||
            null

        if (!userId) {
            return res.status(401).json({
                status: false,
                message: 'User tidak valid'
            })
        }

        const result = await updateChecklistItem({
            checklistId: req.params.id,
            itemId: req.params.itemId,
            result: req.body.result,
            notes: req.body.notes,
            userId
        })

        return res.status(200).json({
            status: true,
            message: 'Item checklist berhasil diperbarui',
            data: result
        })
    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}


/*
 * POST /api/supervisor/daily-checklist/:id/complete
 *
 * Body:
 *
 * {
 *     "notes": "Catatan umum checklist"
 * }
 */
exports.complete = async (req, res) => {
    try {
        const userId =
            req.user?._id ||
            null

        if (!userId) {
            return res.status(401).json({
                status: false,
                message: 'User tidak valid'
            })
        }

        const result = await completeChecklist({
            checklistId: req.params.id,
            notes: req.body.notes,
            userId
        })

        return res.status(200).json({
            status: true,
            message: 'Checklist berhasil diselesaikan',
            data: result
        })
    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}

exports.getHistory = async (req, res) => {
    try {
        const result = await getHistory({
            startDate: req.query.startDate || null,
            endDate: req.query.endDate || null,
            shopId: req.query.shopId || null
        })

        return res.status(200).json({
            status: true,
            data: result
        })
    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}
