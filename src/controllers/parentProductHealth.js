const mongoose = require('mongoose')

const ParentProductHealthDaily = require('../models/ParentProductHealthDaily')
const InventoryIntelDaily = require('../models/InventoryIntelDaily')

async function getLatestSnapshotDate() {

  const latest = await InventoryIntelDaily
    .findOne({})
    .sort({ date: -1 })
    .select('date')
    .lean()

  return latest?.date || null
}

exports.getParents = async (req, res) => {

  try {

    let date =
      req.query.date ||
      await getLatestSnapshotDate()

    if (!date) {

      return res.json({
        status: true,
        date: null,
        total: 0,
        data: [],
        message:
          'Belum ada snapshot parent health'
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
          Number(req.query.limit || 20),
          1
        ),
        500
      )

    const skip =
      (page - 1) * limit

    const match = {
      date
    }

    // filter status
    if (req.query.healthStatus) {

      match.healthStatus =
        req.query.healthStatus
    }

    // search
    if (req.query.search) {

      match.$or = [

        {
          parentName: {
            $regex: req.query.search,
            $options: 'i'
          }
        },

        {
          parentSku: {
            $regex: req.query.search,
            $options: 'i'
          }
        }
      ]
    }

    const [total, data] =
      await Promise.all([

        ParentProductHealthDaily.countDocuments(match),

        ParentProductHealthDaily.find(match)
          .sort({
            totalStockValue: -1
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

exports.getParentDetail = async (req, res) => {

  try {

    const {
      parentId
    } = req.params

    let date =
      req.query.date ||
      await getLatestSnapshotDate()

    if (!date) {

      return res.json({
        status: true,
        data: null
      })
    }

    const data =
      await ParentProductHealthDaily
        .findOne({

          date,

          parentId:
            new mongoose.Types.ObjectId(
              parentId
            )
        })
        .lean()

    if (!data) {

      return res.status(404).json({
        status: false,
        message:
          'Parent product health tidak ditemukan'
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