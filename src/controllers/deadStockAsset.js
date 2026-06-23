const mongoose = require('mongoose')

const Inventory = require('../models/inventory')
const DeadStockDaily = require('../models/deadStockDaily')
const InventoryIntelDaily = require('../models/InventoryIntelDaily')

async function getLatestSnapshotDate() {
  const latest = await InventoryIntelDaily
    .findOne({})
    .sort({ date: -1 })
    .select('date')
    .lean()

  return latest?.date || null
}

exports.getDeadStockAssetSummary = async (req, res) => {
  try {
    let date = req.query.date || await getLatestSnapshotDate()

    if (!date) {
      return res.json({
        status: true,
        date: null,
        summary: {
          totalDeadSku: 0,
          totalQty: 0,
          totalValue: 0
        },
        byLocationType: [],
        byLocation: []
      })
    }

    const deadMatch = { date }

    if (req.query.level) {
      deadMatch.deadLevel = req.query.level
    }

    // ambil SKU yang masuk dead stock di toko/online
    const deadRows = await DeadStockDaily.find(deadMatch)
      .select('productId')
      .lean()

    const productIds = [
      ...new Set(
        deadRows
          .filter(row => row.productId)
          .map(row => String(row.productId))
      )
    ].map(id => new mongoose.Types.ObjectId(id))

    if (!productIds.length) {
      return res.json({
        status: true,
        date,
        summary: {
          totalDeadSku: 0,
          totalQty: 0,
          totalValue: 0
        },
        byLocationType: [],
        byLocation: []
      })
    }

    const rows = await Inventory.aggregate([
      {
        $match: {
          productId: { $in: productIds },
          qty: { $gt: 0 }
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
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'shops',
          localField: 'shopId',
          foreignField: '_id',
          as: 'shop'
        }
      },
      {
        $unwind: {
          path: '$shop',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          unitCost: {
            $ifNull: [
              '$product.purchase',
              { $ifNull: ['$product.price', 0] }
            ]
          },
          stockValue: {
            $multiply: [
              '$qty',
              {
                $ifNull: [
                  '$product.purchase',
                  { $ifNull: ['$product.price', 0] }
                ]
              }
            ]
          },
          locationType: {
            $ifNull: ['$shop.type', 'UNKNOWN']
          },
          locationName: {
            $ifNull: ['$shop.name', 'UNKNOWN']
          }
        }
      },
      {
        $facet: {
          overall: [
            {
              $group: {
                _id: null,
                skuSet: { $addToSet: '$productId' },
                totalQty: { $sum: '$qty' },
                totalValue: { $sum: '$stockValue' }
              }
            },
            {
              $project: {
                _id: 0,
                totalDeadSku: { $size: '$skuSet' },
                totalQty: 1,
                totalValue: 1
              }
            }
          ],

          byLocationType: [
            {
              $group: {
                _id: '$locationType',
                skuSet: { $addToSet: '$productId' },
                totalQty: { $sum: '$qty' },
                totalValue: { $sum: '$stockValue' }
              }
            },
            {
              $project: {
                _id: 0,
                locationType: '$_id',
                totalDeadSku: { $size: '$skuSet' },
                totalQty: 1,
                totalValue: 1
              }
            },
            { $sort: { totalValue: -1 } }
          ],

          byLocation: [
            {
              $group: {
                _id: '$shopId',
                shopName: { $first: '$locationName' },
                shopType: { $first: '$locationType' },
                skuSet: { $addToSet: '$productId' },
                totalQty: { $sum: '$qty' },
                totalValue: { $sum: '$stockValue' }
              }
            },
            {
              $project: {
                _id: 0,
                shopId: '$_id',
                shopName: 1,
                shopType: 1,
                totalDeadSku: { $size: '$skuSet' },
                totalQty: 1,
                totalValue: 1
              }
            },
            { $sort: { totalValue: -1 } }
          ]
        }
      }
    ]).allowDiskUse(true)

    const result = rows[0] || {}

    res.json({
      status: true,
      date,
      level: req.query.level || null,
      summary: result.overall?.[0] || {
        totalDeadSku: 0,
        totalQty: 0,
        totalValue: 0
      },
      byLocationType: result.byLocationType || [],
      byLocation: result.byLocation || []
    })

  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message
    })
  }
}