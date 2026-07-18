const SupplierModel = require('../models/supplier')
const ProductModel = require('../models/products');
const PurchaseModel = require('../models/purchases');
const ReceiptModel = require('../models/receipts');
const SalesModel = require('../models/sales')
const OnlineModel = require('../models/online')
const MitraPayments = require('../models/mitraPayment')

const InventoryIntelDaily = require ('../models/InventoryIntelDaily')

async function getLatestSnapshotDate() {
  const latest = await InventoryIntelDaily
    .findOne({})
    .sort({ date: -1 })
    .select('date')
    .lean();

  return latest?.date || null;
}

exports.getStatistics = async (req, res) => {
    const date = await getLatestSnapshotDate()

    
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const startOfNextMonth = new Date(startOfMonth)
    startOfNextMonth.setMonth(startOfNextMonth.getMonth() + 1)
    const demandForecast = InventoryIntelDaily.aggregate([
        {
            $match: {
                date,
                action: 'ORDER'
            }
        },
        {$group: {
            _id: '$productId',
            date: {$first: '$date'},
            action: {$addToSet: '$action'},
            rop: {$sum: '$rop'},
            ads: {$avg: '$ads'},
            status: {$addToSet: '$status'},
            leadTimeDays: {$first: '$leadTimeDays'},
            totalDemand: {$sum: '$sumSoldWindow'},
            totalRecommended: { $sum: "$recommendedQty" },
            totalWarehouseStock: { $first: "$warehouseStockOnHand" },
            avgPriority: { $avg: "$priorityScore" }
        }},
        {
            $addFields: {
            netToOrder: {
                $max: [
                { $subtract: ["$totalRecommended", "$totalWarehouseStock"] },
                    0
                ]
            }
            }
        },
        { $match: { netToOrder: { $gt: 0 } } },
        {
            $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product"
            }
        },
        { $unwind: "$product" },
        {
            $match: {
            "product.flow": 'Receipts'
            }
        },
        {
            $group: {
                _id: null,
                totalQty: {$sum: '$netToOrder'}
            }
        }
    ])

    const purchaseThisMonth = PurchaseModel.aggregate([
        {
            $match: {
                invoiceDate: {
                    $gte: startOfMonth,
                    $lt: startOfNextMonth
                }
            }
        },
        {$unwind: '$items'},
        {$group: {
            _id: null,
            totalQty: {$sum: '$items.qty'}
        }}
    ])
    const purchase = PurchaseModel.aggregate([
        { $match: { status: 'RFQ SENT' } },
        { $unwind: '$items' },
        { $group: {
            _id: null,
            totalQty: { $sum: '$items.qty'}
        }}
    ])

    const receipt = ReceiptModel.aggregate([
        {$match: {
            createdAt: {
                $gte: startOfMonth,
                $lt: startOfNextMonth
            }
        }},
        {$unwind: '$items'},
        { $group: {
            _id: null,
            totalQty: { $sum: '$items.qty'}
        }}
    ])

    const offlineSales = SalesModel.aggregate([
        {$match: {
            createdAt: {
                $gte: startOfMonth,
                $lt: startOfNextMonth
            }
        }},
        {$unwind: '$items'},
        { $group: {
            _id: null,
            totalQty: { $sum: '$items.qty'}
        }}

    ])
    const onlineSales = OnlineModel.aggregate([
        {$match: {
            createdAt: {
                $gte: startOfMonth,
                $lt: startOfNextMonth
            }
        }},
        {$unwind: '$items'},
        { $group: {
            _id: null,
            totalQty: { $sum: '$items.qty'}
        }}

    ])
    const mitraSales = MitraPayments.aggregate([
        {$match: {
            createdAt: {
                $gte: startOfMonth,
                $lt: startOfNextMonth
            }
        }},
        {$unwind: '$items'},
        {$group: {
            _id: null,
            totalQty: {$sum: '$items.qty'}
        }}
    ])
    Promise.all([
        demandForecast,
        purchaseThisMonth,
        purchase,
        receipt,
        offlineSales,
        onlineSales,
        mitraSales
    ])
    .then((result) => {

        const offlineSalesQty = result[4][0]?.totalQty || 0
        const onlineSalesQty = result[5][0]?.totalQty || 0
        const mitraSalesQty = result[6][0]?.totalQty || 0
        res.status(200).json({
            demandForecast: result[0][0]?.totalQty || 0,
            purchaseThisMonth: result[1][0]?.totalQty || 0,
            purchase: result[2][0]?.totalQty || 0,
            receipt: result[3][0]?.totalQty || 0,
            sales: offlineSalesQty + onlineSalesQty + mitraSalesQty
        })
    })
}

exports.getReport = async (req, res) => {
    try {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const startOfNextMonth = new Date(startOfMonth)
        startOfNextMonth.setMonth(startOfNextMonth.getMonth() + 1)

        const [
            purchaseSummary,
            receiptSummary,
            suppliers
        ] = await Promise.all([
            PurchaseModel.aggregate([
                {
                    $match: {
                        status: 'RFQ SENT'
                    }
                },
                {
                    $unwind: '$items'
                },
                {
                    $group: {
                        _id: '$supplierId',
                        totalQty: {
                            $sum: {
                                $ifNull: ['$items.qty', 0]
                            }
                        },
                        invoiceIds: {
                            $addToSet: '$_id'
                        },
                        invoiceDate: {
                            $max: '$invoiceDate'
                        }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        totalQty: 1,
                        invoiceDate: 1,
                        invoiceCount: {
                            $size: '$invoiceIds'
                        }
                    }
                }
            ]),

            ReceiptModel.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gte: startOfMonth,
                            $lt: startOfNextMonth
                        }
                    }
                },
                {
                    $unwind: '$items'
                },
                {
                    $group: {
                        _id: '$supplierId',
                        totalQty: {
                            $sum: {
                                $ifNull: ['$items.qty', 0]
                            }
                        },
                        receiptIds: {
                            $addToSet: '$_id'
                        }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        totalQty: 1,
                        receiptCount: {
                            $size: '$receiptIds'
                        }
                    }
                }
            ]),

            SupplierModel.find(
                {},
                {
                    name: 1
                }
            ).lean()
        ])

        const purchaseMap = new Map(
            purchaseSummary.map(item => [
                item._id.toString(),
                item
            ])
        )

        const receiptMap = new Map(
            receiptSummary.map(item => [
                item._id.toString(),
                item
            ])
        )

        const result = suppliers
            .map(supplier => {
                const supplierId = supplier._id.toString()

                const purchase =
                    purchaseMap.get(supplierId)

                const receipt =
                    receiptMap.get(supplierId)

                return {
                    _id: supplier._id,
                    supplier: supplier.name,

                    sedangProduksi:
                        purchase?.totalQty || 0,

                    barangMasuk:
                        receipt?.totalQty || 0,

                    invoiceCount:
                        purchase?.invoiceCount || 0,

                    receiptCount:
                        receipt?.receiptCount || 0,

                    invoiceDate:
                        purchase?.invoiceDate || null
                }
            })
            .filter(item =>
                item.sedangProduksi > 0 ||
                item.barangMasuk > 0
            )
            .sort((a, b) =>
                b.sedangProduksi -
                a.sedangProduksi
            )

        return res.status(200).json(result)

    } catch (error) {
        console.error(
            'Error get purchase report:',
            error
        )

        return res.status(500).json({
            message: 'Gagal mengambil laporan supplier',
            error: error.message
        })
    }
}