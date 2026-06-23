const PurchasingPlanDaily = require('../models/PurchasingPlanDaily')

exports.getSummary = async (req, res) => {
  try {

    const date = req.query.date

    const summary = await PurchasingPlanDaily.aggregate([
      {
        $match: { date }
      },
      {
        $group: {
          _id: '$planAction',

          totalSku: {
            $sum: 1
          },

          totalQty: {
            $sum: '$netToBuy'
          },

          totalValue: {
            $sum: '$estimatedValue'
          }
        }
      }
    ])

    res.json({
      status: true,
      data: summary
    })

  } catch (err) {

    res.status(500).json({
      status: false,
      message: err.message
    })
  }
}

exports.getList = async (req, res) => {

  try {

    const page =
      Number(req.query.page || 1)

    const limit =
      Number(req.query.limit || 50)

    const skip =
      (page - 1) * limit

    const match = {
      date: req.query.date
    }

    if (req.query.action) {
      match.planAction =
        req.query.action
    }

    if (req.query.flow) {
      match.flow =
        req.query.flow
    }

    if (req.query.categoryId) {
      match.categoryId =
        req.query.categoryId
    }

    if (req.query.parentId) {
      match.parentId =
        req.query.parentId
    }

    if (req.query.search) {

      match.$or = [
        {
          sku: {
            $regex:
              req.query.search,
            $options: 'i'
          }
        },
        {
          name: {
            $regex:
              req.query.search,
            $options: 'i'
          }
        }
      ]
    }

    const [total, data] =
      await Promise.all([

        PurchasingPlanDaily.countDocuments(match),

        PurchasingPlanDaily.find(match)
          .sort({
            priorityScore: -1
          })
          .skip(skip)
          .limit(limit)
          .lean()

      ])

    res.json({
      status: true,

      total,

      page,

      totalPages:
        Math.ceil(
          total / limit
        ),

      data
    })

  } catch (err) {

    res.status(500).json({
      status: false,
      message: err.message
    })
  }
}

exports.getActions = async (req, res) => {

  try {

    const date =
      req.query.date

    const actions =
      await PurchasingPlanDaily.aggregate([

        {
          $match: {
            date
          }
        },

        {
          $group: {

            _id: '$planAction',

            totalSku: {
              $sum: 1
            },

            totalQty: {
              $sum: '$netToBuy'
            },

            totalValue: {
              $sum: '$estimatedValue'
            }
          }
        },

        {
          $sort: {
            totalValue: -1
          }
        }

      ])

    res.json({
      status: true,
      data: actions
    })

  } catch (err) {

    res.status(500).json({
      status: false,
      message: err.message
    })
  }
}

exports.getTopPriority = async (req, res) => {

  try {

    const limit =
      Number(req.query.limit || 20)

    const data =
      await PurchasingPlanDaily.find({

        date:
          req.query.date,

        planAction: {
          $in: [
            'BUY',
            'BUY_WITH_REVIEW'
          ]
        }

      })
      .sort({
        priorityScore: -1
      })
      .limit(limit)
      .lean()

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