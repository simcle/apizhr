const mongoose = require('mongoose')

const StockOpname = require('../../models/StockOpname')
const StockOpnameItem = require('../../models/StockOpnameItem')
const Inventory = require('../../models/inventory')
const Product = require('../../models/products')
const StockCard = require('../../models/stockCard')
const Shop = require('../../models/shops')

async function generateNumber() {
    const now = new Date()

    const dd = String(now.getDate()).padStart(2, '0')
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const yy = String(now.getFullYear()).slice(-2)

    const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0, 0, 0, 0
    )

    const endOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23, 59, 59, 999
    )

    const last = await StockOpname
        .findOne({
            stockOpnameNumber: {
                $regex: `ZHR/STOCK/${yy}/`
            },
            createdAt: {
                $gte: startOfDay,
                $lte: endOfDay
            }
        })
        .sort({
            createdAt: -1
        })
        .select('stockOpnameNumber')

    let running = 1

    if (last) {
        const arr = last.stockOpnameNumber.split('/')
        running = Number(arr[arr.length - 1]) + 1
    }

    return `${dd}${mm}/ZHR/STOCK/${yy}/${running}`
}

/**
 * STOCK OPNAME SUMMARY
 *
 * Summary global seluruh STORE:
 * - sessionActive = DRAFT + COUNTING
 * - draft
 * - counting
 * - finishedToday
 */
exports.getSummary = async (req, res) => {
    try {
        const storeIds = await Shop
            .find({
                type: 'STORE'
            })
            .distinct('_id')

        const now = new Date()

        const startOfDay = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0, 0, 0, 0
        )

        const endOfDay = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23, 59, 59, 999
        )

        const baseQuery = {
            shopId: {
                $in: storeIds
            }
        }

        const [
            sessionActive,
            draft,
            counting,
            finishedToday
        ] = await Promise.all([
            StockOpname.countDocuments({
                ...baseQuery,
                status: {
                    $in: [
                        'DRAFT',
                        'COUNTING'
                    ]
                }
            }),

            StockOpname.countDocuments({
                ...baseQuery,
                status: 'DRAFT'
            }),

            StockOpname.countDocuments({
                ...baseQuery,
                status: 'COUNTING'
            }),

            StockOpname.countDocuments({
                ...baseQuery,
                status: 'FINISHED',
                finishedAt: {
                    $gte: startOfDay,
                    $lte: endOfDay
                }
            })
        ])

        return res.status(200).json({
            status: true,
            data: {
                sessionActive,
                draft,
                counting,
                finishedToday
            }
        })

    } catch (err) {
        console.error(
            'Supervisor getSummary:',
            err
        )

        return res.status(500).json({
            status: false,
            message: err.message
        })
    }
}

async function getStore(shopId) {
    if (!mongoose.Types.ObjectId.isValid(shopId)) {
        return null
    }

    return Shop.findOne({
        _id: shopId,
        type: 'STORE'
    }).lean()
}

async function getStoreSession(stockOpnameId) {
    if (!mongoose.Types.ObjectId.isValid(stockOpnameId)) {
        return null
    }

    const session = await StockOpname
        .findById(stockOpnameId)
        .lean()

    if (!session) {
        return null
    }

    const shop = await getStore(session.shopId)

    if (!shop) {
        return null
    }

    return {
        session,
        shop
    }
}

/**
 * CREATE SESSION
 *
 * Supervisor hanya boleh membuat Stock Opname
 * untuk lokasi dengan Shop.type === STORE.
 */
