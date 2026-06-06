const mongoose = require('mongoose')

const TransferRecommendationDaily =
  require('../models/TransferRecommendationDaily')

const InventoryIntelDaily =
  require('../models/InventoryIntelDaily')

async function getLatestSnapshotDate() {

  const latest =
    await InventoryIntelDaily
      .findOne({})
      .sort({ date: -1 })
      .select('date')
      .lean()

  return latest?.date || null
}

/**
 * LIST TRANSFER RECOMMENDATION
 */
exports.getTransfers = async (req, res) => {

  try {

    let date =
      req.query.date ||
      await getLatestSnapshotDate()

    if (!date) {

      return res.json({
        status: true,
        date: null,
        total: 0,
        data: []
      })
    }

    const page =
      Math.max(
        Number(req.query.page || 1),
        1
      )

    const limit =
      Math.min(
        Math.max(
          Number(req.query.limit || 50),
          1
        ),
        500
      )

    const skip =
      (page - 1) * limit

    const match = {
      date
    }

    /**
     * filter source shop
     */
    if (req.query.sourceShopId) {

      match.sourceShopId =
        new mongoose.Types.ObjectId(
          req.query.sourceShopId
        )
    }

    /**
     * filter target shop
     */
    if (req.query.targetShopId) {

      match.targetShopId =
        new mongoose.Types.ObjectId(
          req.query.targetShopId
        )
    }

    /**
     * search
     */
    if (req.query.search) {

      match.$or = [

        {
          productName: {
            $regex: req.query.search,
            $options: 'i'
          }
        },

        {
          sku: {
            $regex: req.query.search,
            $options: 'i'
          }
        },

        {
          parentName: {
            $regex: req.query.search,
            $options: 'i'
          }
        }
      ]
    }

    const [total, data] =
      await Promise.all([

        TransferRecommendationDaily.countDocuments(match),

        TransferRecommendationDaily.find(match)
          .sort({
            priorityScore: -1
          })
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

      totalPages:
        Math.ceil(total / limit),

      hasNextPage:
        page * limit < total,

      hasPrevPage:
        page > 1,

      data
    })

  } catch (err) {

    res.status(500).json({
      status: false,
      message: err.message
    })
  }
}

/**
 * DETAIL
 */
exports.getTransferDetail = async (req, res) => {

  try {

    const {
      id
    } = req.params

    const data =
      await TransferRecommendationDaily
        .findById(id)
        .lean()

    if (!data) {

      return res.status(404).json({
        status: false,
        message:
          'Transfer recommendation tidak ditemukan'
      })
    }

    res.json({
      status: true,
      data
    })

  } catch (err) {

    res.status(500).json({
      status: false,
      message: err.message
    })
  }
}

/**
 * SUMMARY
 */
exports.getTransferSummary = async (req, res) => {

  try {

    let date =
      req.query.date ||
      await getLatestSnapshotDate()

    if (!date) {

      return res.json({
        status: true,
        date: null,
        summary: {}
      })
    }

    const summary =
      await TransferRecommendationDaily.aggregate([

        {
          $match: {
            date
          }
        },

        {
          $group: {

            _id: null,

            totalTransfers: {
              $sum: 1
            },

            totalQty: {
              $sum: '$transferQty'
            },

            totalPriority: {
              $avg: '$priorityScore'
            }
          }
        }
      ])

    res.json({

      status: true,

      date,

      summary:
        summary[0] || {
          totalTransfers: 0,
          totalQty: 0,
          totalPriority: 0
        }
    })

  } catch (err) {

    res.status(500).json({
      status: false,
      message: err.message
    })
  }
}