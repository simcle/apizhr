const mongoose = require('mongoose')
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