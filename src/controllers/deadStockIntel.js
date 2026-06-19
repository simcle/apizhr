const mongoose = require('mongoose')
const DeadStockDaily = require('../models/deadStockDaily')
const DeadStockGlobalDaily = require('../models/DeadStockGlobalDaily')
const InventoryIntelDaily = require('../models/InventoryIntelDaily')

async function getLatestSnapshotDate() {
  const latest = await InventoryIntelDaily
    .findOne({})
    .sort({ date: -1 })
    .select('date')
    .lean()

  return latest?.date || null
}

exports.getVariantDeadStock = async (req, res) => {
  try {
    let date = req.query.date || await getLatestSnapshotDate()

    if (!date) {
      return res.json({
        status: true,
        date: null,
        page: 1,
        limit: 0,
        total: 0,
        totalPages: 0,
        data: []
      })
    }

    const page = Math.max(Number(req.query.page || 1), 1)
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 500)
    const skip = (page - 1) * limit

    const match = { date }

    if (req.query.shopId) {
      match.shopId = new mongoose.Types.ObjectId(req.query.shopId)
    }

    if (req.query.level) {
      match.deadLevel = req.query.level
    }

    if (req.query.action) {
      match.recommendedAction = req.query.action
    }

    const [total, data] = await Promise.all([
      DeadStockDaily.countDocuments(match),

      DeadStockDaily.find(match)
        .sort({ stockValue: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ])

    res.json({
      status: true,
      date,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
      data
    })
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message
    })
  }
}


exports.getDeadStockSummary = async (req, res) => {
  try {
    let date = req.query.date || await getLatestSnapshotDate()
    if (!date) {
      return res.json({
        status: true,
        date: null,
        summary: {
          totalSku: 0,
          totalStock: 0,
          totalStockValue: 0,
          levels: {
            WARNING: { count: 0, stockValue: 0 },
            SERIOUS: { count: 0, stockValue: 0 },
            CRITICAL: { count: 0, stockValue: 0 }
          },
          actions: {
            PROMO: { count: 0, stockValue: 0 },
            DISCOUNT: { count: 0, stockValue: 0 },
            CLEARANCE: { count: 0, stockValue: 0 }
          }
        }
      })
    }
    const match = { date }
    if (req.query.shopId) {
      match.shopId = new mongoose.Types.ObjectId(req.query.shopId)
    }

    const rows = await DeadStockDaily.aggregate([
      { $match: match },
      {
        $facet: {
          overall: [
            {
              $group: {
                _id: null,
                totalSku: { $sum: 1 },
                totalStock: { $sum: '$stockOnHand' },
                totalStockValue: { $sum: '$stockValue' }
              }
            }
          ],

          byLevel: [
            {
              $group: {
                _id: '$deadLevel',
                count: { $sum: 1 },
                stock: { $sum: '$stockOnHand' },
                stockValue: { $sum: '$stockValue' }
              }
            }
          ],

          byAction: [
            {
              $group: {
                _id: '$recommendedAction',
                count: { $sum: 1 },
                stock: { $sum: '$stockOnHand' },
                stockValue: { $sum: '$stockValue' }
              }
            }
          ]
        }
      }
    ])

    const result = rows[0] || {}
    const overall = result.overall?.[0] || {
      totalSku: 0,
      totalStock: 0,
      totalStockValue: 0
    }

    const levels = {
      WARNING: { count: 0, stock: 0, stockValue: 0 },
      SERIOUS: { count: 0, stock: 0, stockValue: 0 },
      CRITICAL: { count: 0, stock: 0, stockValue: 0 }
    }

    for (const item of result.byLevel || []) {
      if (levels[item._id]) {
        levels[item._id] = {
          count: item.count,
          stock: item.stock,
          stockValue: item.stockValue
        }
      }
    }

    const actions = {
      PROMO: { count: 0, stock: 0, stockValue: 0 },
      DISCOUNT: { count: 0, stock: 0, stockValue: 0 },
      CLEARANCE: { count: 0, stock: 0, stockValue: 0 }
    }

    for (const item of result.byAction || []) {
      if (actions[item._id]) {
        actions[item._id] = {
          count: item.count,
          stock: item.stock,
          stockValue: item.stockValue
        }
      }
    }

    res.json({
      status: true,
      date,
      shopId: req.query.shopId || null,
      summary: {
        totalSku: overall.totalSku,
        totalStock: overall.totalStock,
        totalStockValue: overall.totalStockValue,
        levels,
        actions
      }
    })
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message
    })
  }
}

