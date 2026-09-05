const mongoose = require('mongoose')

const Shop = require('../../models/shops')
const DeadStockDaily = require('../../models/deadStockDaily')
const DeadStockAction = require('../../models/DeadStockAction')
const {
    getDeadStockReview
} = require('../../services/supervisor/deadStock.service')

const {
    createAction,
    getActions,
    cancelAction,
    getActionList
} = require('../../services/supervisor/deadStockAction.service')

async function getLatestSnapshotDate() {
    const latest = await DeadStockDaily
        .findOne({
            shopType: 'STORE'
        })
        .sort({
            date: -1
        })
        .select('date')
        .lean()

    return latest?.date || null
}

async function resolveDate(req) {
    if (req.query.date) {
        return req.query.date
    }

    return getLatestSnapshotDate()
}

async function validateStore(shopId) {
    if (!shopId) {
        return null
    }

    if (!mongoose.Types.ObjectId.isValid(shopId)) {
        const error = new Error(
            'ID toko tidak valid'
        )

        error.statusCode = 400

        throw error
    }

    const shop = await Shop
        .findOne({
            _id: shopId,
            type: 'STORE'
        })
        .select(
            '_id name type'
        )
        .lean()

    if (!shop) {
        const error = new Error(
            'Toko tidak ditemukan'
        )

        error.statusCode = 404

        throw error
    }

    return shop
}

function buildBaseMatch(
    date,
    shopId = null
) {
    const match = {
        date,
        shopType: 'STORE'
    }

    if (shopId) {
        match.shopId =
            new mongoose.Types.ObjectId(
                shopId
            )
    }

    return match
}

function handleError(res, error) {
    console.error(error)

    return res
        .status(
            error.statusCode || 500
        )
        .json({
            status: false,

            message:
                error.statusCode
                    ? error.message
                    : 'Terjadi kesalahan pada server'
        })
}


/*
|--------------------------------------------------------------------------
| SUMMARY
|--------------------------------------------------------------------------
*/

