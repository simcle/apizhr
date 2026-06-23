const InventoryIntelDaily = require('../models/InventoryIntelDaily')
const TransferRecommendationDaily = require('../models/TransferRecommendationDaily')
const DeadStockGlobalDaily = require('../models/DeadStockGlobalDaily')
const ParentProductHealthDaily = require('../models/ParentProductHealthDaily')
const PurchasingPlanDaily = require('../models/PurchasingPlanDaily')

async function buildPurchasingPlanDaily(dateStr) {
  const orderRows = await InventoryIntelDaily.aggregate([
    {
      $match: {
        date: dateStr,
        action: 'ORDER'
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
      $group: {
        _id: '$productId',

        product: { $first: '$product' },
        category: { $first: '$category' },

        totalDemand: { $sum: '$sumSoldWindow' },
        totalRecommended: { $sum: '$recommendedQty' },

        warehouseStock: { $first: '$warehouseStockOnHand' },

        avgPriority: { $avg: '$priorityScore' },
        avgAds: { $avg: '$ads' },
        rop: { $sum: '$rop' }
      }
    }
  ]).allowDiskUse(true)

  if (!orderRows.length) {
    await PurchasingPlanDaily.deleteMany({ date: dateStr })
    return { upserted: 0, removed: true }
  }

  const transferRows = await TransferRecommendationDaily.aggregate([
    { $match: { date: dateStr } },
    {
      $group: {
        _id: '$productId',
        transferAvailableQty: { $sum: '$transferQty' }
      }
    }
  ])

  const transferMap = new Map()
  transferRows.forEach(row => {
    transferMap.set(String(row._id), row.transferAvailableQty || 0)
  })

  const deadRows = await DeadStockGlobalDaily.find({ date: dateStr }).lean()

  const deadMap = new Map()
  deadRows.forEach(row => {
    deadMap.set(String(row.productId), row)
  })

  const parentRows = await ParentProductHealthDaily.find({ date: dateStr }).lean()

  const parentMap = new Map()
  parentRows.forEach(row => {
    parentMap.set(String(row.parentId), row)
  })

  const ops = []
  const validKeys = new Set()

  for (const row of orderRows) {
    const product = row.product
    if (!product?._id) continue

    const productId = String(product._id)
    const parentId = product.parentId || product._id

    const transferAvailableQty = transferMap.get(productId) || 0
    const deadInfo = deadMap.get(productId)
    const parentHealth = parentMap.get(String(parentId))

    const warehouseStock = row.warehouseStock || 0
    const totalRecommended = row.totalRecommended || 0

    const netToBuy = Math.max(
      totalRecommended - warehouseStock - transferAvailableQty,
      0
    )

    const purchase = product.purchase || 0
    const estimatedValue = netToBuy * purchase

    const reasons = []
    let planAction = 'BUY'

    if (netToBuy <= 0) {
      planAction = 'NO_ACTION'
      reasons.push('ENOUGH_STOCK')
    } else if (deadInfo) {
      planAction = 'DO_NOT_BUY'
      reasons.push('GLOBAL_DEAD_STOCK')
    } else if (parentHealth?.healthStatus === 'CRITICAL') {
      planAction = 'BUY_WITH_REVIEW'
      reasons.push('PARENT_CRITICAL')
    } else if (transferAvailableQty > 0) {
      planAction = 'TRANSFER_FIRST'
      reasons.push('TRANSFER_AVAILABLE')
    } else {
      planAction = 'BUY'
      reasons.push('ORDER_REQUIRED')
    }

    if ((row.totalDemand || 0) > 50) {
      reasons.push('HIGH_DEMAND')
    }

    const doc = {
      date: dateStr,

      productId: product._id,

      sku: product.sku,
      name: product.name,

      parentId,
      parentName: parentHealth?.parentName || product.name,

      categoryId: product.categoryId || null,
      categoryName: row.category?.name || null,

      flow: product.flow || null,

      purchase,

      leadTime: product.leadTime || 0,
      safetyDays: product.safetyDays || 0,

      totalDemand: row.totalDemand || 0,
      totalRecommended,

      warehouseStock,
      transferAvailableQty,

      netToBuy,
      estimatedValue,

      parentHealthStatus: parentHealth?.healthStatus || 'UNKNOWN',
      parentHealthScore: parentHealth?.healthScore || 100,

      isGlobalDeadStock: !!deadInfo,
      deadLevel: deadInfo?.deadLevel || null,

      priorityScore: Number((row.avgPriority || 0).toFixed(3)),

      planAction,
      reasons
    }

    validKeys.add(`${dateStr}_${product._id}`)

    ops.push({
      updateOne: {
        filter: {
          date: dateStr,
          productId: product._id
        },
        update: { $set: doc },
        upsert: true
      }
    })
  }

  if (ops.length) {
    await PurchasingPlanDaily.bulkWrite(ops, { ordered: false })
  }

  const currentRows = await PurchasingPlanDaily.find({ date: dateStr })
    .select('productId')
    .lean()

  const deleteIds = currentRows
    .filter(row => !validKeys.has(`${dateStr}_${row.productId}`))
    .map(row => row._id)

  if (deleteIds.length) {
    await PurchasingPlanDaily.deleteMany({
      _id: { $in: deleteIds }
    })
  }

  return {
    upserted: ops.length,
    removed: deleteIds.length
  }
}

module.exports = {
  buildPurchasingPlanDaily
}