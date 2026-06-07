const mongoose = require('mongoose')

const DeadStockDaily = require('../models/deadStockDaily')
const InventoryIntelDaily = require('../models/InventoryIntelDaily')
const ParentProductHealthDaily = require('../models/ParentProductHealthDaily')

function calculateHealthScore({
  warningVariants,
  seriousVariants,
  criticalVariants
}) {
  let score = 100

  score -= warningVariants * 5
  score -= seriousVariants * 15
  score -= criticalVariants * 25

  if (score < 0) score = 0

  return score
}

function getHealthStatus(score) {
  if (score >= 80) return 'HEALTHY'
  if (score >= 60) return 'WARNING'
  if (score >= 40) return 'SERIOUS'
  return 'CRITICAL'
}

function getRecommendation({
  healthStatus,
  criticalVariants,
  seriousVariants,
  totalStockValue
}) {
  if (healthStatus === 'CRITICAL' && totalStockValue >= 10000000) {
    return 'CLEARANCE CAMPAIGN'
  }

  if (criticalVariants >= 3) {
    return 'STOP SOME VARIANTS'
  }

  if (seriousVariants >= 3) {
    return 'REDUCE PRODUCTION'
  }

  if (healthStatus === 'HEALTHY') {
    return 'KEEP PRODUCTION'
  }

  return 'MONITOR'
}

function getDeadLevelWeight(level) {
  if (level === 'CRITICAL') return 3
  if (level === 'SERIOUS') return 2
  if (level === 'WARNING') return 1
  return 0
}

function getDeadLevelFromWeight(weight) {
  if (weight >= 3) return 'CRITICAL'
  if (weight >= 2) return 'SERIOUS'
  if (weight >= 1) return 'WARNING'
  return null
}