exports.createSession = async (req, res) => {
    try {
        const {
            shopId,
            opnameType,
            remarks
        } = req.body

        if (!shopId) {
            return res.status(400).json({
                status: false,
                message: 'shopId wajib diisi'
            })
        }

        const shop = await getStore(shopId)

        if (!shop) {
            return res.status(400).json({
                status: false,
                message: 'Toko tidak ditemukan atau lokasi bukan STORE'
            })
        }

        const type = opnameType || 'FULL'

        /*
         * Untuk Supervisor saat ini hanya FULL dan RANDOM
         * yang kita expose.
         *
         * PARENT belum digunakan karena create session
         * existing belum memiliki parentId.
         */
        if (!['FULL', 'RANDOM'].includes(type)) {
            return res.status(400).json({
                status: false,
                message: 'Jenis Stock Opname tidak valid'
            })
        }

        /*
         * FULL tidak boleh mempunyai session aktif lain
         * pada toko yang sama.
         */
        if (type === 'FULL') {
            const activeSession = await StockOpname.findOne({
                shopId,
                opnameType: 'FULL',
                status: {
                    $in: [
                        'DRAFT',
                        'COUNTING'
                    ]
                }
            }).lean()

            if (activeSession) {
                return res.status(400).json({
                    status: false,
                    message: `Stock Opname FULL masih berjalan (${activeSession.stockOpnameNumber})`
                })
            }
        }

        const doc = await StockOpname.create({
            stockOpnameNumber: await generateNumber(),
            shopId,
            opnameType: type,
            remarks: remarks || (
                type === 'RANDOM'
                    ? 'Stock Opname Random'
                    : 'Stock Opname'
            ),
            userId: req.user?._id || null
        })

        const data = await StockOpname
            .findById(doc._id)
            .populate('shopId', 'name type')
            .populate('userId', 'name')
            .lean()

        return res.status(201).json({
            status: true,
            message: 'Stock Opname berhasil dibuat',
            data
        })

    } catch (err) {
        console.error('Supervisor createSession:', err)

        return res.status(500).json({
            status: false,
            message: err.message
        })
    }
}

/**
 * LIST SESSION
 *
 * Hanya session yang shop-nya bertipe STORE.
 */
exports.getSessions = async (req, res) => {
    try {
        const page = Math.max(
            Number(req.query.page || 1),
            1
        )

        const limit = Math.min(
            Math.max(Number(req.query.limit || 20), 1),
            100
        )

        const skip = (page - 1) * limit

        /*
         * Ambil seluruh ID lokasi STORE.
         */
        const storeIds = await Shop
            .find({
                type: 'STORE'
            })
            .distinct('_id')

        const query = {
            shopId: {
                $in: storeIds
            }
        }

        if (req.query.status) {
            query.status = req.query.status
        }

        if (req.query.shopId) {
            if (!mongoose.Types.ObjectId.isValid(req.query.shopId)) {
                return res.status(400).json({
                    status: false,
                    message: 'shopId tidak valid'
                })
            }

            const shop = await getStore(req.query.shopId)

            if (!shop) {
                return res.status(400).json({
                    status: false,
                    message: 'Toko tidak ditemukan atau lokasi bukan STORE'
                })
            }

            query.shopId = new mongoose.Types.ObjectId(
                req.query.shopId
            )
        }

        if (req.query.opnameType) {
            query.opnameType = req.query.opnameType
        }

        if (req.query.search) {
            query.stockOpnameNumber = {
                $regex: req.query.search,
                $options: 'i'
            }
        }

        const [total, data] = await Promise.all([
            StockOpname.countDocuments(query),

            StockOpname
                .find(query)
                .populate(
                    'shopId',
                    'name type'
                )
                .populate(
                    'userId',
                    'name'
                )
                .populate(
                    'reviewedBy',
                    'name'
                )
                .populate(
                    'approvedBy',
                    'name'
                )
                .populate(
                    'postedBy',
                    'name'
                )
                .sort({
                    createdAt: -1
                })
                .skip(skip)
                .limit(limit)
                .lean()
        ])

        return res.status(200).json({
            status: true,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            data
        })

    } catch (err) {
        console.error('Supervisor getSessions:', err)

        return res.status(500).json({
            status: false,
            message: err.message
        })
    }
}

/**
 * DETAIL SESSION
 */
exports.getDetail = async (req, res) => {
    try {
        const stockOpnameId = req.params.id

        if (!mongoose.Types.ObjectId.isValid(stockOpnameId)) {
            return res.status(400).json({
                status: false,
                message: 'ID Stock Opname tidak valid'
            })
        }

        const data = await StockOpname
            .findById(stockOpnameId)
            .populate(
                'shopId',
                'name type'
            )
            .populate(
                'userId',
                'name'
            )
            .populate(
                'reviewedBy',
                'name'
            )
            .populate(
                'approvedBy',
                'name'
            )
            .populate(
                'postedBy',
                'name'
            )
            .lean()

        if (!data) {
            return res.status(404).json({
                status: false,
                message: 'Stock Opname tidak ditemukan'
            })
        }

        /*
         * Stock Opname selain STORE tidak boleh
         * terlihat dari API Supervisor.
         */
        if (!data.shopId || data.shopId.type !== 'STORE') {
            return res.status(404).json({
                status: false,
                message: 'Stock Opname tidak ditemukan'
            })
        }

        return res.status(200).json({
            status: true,
            data
        })

    } catch (err) {
        console.error('Supervisor getDetail:', err)

        return res.status(500).json({
            status: false,
            message: err.message
        })
    }
}

