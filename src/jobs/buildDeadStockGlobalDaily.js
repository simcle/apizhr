const mongoose = require('mongoose')

const InventoryIntelDaily = require('../models/InventoryIntelDaily')
const SalesDaily = require('../models/SalesDaily')
const DeadStockGlobalDaily = require('../models/DeadStockGlobalDaily')

function daysBetweenWIB(dateA, dateB) {
  const a = new Date(`${dateA}T00:00:00+07:00`)
  const b = new Date(`${dateB}T00:00:00+07:00`)
  return Math.floor((a - b) / (1000 * 60 * 60 * 24))
}

function getDeadLevel({ daysNoSale, totalStock, totalStockValue }) {
  if (daysNoSale >= 365 && totalStock > 0) {
    return {
      level: 'CRITICAL',
      action: 'CLEARANCE',
      message: 'Tidak terjual di seluruh toko lebih dari 1 tahun'
    }
  }

  if (daysNoSale >= 180 && totalStock >= 10 && totalStockValue >= 2000000) {
    return {
      level: 'SERIOUS',
      action: 'DISCOUNT',
      message: 'Stok global besar dan tidak bergerak lebih dari 180 hari'
    }
  }

  if (daysNoSale >= 90 && totalStock >= 5 && totalStockValue >= 500000) {
    return {
      level: 'WARNING',
      action: 'PROMO',
      message: 'Mulai lambat secara global lebih dari 90 hari'
    }
  }

  return null
}

async function buildDeadStockGlobalDailyForDate(dateStr) {
  const rows = await InventoryIntelDaily.aggregate([
    {
      $match: {
        date: dateStr,
        stockOnHand: { $gt: 0 }
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
        'shop.type': { $in: ['STORE', 'ONLINE'] }
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
        totalStock: { $sum: '$stockOnHand' },
        totalAds: { $sum: '$ads' },
        shopCount: { $sum: 1 }
      }
    }
  ]).allowDiskUse(true)

  if (!rows.length) {
    await DeadStockGlobalDaily.deleteMany({ date: dateStr })
    return { upserted: 0, removed: true }
  }

  const productIds = rows.map(row => row._id)

  const lastSales = await SalesDaily.aggregate([
    {
      $match: {
        productId: { $in: productIds }
      }
    },
    {
      $group: {
        _id: '$productId',
        lastSoldDate: { $max: '$date' },
        lifetimeQtySold: { $sum: '$qtySold' }
      }
    }
  ]).allowDiskUse(true)

  const salesMap = new Map()

  lastSales.forEach(row => {
    salesMap.set(String(row._id), {
      lastSoldDate: row.lastSoldDate,
      lifetimeQtySold: row.lifetimeQtySold
    })
  })

  const ops = []
  const validKeys = new Set()

  for (const row of rows) {
    const product = row.product
    if (!product?._id) continue

    const salesInfo = salesMap.get(String(row._id))

    const lastSoldDate = salesInfo?.lastSoldDate || null
    const lifetimeQtySold = salesInfo?.lifetimeQtySold || 0

    const daysNoSale = lastSoldDate
      ? daysBetweenWIB(dateStr, lastSoldDate)
      : 9999

    const unitCost = product.purchase || product.price || 0
    const totalStockValue = row.totalStock * unitCost

    const dead = getDeadLevel({
      daysNoSale,
      totalStock: row.totalStock,
      totalStockValue
    })

    if (!dead) continue

    const parentId = product.parentId || product._id

    const doc = {
      date: dateStr,

      productId: product._id,
      parentId,

      categoryId: product.categoryId || null,
      categoryName: row.category?.name || null,

      sku: product.sku,
      name: product.name,

      totalStock: row.totalStock,
      totalStockValue,

      totalAds: row.totalAds,
      avgAds: row.shopCount > 0
        ? Number((row.totalAds / row.shopCount).toFixed(4))
        : 0,

      lastSoldDate,
      daysNoSale,
      lifetimeQtySold,

      shopCount: row.shopCount,

      deadLevel: dead.level,
      recommendedAction: dead.action,
      message: dead.message
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
    await DeadStockGlobalDaily.bulkWrite(ops, { ordered: false })
  }

  const currentRows = await DeadStockGlobalDaily.find({ date: dateStr })
    .select('productId')
    .lean()

  const deleteIds = currentRows
    .filter(row => !validKeys.has(`${dateStr}_${row.productId}`))
    .map(row => row._id)

  if (deleteIds.length) {
    await DeadStockGlobalDaily.deleteMany({ _id: { $in: deleteIds } })
  }

  return {
    upserted: ops.length,
    removed: deleteIds.length
  }
}

module.exports = { buildDeadStockGlobalDailyForDate }