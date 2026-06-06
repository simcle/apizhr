const mongoose = require('mongoose')

const InventoryIntelDaily = require('../models/InventoryIntelDaily')
const SalesDaily = require('../models/SalesDaily')
const DeadStockDaily = require('../models/DeadStockDaily')

function daysBetweenWIB(dateA, dateB) {
  const a = new Date(`${dateA}T00:00:00+07:00`)
  const b = new Date(`${dateB}T00:00:00+07:00`)
  return Math.floor((a - b) / (1000 * 60 * 60 * 24))
}

function getDeadLevel({ daysNoSale, stockOnHand, stockValue }) {
  if (daysNoSale >= 365 && stockOnHand > 0) {
    return {
      level: 'CRITICAL',
      action: 'CLEARANCE',
      message: 'Tidak terjual lebih dari 1 tahun'
    }
  }

  if (daysNoSale >= 180 && stockOnHand >= 10 && stockValue >= 2000000) {
    return {
      level: 'SERIOUS',
      action: 'DISCOUNT',
      message: 'Stok besar dan tidak bergerak lebih dari 180 hari'
    }
  }

  if (daysNoSale >= 90 && stockOnHand >= 5 && stockValue >= 500000) {
    return {
      level: 'WARNING',
      action: 'PROMO',
      message: 'Mulai lambat bergerak lebih dari 90 hari'
    }
  }

  return null
}

async function buildDeadStockDailyForDate(dateStr) {
  const intelRows = await InventoryIntelDaily.aggregate([
    {
      $match: {
        date: dateStr,
        stockOnHand: { $gt: 0 },
        ads: { $lte: 0.1 }
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
    { $unwind: '$product' }
  ]).allowDiskUse(true)

  if (!intelRows.length) {
    await DeadStockDaily.deleteMany({ date: dateStr })
    return { upserted: 0, deleted: true }
  }

  const productIds = [
    ...new Set(intelRows.map(row => String(row.product._id)))
  ]

  const shopIds = [
    ...new Set(intelRows.map(row => String(row.shop._id)))
  ]

  const lastSales = await SalesDaily.aggregate([
    {
      $match: {
        productId: {
          $in: productIds.map(id => new mongoose.Types.ObjectId(id))
        },
        shopId: {
          $in: shopIds.map(id => new mongoose.Types.ObjectId(id))
        }
      }
    },
    {
      $group: {
        _id: {
          productId: '$productId',
          shopId: '$shopId'
        },
        lastSoldDate: { $max: '$date' },
        lifetimeQtySold: { $sum: '$qtySold' }
      }
    }
  ]).allowDiskUse(true)

  const salesMap = new Map()

  lastSales.forEach(item => {
    salesMap.set(
      `${item._id.productId}_${item._id.shopId}`,
      {
        lastSoldDate: item.lastSoldDate,
        lifetimeQtySold: item.lifetimeQtySold
      }
    )
  })

  const ops = []
  const validKeys = new Set()

  for (const row of intelRows) {
    if (!row.product?._id || !row.shop?._id) continue

    const key = `${row.product._id}_${row.shop._id}`
    const salesInfo = salesMap.get(key)

    const lastSoldDate = salesInfo?.lastSoldDate || null
    const lifetimeQtySold = salesInfo?.lifetimeQtySold || 0

    const daysNoSale = lastSoldDate
      ? daysBetweenWIB(dateStr, lastSoldDate)
      : 9999

    const unitCost = row.product.purchase || row.product.price || 0
    const stockValue = row.stockOnHand * unitCost

    const dead = getDeadLevel({
      daysNoSale,
      stockOnHand: row.stockOnHand,
      stockValue
    })

    if (!dead) continue

    const parentId = row.product.parentId || row.product._id

    const doc = {
      date: dateStr,

      shopId: row.shop._id,
      shopName: row.shop.name,
      shopType: row.shop.type,

      productId: row.product._id,
      parentId,

      sku: row.product.sku,
      name: row.product.name,

      stockOnHand: row.stockOnHand,
      ads: row.ads,

      lastSoldDate,
      daysNoSale,
      lifetimeQtySold,

      unitCost,
      stockValue,

      deadLevel: dead.level,
      recommendedAction: dead.action,
      message: dead.message
    }

    validKeys.add(`${dateStr}_${row.shop._id}_${row.product._id}`)

    ops.push({
      updateOne: {
        filter: {
          date: dateStr,
          shopId: row.shop._id,
          productId: row.product._id
        },
        update: { $set: doc },
        upsert: true
      }
    })
  }

  if (ops.length) {
    await DeadStockDaily.bulkWrite(ops, { ordered: false })
  }

  // optional cleanup: hapus dead stock lama di tanggal ini yang sudah tidak valid
  const currentRows = await DeadStockDaily.find({ date: dateStr })
    .select('shopId productId')
    .lean()

  const deleteIds = currentRows
    .filter(row => !validKeys.has(`${dateStr}_${row.shopId}_${row.productId}`))
    .map(row => row._id)

  if (deleteIds.length) {
    await DeadStockDaily.deleteMany({ _id: { $in: deleteIds } })
  }

  return {
    upserted: ops.length,
    removed: deleteIds.length
  }
}

module.exports = { buildDeadStockDailyForDate }