/**
 * GENERATE ITEMS
 *
 * Khusus FULL.
 */
exports.generateItems = async (req, res) => {
    try {
        const stockOpnameId = req.params.id

        const result = await getStoreSession(stockOpnameId)

        if (!result) {
            return res.status(404).json({
                status: false,
                message: 'Stock Opname tidak ditemukan'
            })
        }

        const session = await StockOpname.findById(stockOpnameId)

        if (session.status !== 'DRAFT') {
            return res.status(400).json({
                status: false,
                message: 'Generate item hanya bisa dilakukan saat status DRAFT'
            })
        }

        if (session.opnameType !== 'FULL') {
            return res.status(400).json({
                status: false,
                message: 'Generate item hanya digunakan untuk Stock Opname FULL'
            })
        }

        const existingItem = await StockOpnameItem.findOne({
            stockOpnameId: session._id
        }).select('_id')

        if (existingItem) {
            return res.status(400).json({
                status: false,
                message: 'Item Stock Opname sudah pernah digenerate'
            })
        }

        const pipeline = [
            {
                $match: {
                    shopId: new mongoose.Types.ObjectId(
                        session.shopId
                    )
                }
            },

            {
                $lookup: {
                    from: 'products',
                    localField: 'productId',
                    foreignField: '_id',
                    as: 'product'
                }
            },

            {
                $unwind: '$product'
            },

            {
                $addFields: {
                    parentGroupId: {
                        $ifNull: [
                            '$product.parentId',
                            '$product._id'
                        ]
                    }
                }
            },

            {
                $lookup: {
                    from: 'products',
                    localField: 'parentGroupId',
                    foreignField: '_id',
                    as: 'parent'
                }
            },

            {
                $unwind: {
                    path: '$parent',
                    preserveNullAndEmptyArrays: true
                }
            },

            {
                $lookup: {
                    from: 'categories',
                    localField: 'product.categoryId',
                    foreignField: '_id',
                    as: 'category'
                }
            },

            {
                $unwind: {
                    path: '$category',
                    preserveNullAndEmptyArrays: true
                }
            },

            {
                $project: {
                    shopId: 1,
                    productId: 1,

                    sku: '$product.sku',
                    name: '$product.name',

                    parentId: '$parentGroupId',

                    parentName: {
                        $ifNull: [
                            '$parent.name',
                            '$product.name'
                        ]
                    },

                    categoryId: '$product.categoryId',
                    categoryName: '$category.name',

                    systemQtySnapshot: '$qty',

                    unitCost: {
                        $ifNull: [
                            '$product.purchase',
                            {
                                $ifNull: [
                                    '$product.price',
                                    0
                                ]
                            }
                        ]
                    }
                }
            },

            {
                $sort: {
                    categoryName: 1,
                    parentName: 1,
                    name: 1,
                    sku: 1
                }
            }
        ]

        const rows = await Inventory
            .aggregate(pipeline)
            .allowDiskUse(true)

        if (!rows.length) {
            return res.status(400).json({
                status: false,
                message: 'Tidak ada inventory yang bisa digenerate untuk session ini'
            })
        }

        const now = new Date()

        const ops = rows.map(row => ({
            updateOne: {
                filter: {
                    stockOpnameId: session._id,
                    productId: row.productId
                },

                update: {
                    $setOnInsert: {
                        stockOpnameId: session._id,
                        shopId: session.shopId,

                        productId: row.productId,

                        sku: row.sku,
                        name: row.name,

                        parentId: row.parentId || null,
                        parentName: row.parentName || null,

                        categoryId: row.categoryId || null,
                        categoryName: row.categoryName || null,

                        systemQtySnapshot:
                            Number(row.systemQtySnapshot) || 0,

                        countedQty: null,
                        differenceQty: 0,

                        unitCost:
                            Number(row.unitCost) || 0,

                        differenceValue: 0,

                        countStatus: 'NOT_COUNTED',

                        note: '',

                        countedAt: null,
                        countedBy: null,

                        lastUpdatedAt: null,
                        lastUpdatedBy: null,

                        sortKey: [
                            row.categoryName || '',
                            row.parentName || '',
                            row.name || '',
                            row.sku || ''
                        ].join('|')
                    }
                },

                upsert: true
            }
        }))

        await StockOpnameItem.bulkWrite(
            ops,
            {
                ordered: false
            }
        )

        const totalSystemQty = rows.reduce(
            (sum, row) => {
                return sum + (
                    Number(row.systemQtySnapshot) || 0
                )
            },
            0
        )

        await StockOpname.findByIdAndUpdate(
            session._id,
            {
                status: 'COUNTING',

                startedAt: now,
                snapshotAt: now,

                totalItems: rows.length,

                countedItems: 0,
                postedItems: 0,
                recheckItems: 0,
                differenceItems: 0,

                totalSystemQty,
                totalCountedQty: 0,
                totalPlusQty: 0,
                totalMinusQty: 0,
                totalDifferenceValue: 0
            }
        )

        return res.status(200).json({
            status: true,
            message: 'Generate item berhasil',
            stockOpnameId: session._id,
            totalItems: rows.length,
            totalSystemQty
        })

    } catch (err) {
        console.error('Supervisor generateItems:', err)

        return res.status(500).json({
            status: false,
            message: err.message
        })
    }
}

