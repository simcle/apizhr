const mongoose = require('mongoose')

const Shop = require('../../models/shops')
const StoreOperationalCash = require('../../models/StoreOperationalCash')
const StoreOperationalCashTransaction = require('../../models/StoreOperationalCashTransaction')
const Pengeluaran = require('../../models/pengeluaran')


function createError(message, statusCode = 400) {
    const error = new Error(message)
    error.statusCode = statusCode

    return error
}


function validateDate(value) {
    const date = String(value || '').trim()

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw createError(
            'Format tanggal tidak valid',
            400
        )
    }

    return date
}


function getDateWIB() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date())
}


function getDateRange({
    start = null,
    end = null
} = {}) {
    const today = getDateWIB()

    const startDate =
        start
            ? validateDate(start)
            : today

    const endDate =
        end
            ? validateDate(end)
            : today

    if (startDate > endDate) {
        throw createError(
            'Tanggal awal tidak boleh lebih besar dari tanggal akhir',
            400
        )
    }

    const from =
        new Date(
            `${startDate}T00:00:00+07:00`
        )

    /*
     * Gunakan exclusive upper bound.
     *
     * Contoh:
     * end = 2026-09-06
     *
     * query:
     * >= 2026-09-06 00:00 WIB
     * <  2026-09-07 00:00 WIB
     */
    const until =
        new Date(
            `${endDate}T00:00:00+07:00`
        )

    until.setUTCDate(
        until.getUTCDate() + 1
    )

    return {
        start:
            startDate,

        end:
            endDate,

        from,
        until
    }
}