async function buildParentProductHealthDaily(dateStr) {
  const intelRows = await InventoryIntelDaily.aggregate([
    {
      $match: {
        date: dateStr
      }
    },
    {
      $lookup: {
        from: 'shops',
        localField: 'shopId',
        foreignField: '_id',
        as: 'shop'
      }
    },
    { $unwind: '$shop' },
    {
      $match: {
        'shop.type': {
          $in: ['STORE', 'ONLINE']
        }
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
      $addFields: {
        parentGroupId: {
          $ifNull: ['$product.parentId', '$product._id']
        }
      }
    },
    {
      $lookup: {
        from: 'products',
        localField: 'parentGroupId',
        foreignField: '_id',
        as: 'parentProduct'
      }
    },
    { $unwind: '$parentProduct' }
  ]).allowDiskUse(true)

  if (!intelRows.length) {
    await ParentProductHealthDaily.deleteMany({ date: dateStr })

    return {
      upserted: 0,
      removed: true
    }
  }

  /**
   * STEP 1
   * Consolidate InventoryIntelDaily dari level SKU x toko
   * menjadi level SKU unik.
   */
  const variantMap = new Map()

  for (const row of intelRows) {
    const product = row.product
    const parentProduct = row.parentProduct

    if (!product?._id || !parentProduct?._id) continue

    const productKey = String(product._id)

    if (!variantMap.has(productKey)) {
      variantMap.set(productKey, {
        productId: product._id,
        sku: product.sku,
        name: product.name,

        parentId: row.parentGroupId,
        parentSku: parentProduct.sku || null,
        parentName: parentProduct.name,

        purchase: product.purchase || 0,
        price: product.price || 0,

        totalStock: 0,
        totalStockValue: 0,

        totalAds: 0,
        shopCount: 0
      })
    }

    const variant = variantMap.get(productKey)

    const stockOnHand = row.stockOnHand || 0
    const unitCost = product.purchase || product.price || 0

    variant.totalStock += stockOnHand
    variant.totalStockValue += stockOnHand * unitCost

    variant.totalAds += row.ads || 0
    variant.shopCount += 1
  }

  /**
   * STEP 2
   * Consolidate DeadStockDaily dari level productId x shopId
   * menjadi level productId unik.
   */
  const deadRows = await DeadStockDaily.find({
    date: dateStr
  }).lean()

  const deadProductMap = new Map()

  for (const row of deadRows) {
    const productId = String(row.productId)

    if (!deadProductMap.has(productId)) {
      deadProductMap.set(productId, {
        productId: row.productId,
        sku: row.sku,
        name: row.name,
        stockValue: 0,
        stockOnHand: 0,
        maxDeadWeight: 0,
        shopCount: 0
      })
    }

    const item = deadProductMap.get(productId)

    item.stockValue += row.stockValue || 0
    item.stockOnHand += row.stockOnHand || 0
    item.shopCount += 1

    const weight = getDeadLevelWeight(row.deadLevel)

    if (weight > item.maxDeadWeight) {
      item.maxDeadWeight = weight
    }
  }

  /**
   * STEP 3
   * Group SKU unik ke parent product.
   */
  const parentMap = new Map()

  for (const variant of variantMap.values()) {
    const parentKey = String(variant.parentId)

    if (!parentMap.has(parentKey)) {
      parentMap.set(parentKey, {
        parentId: variant.parentId,
        parentSku: variant.parentSku,
        parentName: variant.parentName,

        totalVariants: 0,

        healthyVariants: 0,
        warningVariants: 0,
        seriousVariants: 0,
        criticalVariants: 0,

        totalStock: 0,
        totalStockValue: 0,

        totalAds: 0,

        topDeadVariantsMap: new Map()
      })
    }

    const parent = parentMap.get(parentKey)

    parent.totalVariants += 1
    parent.totalStock += variant.totalStock
    parent.totalStockValue += variant.totalStockValue
    parent.totalAds += variant.totalAds

    const dead = deadProductMap.get(String(variant.productId))

    if (!dead) {
      parent.healthyVariants += 1
      continue
    }

    const deadLevel = getDeadLevelFromWeight(dead.maxDeadWeight)

    if (deadLevel === 'WARNING') {
      parent.warningVariants += 1
    } else if (deadLevel === 'SERIOUS') {
      parent.seriousVariants += 1
    } else if (deadLevel === 'CRITICAL') {
      parent.criticalVariants += 1
    } else {
      parent.healthyVariants += 1
      continue
    }

    parent.topDeadVariantsMap.set(String(variant.productId), {
      productId: variant.productId,
      sku: variant.sku,
      name: variant.name,
      deadLevel,
      stockValue: dead.stockValue,
      stockOnHand: dead.stockOnHand,
      shopCount: dead.shopCount
    })
  }

  /**
   * STEP 4
   * Build bulk write.
   */
  const ops = []
  const validParentKeys = new Set()

  for (const parent of parentMap.values()) {
    const avgAds =
      parent.totalVariants > 0
        ? Number((parent.totalAds / parent.totalVariants).toFixed(4))
        : 0

    const healthScore = calculateHealthScore({
      warningVariants: parent.warningVariants,
      seriousVariants: parent.seriousVariants,
      criticalVariants: parent.criticalVariants
    })

    const healthStatus = getHealthStatus(healthScore)

    const recommendation = getRecommendation({
      healthStatus,
      criticalVariants: parent.criticalVariants,
      seriousVariants: parent.seriousVariants,
      totalStockValue: parent.totalStockValue
    })

    const topDeadVariants = [...parent.topDeadVariantsMap.values()]
      .sort((a, b) => b.stockValue - a.stockValue)
      .slice(0, 10)

    const doc = {
      date: dateStr,

      parentId: parent.parentId,
      parentSku: parent.parentSku,
      parentName: parent.parentName,

      totalVariants: parent.totalVariants,

      healthyVariants: parent.healthyVariants,
      warningVariants: parent.warningVariants,
      seriousVariants: parent.seriousVariants,
      criticalVariants: parent.criticalVariants,

      totalStock: parent.totalStock,
      totalStockValue: parent.totalStockValue,

      avgAds,

      healthScore,
      healthStatus,
      recommendation,

      topDeadVariants
    }

    validParentKeys.add(`${dateStr}_${parent.parentId}`)

    ops.push({
      updateOne: {
        filter: {
          date: dateStr,
          parentId: parent.parentId
        },
        update: {
          $set: doc
        },
        upsert: true
      }
    })
  }

  if (ops.length) {
    await ParentProductHealthDaily.bulkWrite(ops, {
      ordered: false
    })
  }

  /**
   * STEP 5
   * Cleanup snapshot lama untuk tanggal yang sama.
   */
  const currentRows = await ParentProductHealthDaily.find({
    date: dateStr
  })
    .select('parentId')
    .lean()

  const deleteIds = currentRows
    .filter(row => !validParentKeys.has(`${dateStr}_${row.parentId}`))
    .map(row => row._id)

  if (deleteIds.length) {
    await ParentProductHealthDaily.deleteMany({
      _id: { $in: deleteIds }
    })
  }

  return {
    upserted: ops.length,
    removed: deleteIds.length
  }
}

module.exports = {
  buildParentProductHealthDaily
}