/**
 * GET ITEMS
 */
exports.getItems = async (req, res) => {
    try {
        const stockOpnameId = req.params.id

        const sessionResult =
            await getStoreSession(stockOpnameId)

        if (!sessionResult) {
            return res.status(404).json({
                status: false,
                message: 'Stock Opname tidak ditemukan'
            })
        }

        const page = Math.max(
            Number(req.query.page || 1),
            1
        )

        const limit = Math.min(
            Math.max(Number(req.query.limit || 50), 1),
            500
        )

        const skip = (page - 1) * limit

        const match = {
            stockOpnameId:
                new mongoose.Types.ObjectId(
                    stockOpnameId
                )
        }

        if (req.query.search) {
            match.$or = [
                {
                    sku: {
                        $regex: req.query.search,
                        $options: 'i'
                    }
                },
                {
                    name: {
                        $regex: req.query.search,
                        $options: 'i'
                    }
                },
                {
                    parentName: {
                        $regex: req.query.search,
                        $options: 'i'
                    }
                }
            ]
        }

        if (req.query.categoryId) {
            if (!mongoose.Types.ObjectId.isValid(req.query.categoryId)) {
                return res.status(400).json({
                    status: false,
                    message: 'categoryId tidak valid'
                })
            }

            match.categoryId =
                new mongoose.Types.ObjectId(
                    req.query.categoryId
                )
        }

        if (req.query.parentId) {
            if (!mongoose.Types.ObjectId.isValid(req.query.parentId)) {
                return res.status(400).json({
                    status: false,
                    message: 'parentId tidak valid'
                })
            }

            match.parentId =
                new mongoose.Types.ObjectId(
                    req.query.parentId
                )
        }

        if (req.query.countStatus) {
            match.countStatus =
                req.query.countStatus
        }

        if (req.query.onlyDifference === 'true') {
            match.differenceQty = {
                $ne: 0
            }
        }

        const summaryMatch = {
            stockOpnameId:
                new mongoose.Types.ObjectId(
                    stockOpnameId
                )
        }

        const [
            summaryRows,
            total,
            data
        ] = await Promise.all([
            StockOpnameItem.aggregate([
                {
                    $match: summaryMatch
                },

                {
                    $group: {
                        _id: null,

                        totalItems: {
                            $sum: 1
                        },

                        /*
                         * COUNTED + POSTED sama-sama berarti
                         * item sudah dihitung.
                         */
                        countedItems: {
                            $sum: {
                                $cond: [
                                    {
                                        $in: [
                                            '$countStatus',
                                            [
                                                'COUNTED',
                                                'POSTED'
                                            ]
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },

                        notCountedItems: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$countStatus',
                                            'NOT_COUNTED'
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },

                        postedItems: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$countStatus',
                                            'POSTED'
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },

                        recheckItems: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$countStatus',
                                            'RECHECK'
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },

                        differenceItems: {
                            $sum: {
                                $cond: [
                                    {
                                        $ne: [
                                            '$differenceQty',
                                            0
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },

                        totalSystemQty: {
                            $sum: {
                                $ifNull: [
                                    '$systemQtySnapshot',
                                    0
                                ]
                            }
                        },

                        totalCountedQty: {
                            $sum: {
                                $ifNull: [
                                    '$countedQty',
                                    0
                                ]
                            }
                        },

                        totalPlusQty: {
                            $sum: {
                                $cond: [
                                    {
                                        $gt: [
                                            '$differenceQty',
                                            0
                                        ]
                                    },
                                    '$differenceQty',
                                    0
                                ]
                            }
                        },

                        totalMinusQty: {
                            $sum: {
                                $cond: [
                                    {
                                        $lt: [
                                            '$differenceQty',
                                            0
                                        ]
                                    },
                                    {
                                        $abs:
                                            '$differenceQty'
                                    },
                                    0
                                ]
                            }
                        },

                        totalDifferenceValue: {
                            $sum: {
                                $abs: {
                                    $ifNull: [
                                        '$differenceValue',
                                        0
                                    ]
                                }
                            }
                        }
                    }
                }
            ]),

            StockOpnameItem.countDocuments(
                match
            ),

            StockOpnameItem
                .find(match)
                .sort({
                    categoryName: 1,
                    parentName: 1,
                    name: 1,
                    sku: 1
                })
                .skip(skip)
                .limit(limit)
                .lean()
        ])

        const summary = summaryRows[0] || {
            totalItems: 0,
            countedItems: 0,
            notCountedItems: 0,
            postedItems: 0,
            recheckItems: 0,
            differenceItems: 0,
            totalSystemQty: 0,
            totalCountedQty: 0,
            totalPlusQty: 0,
            totalMinusQty: 0,
            totalDifferenceValue: 0
        }

        return res.status(200).json({
            status: true,
            stockOpnameId,
            summary,
            page,
            limit,
            total,
            totalPages:
                Math.ceil(total / limit),
            data
        })

    } catch (err) {
        console.error('Supervisor getItems:', err)

        return res.status(500).json({
            status: false,
            message: err.message
        })
    }
}

/**
 * GENERATE ZERO COUNT
 *
 * Mengubah seluruh NOT_COUNTED menjadi countedQty = 0.
 *
 * Hanya untuk FULL.
 */
exports.generateZeroCount = async (req, res) => {
    const dbSession =
        await mongoose.startSession()

    try {
        const stockOpnameId = req.params.id
        const userId =
            req.user?._id || null

        const sessionResult =
            await getStoreSession(stockOpnameId)

        if (!sessionResult) {
            return res.status(404).json({
                status: false,
                message: 'Stock Opname tidak ditemukan'
            })
        }

        let generatedItems = 0
        let updatedSummary = null

        await dbSession.withTransaction(
            async () => {
                const header =
                    await StockOpname
                        .findById(
                            stockOpnameId
                        )
                        .session(dbSession)

                if (!header) {
                    throw new Error(
                        'Stock Opname tidak ditemukan'
                    )
                }

                if (
                    header.status !==
                    'COUNTING'
                ) {
                    throw new Error(
                        'Stock Opname tidak dalam proses COUNTING'
                    )
                }

                if (
                    header.opnameType !==
                    'FULL'
                ) {
                    throw new Error(
                        'Generate Zero hanya dapat digunakan untuk Stock Opname FULL'
                    )
                }

                const items =
                    await StockOpnameItem
                        .find({
                            stockOpnameId:
                                header._id,

                            countStatus:
                                'NOT_COUNTED'
                        })
                        .select(
                            '_id sku systemQtySnapshot unitCost'
                        )
                        .session(dbSession)
                        .lean()

                if (!items.length) {
                    throw new Error(
                        'Tidak ada item NOT_COUNTED'
                    )
                }

                const now = new Date()

                const operations =
                    items.map(item => {
                        const systemQtySnapshot =
                            Number(
                                item.systemQtySnapshot ||
                                0
                            )

                        const unitCost =
                            Number(
                                item.unitCost ||
                                0
                            )

                        const countedQty = 0

                        const differenceQty =
                            countedQty -
                            systemQtySnapshot

                        const differenceValue =
                            differenceQty *
                            unitCost

                        return {
                            updateOne: {
                                filter: {
                                    _id:
                                        item._id,

                                    stockOpnameId:
                                        header._id,

                                    countStatus:
                                        'NOT_COUNTED'
                                },

                                update: {
                                    $set: {
                                        countedQty: 0,

                                        systemQtyAtCount:
                                            systemQtySnapshot,

                                        differenceQty,
                                        differenceValue,

                                        countStatus:
                                            'COUNTED',

                                        countedAt:
                                            now,

                                        countedBy:
                                            userId,

                                        lastUpdatedAt:
                                            now,

                                        lastUpdatedBy:
                                            userId
                                    }
                                }
                            }
                        }
                    })

                const bulkResult =
                    await StockOpnameItem.bulkWrite(
                        operations,
                        {
                            session:
                                dbSession,

                            ordered:
                                false
                        }
                    )

                generatedItems =
                    bulkResult.modifiedCount ||
                    0

                const summaryRows =
                    await StockOpnameItem.aggregate([
                        {
                            $match: {
                                stockOpnameId:
                                    new mongoose.Types.ObjectId(
                                        stockOpnameId
                                    )
                            }
                        },

                        {
                            $group: {
                                _id: null,

                                totalItems: {
                                    $sum: 1
                                },

                                countedItems: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $in: [
                                                    '$countStatus',
                                                    [
                                                        'COUNTED',
                                                        'POSTED'
                                                    ]
                                                ]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                },

                                notCountedItems: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $eq: [
                                                    '$countStatus',
                                                    'NOT_COUNTED'
                                                ]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                },

                                postedItems: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $eq: [
                                                    '$countStatus',
                                                    'POSTED'
                                                ]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                },

                                recheckItems: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $eq: [
                                                    '$countStatus',
                                                    'RECHECK'
                                                ]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                },

                                differenceItems: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $ne: [
                                                    '$differenceQty',
                                                    0
                                                ]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                },

                                totalSystemQty: {
                                    $sum: {
                                        $ifNull: [
                                            '$systemQtySnapshot',
                                            0
                                        ]
                                    }
                                },

                                totalCountedQty: {
                                    $sum: {
                                        $ifNull: [
                                            '$countedQty',
                                            0
                                        ]
                                    }
                                },

                                totalPlusQty: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $gt: [
                                                    '$differenceQty',
                                                    0
                                                ]
                                            },
                                            '$differenceQty',
                                            0
                                        ]
                                    }
                                },

                                totalMinusQty: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $lt: [
                                                    '$differenceQty',
                                                    0
                                                ]
                                            },
                                            {
                                                $abs:
                                                    '$differenceQty'
                                            },
                                            0
                                        ]
                                    }
                                },

                                totalDifferenceValue: {
                                    $sum: {
                                        $abs: {
                                            $ifNull: [
                                                '$differenceValue',
                                                0
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    ])
                    .session(dbSession)

                const summary =
                    summaryRows[0] || {
                        totalItems: 0,
                        countedItems: 0,
                        notCountedItems: 0,
                        postedItems: 0,
                        recheckItems: 0,
                        differenceItems: 0,
                        totalSystemQty: 0,
                        totalCountedQty: 0,
                        totalPlusQty: 0,
                        totalMinusQty: 0,
                        totalDifferenceValue: 0
                    }

                updatedSummary = summary

                await StockOpname.updateOne(
                    {
                        _id:
                            header._id,

                        status:
                            'COUNTING'
                    },
                    {
                        $set: {
                            totalItems:
                                summary.totalItems,

                            countedItems:
                                summary.countedItems,

                            postedItems:
                                summary.postedItems,

                            recheckItems:
                                summary.recheckItems,

                            differenceItems:
                                summary.differenceItems,

                            totalSystemQty:
                                summary.totalSystemQty,

                            totalCountedQty:
                                summary.totalCountedQty,

                            totalPlusQty:
                                summary.totalPlusQty,

                            totalMinusQty:
                                summary.totalMinusQty,

                            totalDifferenceValue:
                                summary.totalDifferenceValue
                        }
                    },
                    {
                        session:
                            dbSession
                    }
                )
            }
        )

        return res.status(200).json({
            status: true,
            message:
                `${generatedItems} item berhasil dibuat counting 0`,
            generatedItems,
            summary:
                updatedSummary
        })

    } catch (err) {
        console.error(
            'Supervisor generateZeroCount:',
            err
        )

        return res.status(500).json({
            status: false,
            message: err.message
        })

    } finally {
        await dbSession.endSession()
    }
}

