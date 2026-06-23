const SupplierModel = require('../models/supplier')
const ProductModel = require('../models/products');
const PurchaseModel = require('../models/purchases');
const ReceiptModel = require('../models/receipts');
const SalesModel = require('../models/sales')
const OnlineModel = require('../models/online')
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
    Promise.all([
        demandForecast,
        purchaseThisMonth,
        purchase,
        receipt,
        offlineSales,
        onlineSales
    ])
    .then((result) => {

        const offlineSalesQty = result[4][0]?.totalQty || 0
        const onlineSalesQty = result[5][0]?.totalQty || 0

        res.status(200).json({
            demandForecast: result[0][0]?.totalQty || 0,
            purchaseThisMonth: result[1][0]?.totalQty || 0,
            purchase: result[2][0]?.totalQty || 0,
            receipt: result[3][0]?.totalQty || 0,
            sales: offlineSalesQty + onlineSalesQty
        })
    })
}

exports.getReport = (req, res) => {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const startOfNextMonth = new Date(startOfMonth)
    startOfNextMonth.setMonth(startOfNextMonth.getMonth() + 1)
    
    SupplierModel.aggregate([
        {
            $lookup: {
            from: 'purchases',
            let: { supplierId: '$_id' },
            pipeline: [
                {
                $match: {
                    $expr: { $eq: ['$supplierId', '$$supplierId'] },
                    status: 'RFQ SENT'
                }
                },
                { $unwind: '$items' },
                {
                $group: {
                    _id: null,
                    totalQty: { $sum: '$items.qty' },
                    invoices: { $addToSet: '$_id' },
                    createdAt: {$first: '$invoiceDate'}
                }
                },
                {
                $project: {
                    _id: 0,
                    totalQty: 1,
                    createdAt: 1,
                    invoiceCount: { $size: '$invoices' }
                }
                }
            ],
            as: 'purchaseData'
            }
        },
        {
            $lookup: {
            from: 'receipts',
            let: { supplierId: '$_id' },
            pipeline: [
                {
                    $match: {
                        $expr: { $eq: ['$supplierId', '$$supplierId'] },
                        createdAt: {
                            $gte: startOfMonth,
                            $lt: startOfNextMonth
                        }
                    }
                },
                { $unwind: '$items' },
                {
                $group: {
                    _id: null,
                    totalQty: { $sum: '$items.qty' },
                    receipts: { $addToSet: '$_id' }
                }
                },
                {
                $project: {
                    _id: 0,
                    totalQty: 1,
                    receiptCount: { $size: '$receipts' }
                }
                }
            ],
            as: 'receiptData'
            }
        },
        {
            $addFields: {
            sedangProduksi: {
                $ifNull: [{ $arrayElemAt: ['$purchaseData.totalQty', 0] }, 0]
            },
            barangMasuk: {
                $ifNull: [{ $arrayElemAt: ['$receiptData.totalQty', 0] }, 0]
            },
            invoiceCount: {
                $ifNull: [{ $arrayElemAt: ['$purchaseData.invoiceCount', 0] }, 0]
            },
            receiptCount: {
                $ifNull: [{ $arrayElemAt: ['$receiptData.receiptCount', 0] }, 0]
            },
            invoiceDate: {
                $ifNull: [{ $arrayElemAt: ['$purchaseData.createdAt', 0] }, 0]
            }
            }
        },
        {
            $project: {
            supplier: '$name',
            sedangProduksi: 1,
            barangMasuk: 1,
            invoiceCount: 1,
            receiptCount: 1,
            invoiceDate: 1
            }
        },
        {
            $match: {
            $or: [
                { sedangProduksi: { $gt: 0 } },
                { barangMasuk: { $gt: 0 } }
            ]
            }
        },
        {
            $sort: {
            sedangProduksi: -1
            }
        }
    ])
    .then(result => {
        res.status(200).json(result)
    }) 
}