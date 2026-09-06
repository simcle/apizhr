const Shop = require('../../models/shops')
const DailyChecklist = require('../../models/dailyChecklist')
const InventoryIntelDaily = require('../../models/InventoryIntelDaily')
const DeadStockDaily = require('../../models/deadStockDaily')
const StoreOperationalCash = require('../../models/StoreOperationalCash')
const StoreOperationalCashTransaction = require('../../models/StoreOperationalCashTransaction')


function getDateWIB() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date())
}


function getDateRangeWIB(dateStr) {
    const start = new Date(
        `${dateStr}T00:00:00+07:00`
    )

    const end = new Date(
        `${dateStr}T00:00:00+07:00`
    )

    end.setUTCDate(
        end.getUTCDate() + 1
    )

    return {
        start,
        end
    }
}


async function getStoreIds() {
    const stores = await Shop
        .find({
            type: 'STORE'
        })
        .select('_id')
        .lean()

    return stores.map(item => {
        return item._id
    })
}


async function getLatestInventoryDate() {
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


async function getLatestDeadStockDate() {
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


function handleError(res, error) {
    console.error(
        'SUPERVISOR DASHBOARD ERROR:',
        error
    )

    return res.status(500).json({
        status: false,
        message: 'Gagal mengambil dashboard supervisor'
    })
}


/*
|--------------------------------------------------------------------------
| GET /api/supervisor/dashboard
|--------------------------------------------------------------------------
*/

exports.getDashboard = async (req, res) => {
    try {
        const today = getDateWIB()

        const [
            storeIds,
            inventoryDate,
            deadStockDate
        ] = await Promise.all([
            getStoreIds(),
            getLatestInventoryDate(),
            getLatestDeadStockDate()
        ])

        const {
            start,
            end
        } = getDateRangeWIB(
            today
        )

        /*
        |--------------------------------------------------------------------------
        | CHECKLIST
        |--------------------------------------------------------------------------
        */

        const checklistPromise =
            DailyChecklist.aggregate([
                {
                    $match: {
                        date:
                            today,

                        shopId: {
                            $in:
                                storeIds
                        }
                    }
                },

                {
                    $facet: {
                        summary: [
                            {
                                $group: {
                                    _id: null,

                                    totalStores: {
                                        $sum: 1
                                    },

                                    pending: {
                                        $sum: {
                                            $cond: [
                                                {
                                                    $eq: [
                                                        '$status',
                                                        'PENDING'
                                                    ]
                                                },
                                                1,
                                                0
                                            ]
                                        }
                                    },

                                    inProgress: {
                                        $sum: {
                                            $cond: [
                                                {
                                                    $eq: [
                                                        '$status',
                                                        'IN_PROGRESS'
                                                    ]
                                                },
                                                1,
                                                0
                                            ]
                                        }
                                    },

                                    completed: {
                                        $sum: {
                                            $cond: [
                                                {
                                                    $eq: [
                                                        '$status',
                                                        'COMPLETED'
                                                    ]
                                                },
                                                1,
                                                0
                                            ]
                                        }
                                    },

                                    totalIssues: {
                                        $sum: {
                                            $ifNull: [
                                                '$totalIssue',
                                                0
                                            ]
                                        }
                                    }
                                }
                            }
                        ],

                        pendingShops: [
                            {
                                $match: {
                                    status: {
                                        $in: [
                                            'PENDING',
                                            'IN_PROGRESS'
                                        ]
                                    }
                                }
                            },

                            {
                                $sort: {
                                    status: 1,
                                    shopName: 1
                                }
                            },

                            {
                                $limit: 5
                            },

                            {
                                $project: {
                                    _id: 1,
                                    shopId: 1,
                                    shopName: 1,
                                    status: 1,
                                    totalItems: 1,
                                    totalOk: 1,
                                    totalIssue: 1,
                                    totalNA: 1,
                                    startedAt: 1
                                }
                            }
                        ],

                        issueShops: [
                            {
                                $match: {
                                    totalIssue: {
                                        $gt: 0
                                    }
                                }
                            },

                            {
                                $sort: {
                                    totalIssue: -1
                                }
                            },

                            {
                                $limit: 5
                            },

                            {
                                $project: {
                                    _id: 1,
                                    shopId: 1,
                                    shopName: 1,
                                    status: 1,
                                    totalIssue: 1
                                }
                            }
                        ]
                    }
                }
            ])

        /*
        |--------------------------------------------------------------------------
        | INVENTORY INTELLIGENCE
        |--------------------------------------------------------------------------
        */

        const inventoryPromise =
            inventoryDate
                ? InventoryIntelDaily.aggregate([
                    {
                        $match: {
                            date:
                                inventoryDate,

                            shopType:
                                'STORE'
                        }
                    },

                    {
                        $facet: {
                            summary: [
                                {
                                    $group: {
                                        _id: null,

                                        totalSku: {
                                            $sum: 1
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

                                        totalRecommendedQty: {
                                            $sum: {
                                                $cond: [
                                                    {
                                                        $ne: [
                                                            '$status',
                                                            'AMAN'
                                                        ]
                                                    },
                                                    {
                                                        $ifNull: [
                                                            '$recommendedQty',
                                                            0
                                                        ]
                                                    },
                                                    0
                                                ]
                                            }
                                        }
                                    }
                                }
                            ],

                            priority: [
                                {
                                    $match: {
                                        status: {
                                            $in: [
                                                'AWAS',
                                                'SIAGA',
                                                'WASPADA'
                                            ]
                                        }
                                    }
                                },

                                {
                                    $sort: {
                                        priorityScore: -1,
                                        recommendedQty: -1,
                                        ads: -1
                                    }
                                },

                                {
                                    $limit: 5
                                },

                                {
                                    $lookup: {
                                        from:
                                            'products',

                                        localField:
                                            'productId',

                                        foreignField:
                                            '_id',

                                        as:
                                            'product'
                                    }
                                },

                                {
                                    $unwind: {
                                        path:
                                            '$product',

                                        preserveNullAndEmptyArrays:
                                            true
                                    }
                                },

                                {
                                    $lookup: {
                                        from:
                                            Shop.collection.name,

                                        localField:
                                            'shopId',

                                        foreignField:
                                            '_id',

                                        as:
                                            'shop'
                                    }
                                },

                                {
                                    $unwind: {
                                        path:
                                            '$shop',

                                        preserveNullAndEmptyArrays:
                                            true
                                    }
                                },

                                {
                                    $project: {
                                        _id: 1,

                                        shopId: 1,

                                        shopName: {
                                            $ifNull: [
                                                '$shop.name',
                                                '-'
                                            ]
                                        },

                                        productId: 1,

                                        productName: {
                                            $ifNull: [
                                                '$product.name',
                                                '$sku'
                                            ]
                                        },

                                        sku: 1,

                                        stockOnHand: 1,
                                        ads: 1,
                                        daysOfCover: 1,

                                        status: 1,
                                        action: 1,

                                        recommendedQty: 1,
                                        priorityScore: 1
                                    }
                                }
                            ]
                        }
                    }
                ])
                : Promise.resolve([])

        /*
        |--------------------------------------------------------------------------
        | DEAD STOCK
        |--------------------------------------------------------------------------
        */

        const deadStockPromise =
            deadStockDate
                ? DeadStockDaily.aggregate([
                    {
                        $match: {
                            date:
                                deadStockDate,

                            shopType:
                                'STORE'
                        }
                    },

                    {
                        $facet: {
                            summary: [
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
                                }
                            ],

                            priority: [
                                {
                                    $match: {
                                        deadLevel: {
                                            $in: [
                                                'CRITICAL',
                                                'SERIOUS'
                                            ]
                                        }
                                    }
                                },

                                {
                                    $sort: {
                                        stockValue: -1,
                                        daysNoSale: -1
                                    }
                                },

                                {
                                    $limit: 5
                                },

                                {
                                    $project: {
                                        _id: 1,
                                        shopId: 1,
                                        shopName: 1,
                                        productId: 1,
                                        sku: 1,
                                        name: 1,

                                        stockOnHand: 1,
                                        stockValue: 1,
                                        daysNoSale: 1,

                                        deadLevel: 1,
                                        recommendedAction: 1
                                    }
                                }
                            ]
                        }
                    }
                ])
                : Promise.resolve([])

        /*
        |--------------------------------------------------------------------------
        | CASH
        |--------------------------------------------------------------------------
        */

        const cashPromise =
            Promise.all([
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
                ]),

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
                                    start,

                                $lt:
                                    end
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
                ])
            ])

        /*
        |--------------------------------------------------------------------------
        | EXECUTE
        |--------------------------------------------------------------------------
        */

        const [
            checklistResult,
            inventoryResult,
            deadStockResult,
            cashResult
        ] = await Promise.all([
            checklistPromise,
            inventoryPromise,
            deadStockPromise,
            cashPromise
        ])

        /*
        |--------------------------------------------------------------------------
        | NORMALIZE CHECKLIST
        |--------------------------------------------------------------------------
        */

        const checklistData =
            checklistResult[0] || {}

        const checklistSummary =
            checklistData.summary?.[0] || {
                totalStores: 0,
                pending: 0,
                inProgress: 0,
                completed: 0,
                totalIssues: 0
            }

        const checklistCompletionRate =
            checklistSummary.totalStores
                ? Math.round(
                    checklistSummary.completed /
                    checklistSummary.totalStores *
                    100
                )
                : 0

        /*
        |--------------------------------------------------------------------------
        | NORMALIZE INVENTORY
        |--------------------------------------------------------------------------
        */

        const inventoryData =
            inventoryResult[0] || {}

        const inventorySummary =
            inventoryData.summary?.[0] || {
                totalSku: 0,
                aman: 0,
                waspada: 0,
                siaga: 0,
                awas: 0,
                totalRecommendedQty: 0
            }

        const inventoryRiskSku =
            Number(
                inventorySummary.waspada || 0
            ) +
            Number(
                inventorySummary.siaga || 0
            ) +
            Number(
                inventorySummary.awas || 0
            )

        /*
        |--------------------------------------------------------------------------
        | NORMALIZE DEAD STOCK
        |--------------------------------------------------------------------------
        */

        const deadStockData =
            deadStockResult[0] || {}

        const deadStockSummary =
            deadStockData.summary?.[0] || {
                totalSku: 0,
                totalStock: 0,
                totalStockValue: 0,
                warning: 0,
                serious: 0,
                critical: 0
            }

        /*
        |--------------------------------------------------------------------------
        | NORMALIZE CASH
        |--------------------------------------------------------------------------
        */

        const cashBalance =
            cashResult[0]?.[0] || {
                currentCashBalance: 0
            }

        const cashTransaction =
            cashResult[1]?.[0] || {
                totalIn: 0,
                totalOut: 0,
                storeExpense: 0,
                ownerPersonal: 0,
                asonganPurchase: 0,
                materialExpense: 0,
                totalTransactions: 0
            }

        /*
        |--------------------------------------------------------------------------
        | RESPONSE
        |--------------------------------------------------------------------------
        */

        return res.status(200).json({
            status: true,

            data: {
                date:
                    today,

                checklist: {
                    totalStores:
                        Number(
                            checklistSummary.totalStores || 0
                        ),

                    pending:
                        Number(
                            checklistSummary.pending || 0
                        ),

                    inProgress:
                        Number(
                            checklistSummary.inProgress || 0
                        ),

                    completed:
                        Number(
                            checklistSummary.completed || 0
                        ),

                    totalIssues:
                        Number(
                            checklistSummary.totalIssues || 0
                        ),

                    completionRate:
                        checklistCompletionRate,

                    pendingShops:
                        checklistData.pendingShops || [],

                    issueShops:
                        checklistData.issueShops || []
                },

                inventory: {
                    date:
                        inventoryDate,

                    totalSku:
                        Number(
                            inventorySummary.totalSku || 0
                        ),

                    riskSku:
                        inventoryRiskSku,

                    statuses: {
                        AMAN:
                            Number(
                                inventorySummary.aman || 0
                            ),

                        WASPADA:
                            Number(
                                inventorySummary.waspada || 0
                            ),

                        SIAGA:
                            Number(
                                inventorySummary.siaga || 0
                            ),

                        AWAS:
                            Number(
                                inventorySummary.awas || 0
                            )
                    },

                    totalRecommendedQty:
                        Number(
                            inventorySummary.totalRecommendedQty || 0
                        ),

                    priority:
                        inventoryData.priority || []
                },

                deadStock: {
                    date:
                        deadStockDate,

                    totalSku:
                        Number(
                            deadStockSummary.totalSku || 0
                        ),

                    totalStock:
                        Number(
                            deadStockSummary.totalStock || 0
                        ),

                    totalStockValue:
                        Number(
                            deadStockSummary.totalStockValue || 0
                        ),

                    levels: {
                        WARNING:
                            Number(
                                deadStockSummary.warning || 0
                            ),

                        SERIOUS:
                            Number(
                                deadStockSummary.serious || 0
                            ),

                        CRITICAL:
                            Number(
                                deadStockSummary.critical || 0
                            )
                    },

                    priority:
                        deadStockData.priority || []
                },

                cash: {
                    currentCashBalance:
                        Number(
                            cashBalance.currentCashBalance || 0
                        ),

                    totalIn:
                        Number(
                            cashTransaction.totalIn || 0
                        ),

                    totalOut:
                        Number(
                            cashTransaction.totalOut || 0
                        ),

                    totalTransactions:
                        Number(
                            cashTransaction.totalTransactions || 0
                        ),

                    storeExpense:
                        Number(
                            cashTransaction.storeExpense || 0
                        ),

                    ownerPersonal:
                        Number(
                            cashTransaction.ownerPersonal || 0
                        ),

                    asonganPurchase:
                        Number(
                            cashTransaction.asonganPurchase || 0
                        ),

                    materialExpense:
                        Number(
                            cashTransaction.materialExpense || 0
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