/**
 * POST BATCH
 */
exports.postBatch = async (req, res) => {
    const stockOpnameId =
        req.params.id

    const userId =
        req.user?._id || null

    try {
        const sessionResult =
            await getStoreSession(
                stockOpnameId
            )

        if (!sessionResult) {
            return res.status(404).json({
                status: false,
                message: 'Stock Opname tidak ditemukan'
            })
        }

        const header =
            sessionResult.session

        if (
            header.status !==
            'COUNTING'
        ) {
            return res.status(400).json({
                status: false,
                message: 'Stock Opname tidak dapat diposting'
            })
        }

        const isRandom =
            header.opnameType ===
            'RANDOM'

        const items =
            await StockOpnameItem
                .find({
                    stockOpnameId,

                    countStatus:
                        'COUNTED'
                })
                .sort({
                    countedAt: 1
                })
                .lean()

        /*
         * RANDOM tetap selesai walaupun
         * tidak memiliki item COUNTED.
         */
        if (!items.length) {
            if (isRandom) {
                const now =
                    new Date()

                const finishResult =
                    await StockOpname.updateOne(
                        {
                            _id:
                                stockOpnameId,

                            status:
                                'COUNTING'
                        },
                        {
                            $set: {
                                status:
                                    'FINISHED',

                                finishedAt:
                                    now,

                                postedAt:
                                    now,

                                postedBy:
                                    userId
                            }
                        }
                    )

                return res.status(200).json({
                    status: true,
                    message: 'Random Stock Opname selesai',
                    totalReady: 0,
                    posted: 0,
                    failedCount: 0,
                    failed: [],
                    remain: 0,
                    finished:
                        finishResult.modifiedCount >
                        0
                })
            }

            return res.status(400).json({
                status: false,
                message: 'Tidak ada item yang siap diposting'
            })
        }

        let posted = 0

        const failed = []

        for (
            const sourceItem of items
        ) {
            const dbSession =
                await mongoose.startSession()

            try {
                await dbSession.withTransaction(
                    async () => {
                        const item =
                            await StockOpnameItem
                                .findOne({
                                    _id:
                                        sourceItem._id,

                                    stockOpnameId,

                                    countStatus:
                                        'COUNTED'
                                })
                                .session(
                                    dbSession
                                )

                        if (!item) {
                            throw new Error(
                                `Item ${sourceItem.sku || sourceItem._id} sudah diproses atau tidak tersedia`
                            )
                        }

                        if (
                            item.countedQty ===
                                null ||
                            item.countedQty ===
                                undefined ||
                            item.systemQtyAtCount ===
                                null ||
                            item.systemQtyAtCount ===
                                undefined
                        ) {
                            throw new Error(
                                `Data counting SKU ${item.sku || item.productId} belum lengkap`
                            )
                        }

                        let inventory =
                            await Inventory
                                .findOne({
                                    shopId:
                                        item.shopId,

                                    productId:
                                        item.productId
                                })
                                .session(
                                    dbSession
                                )

                        if (!inventory) {
                            inventory =
                                new Inventory({
                                    shopId:
                                        item.shopId,

                                    productId:
                                        item.productId,

                                    qty: 0
                                })
                        }

                        const currentInventory =
                            Number(
                                inventory.qty ||
                                0
                            )

                        const systemQtyAtCount =
                            Number(
                                item.systemQtyAtCount
                            )

                        const countedQty =
                            Number(
                                item.countedQty
                            )

                        const deltaTransaction =
                            currentInventory -
                            systemQtyAtCount

                        const newInventoryQty =
                            Math.max(
                                countedQty +
                                deltaTransaction,
                                0
                            )

                        const adjustment =
                            newInventoryQty -
                            currentInventory

                        inventory.qty =
                            newInventoryQty

                        await inventory.save({
                            session:
                                dbSession
                        })

                        const totalStockRows =
                            await Inventory.aggregate([
                                {
                                    $match: {
                                        productId:
                                            item.productId
                                    }
                                },

                                {
                                    $group: {
                                        _id:
                                            '$productId',

                                        qty: {
                                            $sum:
                                                '$qty'
                                        }
                                    }
                                }
                            ])
                            .session(
                                dbSession
                            )

                        const productStock =
                            Number(
                                totalStockRows[0]
                                    ?.qty ||
                                0
                            )

                        const productUpdate =
                            await Product.updateOne(
                                {
                                    _id:
                                        item.productId
                                },
                                {
                                    $set: {
                                        stock:
                                            productStock
                                    }
                                },
                                {
                                    session:
                                        dbSession
                                }
                            )

                        if (
                            !productUpdate
                                .matchedCount
                        ) {
                            throw new Error(
                                `Product SKU ${item.sku || item.productId} tidak ditemukan`
                            )
                        }

                        await StockCard.create(
                            [
                                {
                                    shopId:
                                        item.shopId,

                                    productId:
                                        item.productId,

                                    documentId:
                                        header._id,

                                    documentName:
                                        'Stock Opname',

                                    document:
                                        header.stockOpnameNumber,

                                    type:
                                        'STOCK_OPNAME',

                                    stockIn:
                                        adjustment >
                                        0
                                            ? adjustment
                                            : 0,

                                    stockOut:
                                        adjustment <
                                        0
                                            ? Math.abs(
                                                adjustment
                                            )
                                            : 0,

                                    qtyBefore:
                                        currentInventory,

                                    qtyAfter:
                                        newInventoryQty,

                                    balance:
                                        productStock,

                                    remarks:
                                        'Stock Opname',

                                    userId
                                }
                            ],
                            {
                                session:
                                    dbSession
                            }
                        )

                        const now =
                            new Date()

                        item.countStatus =
                            'POSTED'

                        item.postedAt =
                            now

                        item.postedBy =
                            userId

                        item.lastUpdatedAt =
                            now

                        item.lastUpdatedBy =
                            userId

                        await item.save({
                            session:
                                dbSession
                        })
                    }
                )

                posted += 1

            } catch (err) {
                console.error(
                    `Gagal posting SKU ${sourceItem.sku || sourceItem._id}:`,
                    err
                )

                failed.push({
                    itemId:
                        sourceItem._id,

                    sku:
                        sourceItem.sku,

                    message:
                        err.message
                })

            } finally {
                await dbSession.endSession()
            }
        }

        if (posted > 0) {
            await StockOpname.updateOne(
                {
                    _id:
                        stockOpnameId
                },
                {
                    $inc: {
                        postedItems:
                            posted
                    }
                }
            )
        }

        const remain =
            await StockOpnameItem
                .countDocuments({
                    stockOpnameId,

                    countStatus: {
                        $in: [
                            'NOT_COUNTED',
                            'COUNTED'
                        ]
                    }
                })

        /*
         * RANDOM:
         * selalu selesai ketika postBatch dijalankan.
         *
         * FULL:
         * selesai hanya jika tidak ada item tersisa.
         */
        const shouldFinish =
            isRandom ||
            remain === 0

        let finished = false

        if (shouldFinish) {
            const now =
                new Date()

            const finishResult =
                await StockOpname.updateOne(
                    {
                        _id:
                            stockOpnameId,

                        status:
                            'COUNTING'
                    },
                    {
                        $set: {
                            status:
                                'FINISHED',

                            finishedAt:
                                now,

                            postedAt:
                                now,

                            postedBy:
                                userId
                        }
                    }
                )

            finished =
                finishResult.modifiedCount >
                0
        }

        return res.status(200).json({
            status:
                failed.length === 0,

            message:
                failed.length === 0
                    ? `${posted} item berhasil diposting`
                    : `${posted} item berhasil dan ${failed.length} item gagal diposting`,

            totalReady:
                items.length,

            posted,

            failedCount:
                failed.length,

            failed,

            remain,

            finished
        })

    } catch (err) {
        console.error(
            'Supervisor postBatch:',
            err
        )

        return res.status(500).json({
            status: false,
            message: err.message
        })
    }
}