exports.getSummary = async (req, res) => {
    try {
        const date = await resolveDate(req)

        if (!date) {
            return res.status(200).json({
                status: true,

                data: {
                    date: null,
                    shop: null,

                    totalSku: 0,
                    totalStock: 0,
                    totalStockValue: 0,

                    levels: {
                        WARNING: {
                            totalSku: 0,
                            totalStock: 0,
                            totalStockValue: 0
                        },

                        SERIOUS: {
                            totalSku: 0,
                            totalStock: 0,
                            totalStockValue: 0
                        },

                        CRITICAL: {
                            totalSku: 0,
                            totalStock: 0,
                            totalStockValue: 0
                        }
                    },

                    actions: {
                        PROMO: {
                            totalSku: 0,
                            totalStock: 0,
                            totalStockValue: 0
                        },

                        DISCOUNT: {
                            totalSku: 0,
                            totalStock: 0,
                            totalStockValue: 0
                        },

                        CLEARANCE: {
                            totalSku: 0,
                            totalStock: 0,
                            totalStockValue: 0
                        }
                    }
                }
            })
        }

        const shop = await validateStore(
            req.query.shopId
        )

        const match = buildBaseMatch(
            date,
            shop?._id
        )

        const result = await DeadStockDaily.aggregate([
            {
                $match: match
            },

            {
                $facet: {
                    overall: [
                        {
                            $group: {
                                _id: null,

                                totalSku: {
                                    $sum: 1
                                },

                                totalStock: {
                                    $sum: '$stockOnHand'
                                },

                                totalStockValue: {
                                    $sum: '$stockValue'
                                }
                            }
                        }
                    ],

                    byLevel: [
                        {
                            $group: {
                                _id: '$deadLevel',

                                totalSku: {
                                    $sum: 1
                                },

                                totalStock: {
                                    $sum: '$stockOnHand'
                                },

                                totalStockValue: {
                                    $sum: '$stockValue'
                                }
                            }
                        }
                    ],

                    byAction: [
                        {
                            $group: {
                                _id: '$recommendedAction',

                                totalSku: {
                                    $sum: 1
                                },

                                totalStock: {
                                    $sum: '$stockOnHand'
                                },

                                totalStockValue: {
                                    $sum: '$stockValue'
                                }
                            }
                        }
                    ]
                }
            }
        ])

        const overall =
            result[0]?.overall?.[0] || {
                totalSku: 0,
                totalStock: 0,
                totalStockValue: 0
            }

        const levels = {
            WARNING: {
                totalSku: 0,
                totalStock: 0,
                totalStockValue: 0
            },

            SERIOUS: {
                totalSku: 0,
                totalStock: 0,
                totalStockValue: 0
            },

            CRITICAL: {
                totalSku: 0,
                totalStock: 0,
                totalStockValue: 0
            }
        }

        for (
            const item of
            result[0]?.byLevel || []
        ) {
            if (!levels[item._id]) {
                continue
            }

            levels[item._id] = {
                totalSku:
                    item.totalSku,

                totalStock:
                    item.totalStock,

                totalStockValue:
                    item.totalStockValue
            }
        }

        const actions = {
            PROMO: {
                totalSku: 0,
                totalStock: 0,
                totalStockValue: 0
            },

            DISCOUNT: {
                totalSku: 0,
                totalStock: 0,
                totalStockValue: 0
            },

            CLEARANCE: {
                totalSku: 0,
                totalStock: 0,
                totalStockValue: 0
            }
        }

        for (
            const item of
            result[0]?.byAction || []
        ) {
            if (!actions[item._id]) {
                continue
            }

            actions[item._id] = {
                totalSku:
                    item.totalSku,

                totalStock:
                    item.totalStock,

                totalStockValue:
                    item.totalStockValue
            }
        }

        return res.status(200).json({
            status: true,

            data: {
                date,
                shop,

                ...overall,

                levels,
                actions
            }
        })

    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}


/*
|--------------------------------------------------------------------------
| BY SHOP
|--------------------------------------------------------------------------
*/

exports.getByShop = async (req, res) => {
    try {
        const date = await resolveDate(req)

        if (!date) {
            return res.status(200).json({
                status: true,

                data: {
                    date: null,
                    shops: []
                }
            })
        }

        const rows = await DeadStockDaily.aggregate([
            {
                $match: {
                    date,
                    shopType: 'STORE'
                }
            },

            {
                $group: {
                    _id:
                        '$shopId',

                    shopName: {
                        $first:
                            '$shopName'
                    },

                    totalSku: {
                        $sum: 1
                    },

                    totalStock: {
                        $sum:
                            '$stockOnHand'
                    },

                    totalStockValue: {
                        $sum:
                            '$stockValue'
                    },

                    warning: {
                        $sum: {
                            $cond: [
                                {
                                    $eq: [
                                        '$deadLevel',
                                        'WARNING'
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },

                    serious: {
                        $sum: {
                            $cond: [
                                {
                                    $eq: [
                                        '$deadLevel',
                                        'SERIOUS'
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },

                    critical: {
                        $sum: {
                            $cond: [
                                {
                                    $eq: [
                                        '$deadLevel',
                                        'CRITICAL'
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            },

            {
                $sort: {
                    totalStockValue: -1
                }
            }
        ])

        const shops =
            rows.map(
                (row, index) => ({
                    rank:
                        index + 1,

                    shopId:
                        row._id,

                    shopName:
                        row.shopName,

                    totalSku:
                        row.totalSku,

                    totalStock:
                        row.totalStock,

                    totalStockValue:
                        row.totalStockValue,

                    warning:
                        row.warning,

                    serious:
                        row.serious,

                    critical:
                        row.critical
                })
            )

        return res.status(200).json({
            status: true,

            data: {
                date,
                shops
            }
        })

    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}


/*
|--------------------------------------------------------------------------
| TOP VALUE
|--------------------------------------------------------------------------
*/

exports.getTopValue = async (req, res) => {
    try {
        const date = await resolveDate(req)

        if (!date) {
            return res.status(200).json({
                status: true,

                data: {
                    date: null,
                    shop: null,
                    items: []
                }
            })
        }

        const shop = await validateStore(
            req.query.shopId
        )

        const match = buildBaseMatch(
            date,
            shop?._id
        )

        const allowedLevels = [
            'WARNING',
            'SERIOUS',
            'CRITICAL'
        ]

        if (
            req.query.level &&
            allowedLevels.includes(
                req.query.level
            )
        ) {
            match.deadLevel =
                req.query.level
        }

        let limit =
            Number(req.query.limit) ||
            10

        if (limit < 1) {
            limit = 10
        }

        if (limit > 100) {
            limit = 100
        }

        const items = await DeadStockDaily
            .find(match)
            .sort({
                stockValue: -1,
                daysNoSale: -1
            })
            .limit(limit)
            .select({
                date: 1,
                shopId: 1,
                shopName: 1,
                productId: 1,
                parentId: 1,
                sku: 1,
                name: 1,
                stockOnHand: 1,
                ads: 1,
                lastSoldDate: 1,
                daysNoSale: 1,
                lifetimeQtySold: 1,
                unitCost: 1,
                stockValue: 1,
                deadLevel: 1,
                recommendedAction: 1,
                message: 1
            })
            .lean()

        return res.status(200).json({
            status: true,

            data: {
                date,
                shop,
                items
            }
        })

    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}


/*
|--------------------------------------------------------------------------
| LIST
|--------------------------------------------------------------------------
*/

exports.getList = async (req, res) => {
    try {
        const date = await resolveDate(req)

        if (!date) {
            return res.status(200).json({
                status: true,

                data: {
                    date: null,
                    shop: null,
                    items: [],

                    pagination: {
                        page: 1,
                        limit: 25,
                        total: 0,
                        pages: 0
                    }
                }
            })
        }

        const shop = await validateStore(
            req.query.shopId
        )

        const match = buildBaseMatch(
            date,
            shop?._id
        )

        const allowedLevels = [
            'WARNING',
            'SERIOUS',
            'CRITICAL'
        ]

        const allowedActions = [
            'PROMO',
            'DISCOUNT',
            'CLEARANCE'
        ]

        if (
            req.query.level &&
            allowedLevels.includes(
                req.query.level
            )
        ) {
            match.deadLevel =
                req.query.level
        }

        if (
            req.query.action &&
            allowedActions.includes(
                req.query.action
            )
        ) {
            match.recommendedAction =
                req.query.action
        }

        const search =
            String(
                req.query.search || ''
            ).trim()

        if (search) {
            const escapedSearch =
                search.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    '\\$&'
                )

            match.$or = [
                {
                    sku: {
                        $regex:
                            escapedSearch,

                        $options:
                            'i'
                    }
                },

                {
                    name: {
                        $regex:
                            escapedSearch,

                        $options:
                            'i'
                    }
                },

                {
                    shopName: {
                        $regex:
                            escapedSearch,

                        $options:
                            'i'
                    }
                }
            ]
        }

        let page =
            Number(req.query.page) ||
            1

        let limit =
            Number(req.query.limit) ||
            25

        if (page < 1) {
            page = 1
        }

        if (limit < 1) {
            limit = 25
        }

        if (limit > 100) {
            limit = 100
        }

        const skip =
            (page - 1) *
            limit

        const [
            items,
            total
        ] = await Promise.all([
            DeadStockDaily
                .find(match)
                .sort({
                    stockValue: -1,
                    daysNoSale: -1
                })
                .skip(skip)
                .limit(limit)
                .select({
                    date: 1,
                    shopId: 1,
                    shopName: 1,
                    productId: 1,
                    parentId: 1,
                    sku: 1,
                    name: 1,
                    stockOnHand: 1,
                    ads: 1,
                    lastSoldDate: 1,
                    daysNoSale: 1,
                    lifetimeQtySold: 1,
                    unitCost: 1,
                    stockValue: 1,
                    deadLevel: 1,
                    recommendedAction: 1,
                    message: 1
                })
                .lean(),

            DeadStockDaily
                .countDocuments(
                    match
                )
        ])

        const deadStockIds = items.map(item => item._id)

        const actionRows = await DeadStockAction
            .find({
                deadStockId: {
                    $in: deadStockIds
                },
                status: {
                    $ne: 'CANCELLED'
                }
            })
            .sort({
                createdAt: -1
            })
            .select({
                deadStockId: 1,
                actionType: 1,
                qty: 1,
                status: 1,
                createdAt: 1
            })
            .lean()

        const actionMap = new Map()

        for (const action of actionRows) {
            const key = String(action.deadStockId)

            if (!actionMap.has(key)) {
                actionMap.set(key, action)
            }
        }

        const resultItems = items.map(item => {
            const activeAction =
                actionMap.get(String(item._id)) ||
                null

            return {
                ...item,

                actionStatus:
                    activeAction?.status ||
                    'NONE',

                activeAction
            }
        })

        return res.status(200).json({
            status: true,

            data: {
                date,
                shop,
                items: resultItems,

                pagination: {
                    page,
                    limit,
                    total,

                    pages:
                        Math.ceil(
                            total / limit
                        )
                }
            }
        })

    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}


/*
|--------------------------------------------------------------------------
| ACTION WORKFLOW
|--------------------------------------------------------------------------
*/


exports.getReview = async (req, res) => {
    try {
        const result =
            await getDeadStockReview(
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


exports.createAction = async (req, res) => {
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

        const result =
            await createAction({
                deadStockId:
                    req.params.id,

                actionType:
                    req.body.actionType,

                notes:
                    req.body.notes,

                userId
            })

        return res.status(201).json({
            status: true,

            message:
                'Tindakan Dead Stock berhasil disimpan',

            data:
                result
        })

    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}


exports.getActions = async (req, res) => {
    try {
        const result =
            await getActions(
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


exports.cancelAction = async (req, res) => {
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

        const result =
            await cancelAction({
                actionId:
                    req.params.actionId,

                notes:
                    req.body.notes,

                userId
            })

        return res.status(200).json({
            status: true,

            message:
                'Tindakan Dead Stock berhasil dibatalkan',

            data:
                result
        })

    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}

exports.getActionList = async (req, res) => {
    try {
        const result = await getActionList({
            shopId: req.query.shopId,
            actionType: req.query.actionType,
            status: req.query.status,
            level: req.query.level,
            search: req.query.search,
            page: req.query.page,
            limit: req.query.limit
        })

        return res.status(200).json({
            status: true,
            data: result
        })
    } catch (error) {
        return handleError(res, error)
    }
}