exports.getDeadStockTopValue = async (req, res) => {
  try {
    let date = req.query.date || await getLatestSnapshotDate()

    if (!date) {
      return res.json({
        status: true,
        date: null,
        total: 0,
        data: []
      })
    }

    const limit = Math.min(Number(req.query.limit || 50), 200)

    const match = { date }

    if (req.query.shopId) {
      match.shopId = new mongoose.Types.ObjectId(req.query.shopId)
    }

    if (req.query.level) {
      match.deadLevel = req.query.level
    }

    const data = await DeadStockDaily.find(match)
      .sort({ stockValue: -1 })
      .limit(limit)
      .lean()

    res.json({
      status: true,
      date,
      total: data.length,
      data
    })
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message
    })
  }
}

exports.getDeadStockByShop = async (req, res) => {
  try {
    let date = req.query.date || await getLatestSnapshotDate()

    if (!date) {
      return res.json({
        status: true,
        date: null,
        total: 0,
        data: []
      })
    }

    const match = { date }

    if (req.query.level) {
      match.deadLevel = req.query.level
    }

    const data = await DeadStockDaily.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$shopId',
          shopName: { $first: '$shopName' },
          shopType: { $first: '$shopType' },
          totalSku: { $sum: 1 },
          totalStock: { $sum: '$stockOnHand' },
          totalStockValue: { $sum: '$stockValue' },
          warningCount: {
            $sum: { $cond: [{ $eq: ['$deadLevel', 'WARNING'] }, 1, 0] }
          },
          seriousCount: {
            $sum: { $cond: [{ $eq: ['$deadLevel', 'SERIOUS'] }, 1, 0] }
          },
          criticalCount: {
            $sum: { $cond: [{ $eq: ['$deadLevel', 'CRITICAL'] }, 1, 0] }
          }
        }
      },
      { $sort: { totalStockValue: -1 } }
    ])

    res.json({
      status: true,
      date,
      total: data.length,
      data
    })
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message
    })
  }
}


exports.getDeadStockActions = async (req, res) => {
  try {
    let date = req.query.date || await getLatestSnapshotDate()

    if (!date) {
      return res.json({
        status: true,
        date: null,
        page: 1,
        limit: 0,
        total: 0,
        totalPages: 0,
        data: []
      })
    }

    const page = Math.max(Number(req.query.page || 1), 1)
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 500)
    const skip = (page - 1) * limit

    const match = { date }

    if (req.query.action) {
      match.recommendedAction = req.query.action
    }

    if (req.query.shopId) {
      match.shopId = new mongoose.Types.ObjectId(req.query.shopId)
    }

    if (req.query.level) {
      match.deadLevel = req.query.level
    }

    if (req.query.search) {
      match.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { sku: { $regex: req.query.search, $options: 'i' } }
      ]
    }

    const [total, data] = await Promise.all([
      DeadStockDaily.countDocuments(match),
      DeadStockDaily.find(match)
        .sort({ stockValue: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ])

    res.json({
      status: true,
      date,
      action: req.query.action || null,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
      data
    })
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message
    })
  }
}



exports.getGlobalDeadStock = async (req, res) => {
  try {
    let date = req.query.date || await getLatestSnapshotDate()

    const page = Math.max(Number(req.query.page || 1), 1)
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 500)
    const skip = (page - 1) * limit

    const match = { date }
    
    if (req.query.categoryId) {
      match.categoryId = new mongoose.Types.ObjectId(req.query.categoryId)
    }

    if (req.query.level) {
      match.deadLevel = req.query.level
    }

    if (req.query.search) {
      match.$or = [
        { sku: { $regex: req.query.search, $options: 'i' } },
        { name: { $regex: req.query.search, $options: 'i' } }
      ]
    }

    const [total, data] = await Promise.all([
      DeadStockGlobalDaily.countDocuments(match),
      DeadStockGlobalDaily.find(match)
        .sort({ totalStockValue: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ])

    res.json({
      status: true,
      date,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data
    })
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message
    })
  }
}