async function getStoreIds() {
    const stores =
        await Shop
            .find({
                type: 'STORE'
            })
            .select('_id')
            .lean()

    return stores.map(item => {
        return item._id
    })
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
|--------------------------------------------------------------------------
| OVERVIEW
|--------------------------------------------------------------------------
|
| GET /api/supervisor/cash/overview
|
| Query:
| ?start=2026-09-01
| ?end=2026-09-06
|
*/

exports.getOverview = async (req, res) => {
    try {
        const range =
            getDateRange({
                start:
                    req.query.start,

                end:
                    req.query.end
            })

        const storeIds =
            await getStoreIds()

        if (!storeIds.length) {
            return res.status(200).json({
                status: true,

                data: {
                    period: {
                        start: range.start,
                        end: range.end
                    },

                    summary: {
                        currentCashBalance: 0,
                        totalIn: 0,
                        totalOut: 0,
                        totalTransactions: 0,

                        storeExpense: 0,
                        ownerPersonal: 0,
                        asonganPurchase: 0,
                        materialExpense: 0
                    },

                    categories: []
                }
            })
        }

        const [
            cashResult,
            transactionResult,
            categoryResult
        ] = await Promise.all([
            /*
             * Saldo kas adalah saldo SAAT INI,
             * bukan saldo berdasarkan periode.
             */
            StoreOperationalCash.aggregate([
                {
                    $match: {
                        shopId: {
                            $in:
                                storeIds
                        },

                        status:
                            'ACTIVE'
                    }
                },

                {
                    $group: {
                        _id: null,

                        totalCash: {
                            $sum:
                                '$balance'
                        }
                    }
                }
            ]),

            /*
             * Arus kas berdasarkan periode.
             */
            StoreOperationalCashTransaction.aggregate([
                {
                    $match: {
                        shopId: {
                            $in:
                                storeIds
                        },

                        status:
                            'POSTED',

                        transactionDate: {
                            $gte:
                                range.from,

                            $lt:
                                range.until
                        }
                    }
                },

                {
                    $group: {
                        _id: null,

                        totalIn: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$transactionType',
                                            'IN'
                                        ]
                                    },

                                    '$amount',

                                    0
                                ]
                            }
                        },

                        totalOut: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$transactionType',
                                            'OUT'
                                        ]
                                    },

                                    '$amount',

                                    0
                                ]
                            }
                        },

                        storeExpense: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$transactionCategory',
                                            'STORE_EXPENSE'
                                        ]
                                    },

                                    '$amount',

                                    0
                                ]
                            }
                        },

                        ownerPersonal: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$transactionCategory',
                                            'OWNER_PERSONAL'
                                        ]
                                    },

                                    '$amount',

                                    0
                                ]
                            }
                        },

                        asonganPurchase: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$transactionCategory',
                                            'ASONGAN_PURCHASE'
                                        ]
                                    },

                                    '$amount',

                                    0
                                ]
                            }
                        },

                        materialExpense: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$transactionCategory',
                                            'MATERIAL_EXPENSE'
                                        ]
                                    },

                                    '$amount',

                                    0
                                ]
                            }
                        },

                        totalTransactions: {
                            $sum: 1
                        }
                    }
                }
            ]),

            /*
             * Detail kategori pengeluaran.
             */
            Pengeluaran.aggregate([
                {
                    $match: {
                        shopId: {
                            $in:
                                storeIds
                        },

                        createdAt: {
                            $gte:
                                range.from,

                            $lt:
                                range.until
                        }
                    }
                },

                {
                    $lookup: {
                        from:
                            'storeexpensecategories',

                        localField:
                            'categoryId',

                        foreignField:
                            '_id',

                        as:
                            'category'
                    }
                },

                {
                    $unwind: {
                        path:
                            '$category',

                        preserveNullAndEmptyArrays:
                            true
                    }
                },

                {
                    $group: {
                        _id:
                            '$categoryId',

                        categoryName: {
                            $first: {
                                $ifNull: [
                                    '$category.name',
                                    'Tanpa Kategori'
                                ]
                            }
                        },

                        totalTransactions: {
                            $sum: 1
                        },

                        totalAmount: {
                            $sum:
                                '$total'
                        }
                    }
                },

                {
                    $sort: {
                        totalAmount: -1
                    }
                }
            ])
        ])

        const cash =
            cashResult[0] || {
                totalCash: 0
            }

        const transaction =
            transactionResult[0] || {
                totalIn: 0,
                totalOut: 0,
                totalTransactions: 0,

                storeExpense: 0,
                ownerPersonal: 0,
                asonganPurchase: 0,
                materialExpense: 0
            }

        const categories =
            categoryResult.map(item => ({
                categoryId:
                    item._id,

                categoryName:
                    item.categoryName,

                totalTransactions:
                    Number(
                        item.totalTransactions || 0
                    ),

                totalAmount:
                    Number(
                        item.totalAmount || 0
                    )
            }))

        return res.status(200).json({
            status: true,

            data: {
                period: {
                    start:
                        range.start,

                    end:
                        range.end
                },

                summary: {
                    currentCashBalance:
                        Number(
                            cash.totalCash || 0
                        ),

                    totalIn:
                        Number(
                            transaction.totalIn || 0
                        ),

                    totalOut:
                        Number(
                            transaction.totalOut || 0
                        ),

                    totalTransactions:
                        Number(
                            transaction.totalTransactions || 0
                        ),

                    storeExpense:
                        Number(
                            transaction.storeExpense || 0
                        ),

                    ownerPersonal:
                        Number(
                            transaction.ownerPersonal || 0
                        ),

                    asonganPurchase:
                        Number(
                            transaction.asonganPurchase || 0
                        ),

                    materialExpense:
                        Number(
                            transaction.materialExpense || 0
                        )
                },

                categories
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
| RIWAYAT PENGELUARAN
|--------------------------------------------------------------------------
|
| GET /api/supervisor/cash/expenses
|
| Query:
|
| ?start=
| ?end=
| ?categoryId=
| ?search=
| ?page=1
| ?limit=25
|
*/

exports.getExpenses = async (req, res) => {
    try {
        const range =
            getDateRange({
                start:
                    req.query.start,

                end:
                    req.query.end
            })

        const storeIds =
            await getStoreIds()

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

        const filter = {
            shopId: {
                $in:
                    storeIds
            },

            createdAt: {
                $gte:
                    range.from,

                $lt:
                    range.until
            }
        }

        if (req.query.categoryId) {
            if (
                !mongoose.Types.ObjectId.isValid(
                    req.query.categoryId
                )
            ) {
                throw createError(
                    'Kategori pengeluaran tidak valid',
                    400
                )
            }

            filter.categoryId =
                new mongoose.Types.ObjectId(
                    req.query.categoryId
                )
        }

        const search =
            String(
                req.query.search || ''
            ).trim()

        if (search) {
            const escaped =
                search.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    '\\$&'
                )

            filter.item = {
                $regex:
                    escaped,

                $options:
                    'i'
            }
        }

        const skip =
            (page - 1) *
            limit

        const [
            items,
            total,
            totalAmount
        ] = await Promise.all([
            Pengeluaran
                .find(filter)
                .populate(
                    'categoryId',
                    'code name'
                )
                .populate(
                    'userId',
                    'name'
                )
                .sort({
                    createdAt: -1
                })
                .skip(skip)
                .limit(limit)
                .lean(),

            Pengeluaran
                .countDocuments(
                    filter
                ),

            Pengeluaran.aggregate([
                {
                    $match:
                        filter
                },

                {
                    $group: {
                        _id: null,

                        total: {
                            $sum:
                                '$total'
                        }
                    }
                }
            ])
        ])

        return res.status(200).json({
            status: true,

            data: {
                period: {
                    start:
                        range.start,

                    end:
                        range.end
                },

                summary: {
                    totalTransactions:
                        total,

                    totalAmount:
                        Number(
                            totalAmount[0]?.total ||
                            0
                        )
                },

                items:
                    items.map(item => ({
                        _id:
                            item._id,

                        date:
                            item.createdAt,

                        item:
                            item.item,

                        category:
                            item.categoryId
                                ? {
                                    _id:
                                        item.categoryId._id,

                                    code:
                                        item.categoryId.code,

                                    name:
                                        item.categoryId.name
                                }
                                : null,

                        harga:
                            Number(
                                item.harga || 0
                            ),

                        qty:
                            Number(
                                item.qty || 0
                            ),

                        total:
                            Number(
                                item.total || 0
                            ),

                        user:
                            item.userId
                                ? {
                                    _id:
                                        item.userId._id,

                                    name:
                                        item.userId.name
                                }
                                : null
                    })),

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


/*
|--------------------------------------------------------------------------
| TRANSAKSI KAS
|--------------------------------------------------------------------------
|
| GET /api/supervisor/cash/transactions
|
| Query:
|
| ?start=
| ?end=
| ?transactionType=
| ?transactionCategory=
| ?status=
| ?search=
| ?page=1
| ?limit=25
|
*/

exports.getTransactions = async (req, res) => {
    try {
        const range =
            getDateRange({
                start:
                    req.query.start,

                end:
                    req.query.end
            })

        const storeIds =
            await getStoreIds()

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

        const filter = {
            shopId: {
                $in:
                    storeIds
            },

            transactionDate: {
                $gte:
                    range.from,

                $lt:
                    range.until
            }
        }

        const allowedTypes = [
            'IN',
            'OUT'
        ]

        const allowedCategories = [
            'INITIAL_BALANCE',
            'FUND_ADDITION',
            'STORE_EXPENSE',
            'MATERIAL_EXPENSE',
            'OWNER_PERSONAL',
            'ASONGAN_PURCHASE',
            'REFUND',
            'CASH_RETURN',
            'ADJUSTMENT_IN',
            'ADJUSTMENT_OUT'
        ]

        const allowedStatuses = [
            'POSTED',
            'CANCELLED'
        ]

        if (
            req.query.transactionType &&
            allowedTypes.includes(
                req.query.transactionType
            )
        ) {
            filter.transactionType =
                req.query.transactionType
        }

        if (
            req.query.transactionCategory &&
            allowedCategories.includes(
                req.query.transactionCategory
            )
        ) {
            filter.transactionCategory =
                req.query.transactionCategory
        }

        if (
            req.query.status &&
            allowedStatuses.includes(
                req.query.status
            )
        ) {
            filter.status =
                req.query.status
        }

        const search =
            String(
                req.query.search || ''
            ).trim()

        if (search) {
            const escaped =
                search.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    '\\$&'
                )

            filter.$or = [
                {
                    transactionNumber: {
                        $regex:
                            escaped,

                        $options:
                            'i'
                    }
                },

                {
                    description: {
                        $regex:
                            escaped,

                        $options:
                            'i'
                    }
                }
            ]
        }

        const skip =
            (page - 1) *
            limit

        const [
            items,
            total
        ] = await Promise.all([
            StoreOperationalCashTransaction
                .find(filter)
                .populate(
                    'createdBy',
                    'name'
                )
                .populate(
                    'cancelledBy',
                    'name'
                )
                .sort({
                    transactionDate: -1,
                    createdAt: -1
                })
                .skip(skip)
                .limit(limit)
                .lean(),

            StoreOperationalCashTransaction
                .countDocuments(
                    filter
                )
        ])

        return res.status(200).json({
            status: true,

            data: {
                period: {
                    start:
                        range.start,

                    end:
                        range.end
                },

                items:
                    items.map(item => ({
                        _id:
                            item._id,

                        transactionNumber:
                            item.transactionNumber,

                        transactionDate:
                            item.transactionDate,

                        transactionType:
                            item.transactionType,

                        transactionCategory:
                            item.transactionCategory,

                        amount:
                            Number(
                                item.amount || 0
                            ),

                        balanceBefore:
                            Number(
                                item.balanceBefore || 0
                            ),

                        balanceAfter:
                            Number(
                                item.balanceAfter || 0
                            ),

                        description:
                            item.description,

                        referenceType:
                            item.referenceType,

                        referenceId:
                            item.referenceId,

                        receipt:
                            item.receipt,

                        status:
                            item.status,

                        createdBy:
                            item.createdBy || null,

                        cancelledBy:
                            item.cancelledBy || null,

                        cancelledAt:
                            item.cancelledAt,

                        cancellationReason:
                            item.cancellationReason || ''
                    })),

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

exports.getExpenseReport = async (req, res) => {
    try {
        const range =
            getDateRange({
                start:
                    req.query.start,

                end:
                    req.query.end
            })

        const storeIds =
            await getStoreIds()

        const filter = {
            shopId: {
                $in:
                    storeIds
            },

            createdAt: {
                $gte:
                    range.from,

                $lt:
                    range.until
            }
        }

        if (req.query.categoryId) {
            if (
                !mongoose.Types.ObjectId.isValid(
                    req.query.categoryId
                )
            ) {
                throw createError(
                    'Kategori pengeluaran tidak valid',
                    400
                )
            }

            filter.categoryId =
                new mongoose.Types.ObjectId(
                    req.query.categoryId
                )
        }

        const search =
            String(
                req.query.search || ''
            ).trim()

        if (search) {
            const escaped =
                search.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    '\\$&'
                )

            filter.item = {
                $regex:
                    escaped,

                $options:
                    'i'
            }
        }

        const [
            items,
            categoryResult,
            totalResult,
            cashResult
        ] = await Promise.all([
            Pengeluaran
                .find(filter)
                .populate(
                    'categoryId',
                    'code name'
                )
                .populate(
                    'userId',
                    'name'
                )
                .sort({
                    createdAt: 1
                })
                .lean(),

            Pengeluaran.aggregate([
                {
                    $match:
                        filter
                },

                {
                    $lookup: {
                        from:
                            'storeexpensecategories',

                        localField:
                            'categoryId',

                        foreignField:
                            '_id',

                        as:
                            'category'
                    }
                },

                {
                    $unwind: {
                        path:
                            '$category',

                        preserveNullAndEmptyArrays:
                            true
                    }
                },

                {
                    $group: {
                        _id:
                            '$categoryId',

                        categoryName: {
                            $first: {
                                $ifNull: [
                                    '$category.name',
                                    'Tanpa Kategori'
                                ]
                            }
                        },

                        totalTransactions: {
                            $sum: 1
                        },

                        totalAmount: {
                            $sum:
                                '$total'
                        }
                    }
                },

                {
                    $sort: {
                        totalAmount: -1
                    }
                }
            ]),

            Pengeluaran.aggregate([
                {
                    $match:
                        filter
                },

                {
                    $group: {
                        _id: null,

                        totalTransactions: {
                            $sum: 1
                        },

                        totalAmount: {
                            $sum:
                                '$total'
                        }
                    }
                }
            ]),

            StoreOperationalCash.aggregate([
                {
                    $match: {
                        shopId: {
                            $in:
                                storeIds
                        },

                        status:
                            'ACTIVE'
                    }
                },

                {
                    $group: {
                        _id: null,

                        currentCashBalance: {
                            $sum:
                                '$balance'
                        }
                    }
                }
            ])
        ])

        const transactionSummary =
            await StoreOperationalCashTransaction.aggregate([
                {
                    $match: {
                        shopId: {
                            $in:
                                storeIds
                        },

                        status:
                            'POSTED',

                        transactionDate: {
                            $gte:
                                range.from,

                            $lt:
                                range.until
                        }
                    }
                },

                {
                    $group: {
                        _id: null,

                        storeExpense: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$transactionCategory',
                                            'STORE_EXPENSE'
                                        ]
                                    },

                                    '$amount',

                                    0
                                ]
                            }
                        },

                        ownerPersonal: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$transactionCategory',
                                            'OWNER_PERSONAL'
                                        ]
                                    },

                                    '$amount',

                                    0
                                ]
                            }
                        },

                        asonganPurchase: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$transactionCategory',
                                            'ASONGAN_PURCHASE'
                                        ]
                                    },

                                    '$amount',

                                    0
                                ]
                            }
                        },

                        materialExpense: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$transactionCategory',
                                            'MATERIAL_EXPENSE'
                                        ]
                                    },

                                    '$amount',

                                    0
                                ]
                            }
                        },

                        totalOut: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$transactionType',
                                            'OUT'
                                        ]
                                    },

                                    '$amount',

                                    0
                                ]
                            }
                        }
                    }
                }
            ])

        const total =
            totalResult[0] || {
                totalTransactions: 0,
                totalAmount: 0
            }

        const cash =
            cashResult[0] || {
                currentCashBalance: 0
            }

        const transaction =
            transactionSummary[0] || {
                storeExpense: 0,
                ownerPersonal: 0,
                asonganPurchase: 0,
                materialExpense: 0,
                totalOut: 0
            }

        return res.status(200).json({
            status: true,

            data: {
                period: {
                    start:
                        range.start,

                    end:
                        range.end
                },

                summary: {
                    totalTransactions:
                        Number(
                            total.totalTransactions || 0
                        ),

                    totalAmount:
                        Number(
                            total.totalAmount || 0
                        ),

                    currentCashBalance:
                        Number(
                            cash.currentCashBalance || 0
                        ),

                    storeExpense:
                        Number(
                            transaction.storeExpense || 0
                        ),

                    ownerPersonal:
                        Number(
                            transaction.ownerPersonal || 0
                        ),

                    asonganPurchase:
                        Number(
                            transaction.asonganPurchase || 0
                        ),

                    materialExpense:
                        Number(
                            transaction.materialExpense || 0
                        ),

                    totalOut:
                        Number(
                            transaction.totalOut || 0
                        )
                },

                categories:
                    categoryResult.map(item => ({
                        categoryId:
                            item._id,

                        categoryName:
                            item.categoryName,

                        totalTransactions:
                            Number(
                                item.totalTransactions || 0
                            ),

                        totalAmount:
                            Number(
                                item.totalAmount || 0
                            )
                    })),

                items:
                    items.map(item => ({
                        _id:
                            item._id,

                        date:
                            item.createdAt,

                        item:
                            item.item,

                        category:
                            item.categoryId
                                ? {
                                    _id:
                                        item.categoryId._id,

                                    code:
                                        item.categoryId.code,

                                    name:
                                        item.categoryId.name
                                }
                                : null,

                        harga:
                            Number(
                                item.harga || 0
                            ),

                        qty:
                            Number(
                                item.qty || 0
                            ),

                        total:
                            Number(
                                item.total || 0
                            ),

                        user:
                            item.userId
                                ? {
                                    _id:
                                        item.userId._id,

                                    name:
                                        item.userId.name
                                }
                                : null
                    }))
            }
        })

    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}