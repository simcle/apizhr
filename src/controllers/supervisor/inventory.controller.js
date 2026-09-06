const mongoose = require('mongoose')

const Shop = require('../../models/shops')
const InventoryIntelDaily = require('../../models/InventoryIntelDaily')
const { getReplenishmentPlan } = require('../../services/supervisor/replenishment.service')
const { buildSupplyPlan } = require('../../services/supervisor/supplyPlan.service')


async function getLatestSnapshotDate() {
    const latest = await InventoryIntelDaily
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
        const date = String(req.query.date).trim()

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const error = new Error(
                'Format tanggal tidak valid'
            )

            error.statusCode = 400

            throw error
        }

        return date
    }

    return getLatestSnapshotDate()
}


async function validateStore(shopId) {
    if (!shopId) return null

    if (
        !mongoose.Types.ObjectId.isValid(
            shopId
        )
    ) {
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
            error.statusCode ||
            500
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
 * GET /api/supervisor/inventory/summary
 *
 * Query:
 * ?date=
 * ?shopId=
 */
exports.getSummary = async (req, res) => {
    try {
        const date =
            await resolveDate(req)

        if (!date) {
            return res.status(200).json({
                status: true,

                data: {
                    date: null,
                    shop: null,

                    totalSku: 0,
                    totalStock: 0,

                    statuses: {
                        AMAN: 0,
                        WASPADA: 0,
                        SIAGA: 0,
                        AWAS: 0
                    },

                    actions: {
                        TRANSFER: 0,
                        ORDER: 0,
                        PRODUKSI: 0
                    },

                    totalRecommendedQty: 0
                }
            })
        }

        const shop =
            await validateStore(
                req.query.shopId
            )

        const match =
            buildBaseMatch(
                date,
                shop?._id
            )

        const result =
            await InventoryIntelDaily.aggregate([
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
                                        $sum:
                                            '$stockOnHand'
                                    },

                                    totalRecommendedQty: {
                                        $sum:
                                            '$recommendedQty'
                                    }
                                }
                            }
                        ],

                        byStatus: [
                            {
                                $group: {
                                    _id:
                                        '$status',

                                    total: {
                                        $sum: 1
                                    }
                                }
                            }
                        ],

                        byAction: [
                            {
                                $match: {
                                    action: {
                                        $ne:
                                            'NO_ACTION'
                                    }
                                }
                            },

                            {
                                $group: {
                                    _id:
                                        '$action',

                                    total: {
                                        $sum: 1
                                    },

                                    recommendedQty: {
                                        $sum:
                                            '$recommendedQty'
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
                totalRecommendedQty: 0
            }

        const statuses = {
            AMAN: 0,
            WASPADA: 0,
            SIAGA: 0,
            AWAS: 0
        }

        for (
            const item of
            result[0]?.byStatus || []
        ) {
            if (
                statuses[item._id] ===
                undefined
            ) {
                continue
            }

            statuses[item._id] =
                item.total
        }

        const actions = {
            TRANSFER: {
                totalSku: 0,
                recommendedQty: 0
            },

            ORDER: {
                totalSku: 0,
                recommendedQty: 0
            },

            PRODUKSI: {
                totalSku: 0,
                recommendedQty: 0
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
                    item.total,

                recommendedQty:
                    item.recommendedQty
            }
        }

        return res.status(200).json({
            status: true,

            data: {
                date,
                shop,

                totalSku:
                    overall.totalSku,

                totalStock:
                    overall.totalStock,

                totalRecommendedQty:
                    overall.totalRecommendedQty,

                statuses,
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
 * GET /api/supervisor/inventory/by-shop
 *
 * Ranking kondisi inventory seluruh STORE.
 *
 * Query:
 * ?date=
 */
exports.getByShop = async (req, res) => {
    try {
        const date =
            await resolveDate(req)

        if (!date) {
            return res.status(200).json({
                status: true,

                data: {
                    date: null,
                    shops: []
                }
            })
        }

        const rows =
            await InventoryIntelDaily.aggregate([
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

                        totalSku: {
                            $sum: 1
                        },

                        totalStock: {
                            $sum:
                                '$stockOnHand'
                        },

                        aman: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$status',
                                            'AMAN'
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },

                        waspada: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$status',
                                            'WASPADA'
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },

                        siaga: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$status',
                                            'SIAGA'
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },

                        awas: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$status',
                                            'AWAS'
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },

                        recommendedQty: {
                            $sum:
                                '$recommendedQty'
                        },

                        averagePriority: {
                            $avg:
                                '$priorityScore'
                        }
                    }
                },

                {
                    $lookup: {
                        from:
                            Shop.collection.name,

                        localField:
                            '_id',

                        foreignField:
                            '_id',

                        as:
                            'shop'
                    }
                },

                {
                    $unwind:
                        '$shop'
                },

                {
                    $project: {
                        _id: 0,

                        shopId:
                            '$_id',

                        shopName:
                            '$shop.name',

                        totalSku: 1,
                        totalStock: 1,

                        aman: 1,
                        waspada: 1,
                        siaga: 1,
                        awas: 1,

                        recommendedQty: 1,

                        averagePriority: {
                            $round: [
                                '$averagePriority',
                                4
                            ]
                        }
                    }
                },

                /*
                 * Toko paling bermasalah muncul
                 * terlebih dahulu.
                 */
                {
                    $sort: {
                        awas: -1,
                        siaga: -1,
                        waspada: -1,
                        averagePriority: -1
                    }
                }
            ])

        const shops =
            rows.map(
                (row, index) => ({
                    rank:
                        index + 1,

                    ...row
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
 * GET /api/supervisor/inventory/priority
 *
 * SKU yang paling membutuhkan perhatian.
 *
 * Query:
 * ?date=
 * ?shopId=
 * ?limit=20
 */
exports.getPriority = async (req, res) => {
    try {
        const date =
            await resolveDate(req)

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

        const shop =
            await validateStore(
                req.query.shopId
            )

        const match =
            buildBaseMatch(
                date,
                shop?._id
            )

        /*
         * AMAN tidak perlu masuk priority.
         */
        match.status = {
            $ne: 'AMAN'
        }

        let limit =
            Number(
                req.query.limit
            ) || 20

        if (limit < 1) {
            limit = 20
        }

        if (limit > 100) {
            limit = 100
        }

        const items =
            await InventoryIntelDaily
                .find(match)
                .sort({
                    priorityScore: -1,
                    recommendedQty: -1
                })
                .limit(limit)
                .select({
                    date: 1,
                    shopId: 1,
                    productId: 1,
                    sku: 1,

                    stockOnHand: 1,
                    warehouseStockOnHand: 1,

                    sumSoldWindow: 1,
                    ads: 1,
                    daysOfCover: 1,

                    rop: 1,

                    status: 1,
                    action: 1,

                    recommendedQty: 1,
                    priorityScore: 1,
                    reasons: 1
                })
                .populate(
                    'shopId',
                    'name type'
                )
                .populate(
                    'productId',
                    'name sku'
                )
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
 * GET /api/supervisor/inventory
 *
 * Query:
 *
 * ?date=
 * ?shopId=
 * ?status=
 * ?action=
 * ?search=
 * ?page=1
 * ?limit=25
 */
exports.getList = async (req, res) => {
    try {
        const date =
            await resolveDate(req)

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

        const shop =
            await validateStore(
                req.query.shopId
            )

        const match =
            buildBaseMatch(
                date,
                shop?._id
            )

        const allowedStatuses = [
            'AMAN',
            'WASPADA',
            'SIAGA',
            'AWAS'
        ]

        const allowedActions = [
            'NO_ACTION',
            'TRANSFER',
            'ORDER',
            'PRODUKSI'
        ]

        if (
            req.query.status &&
            allowedStatuses.includes(
                req.query.status
            )
        ) {
            match.status =
                req.query.status
        }

        if (
            req.query.action &&
            allowedActions.includes(
                req.query.action
            )
        ) {
            match.action =
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

            match.sku = {
                $regex:
                    escapedSearch,

                $options:
                    'i'
            }
        }

        let page =
            Number(
                req.query.page
            ) || 1

        let limit =
            Number(
                req.query.limit
            ) || 25

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
            InventoryIntelDaily
                .find(match)
                .sort({
                    priorityScore: -1,
                    recommendedQty: -1
                })
                .skip(skip)
                .limit(limit)
                .select({
                    date: 1,

                    shopId: 1,
                    productId: 1,
                    sku: 1,

                    stockOnHand: 1,
                    warehouseStockOnHand: 1,

                    windowDays: 1,
                    sumSoldWindow: 1,
                    ads: 1,
                    daysOfCover: 1,

                    leadTimeDays: 1,
                    safetyDays: 1,
                    rop: 1,

                    status: 1,
                    action: 1,
                    recommendedQty: 1,
                    priorityScore: 1,

                    reasons: 1
                })
                .populate(
                    'shopId',
                    'name type'
                )
                .populate(
                    'productId',
                    'name sku'
                )
                .lean(),

            InventoryIntelDaily
                .countDocuments(
                    match
                )
        ])

        return res.status(200).json({
            status: true,

            data: {
                date,
                shop,
                items,

                pagination: {
                    page,
                    limit,
                    total,

                    pages:
                        Math.ceil(
                            total /
                            limit
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

exports.getReplenishment = async (req, res) => {
    try {
        const result =
            await getReplenishmentPlan(
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

exports.getSupplyPlan = async (req, res) => {
    try {
        const result =
            await buildSupplyPlan({
                shopId:
                    req.params.shopId,

                date:
                    req.query.date ||
                    null,

                status:
                    req.query.status ||
                    null
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