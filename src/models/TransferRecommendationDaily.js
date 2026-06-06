const mongoose = require('mongoose')

const Schema = mongoose.Schema

const TransferRecommendationDailySchema = new Schema({

  date: {
    type: String,
    index: true
  },

  productId: {
    type: Schema.Types.ObjectId,
    index: true
  },

  sku: String,

  productName: String,

  parentId: {
    type: Schema.Types.ObjectId,
    index: true
  },

  parentName: String,

  sourceShopId: {
    type: Schema.Types.ObjectId,
    index: true
  },

  sourceShopName: String,

  targetShopId: {
    type: Schema.Types.ObjectId,
    index: true
  },

  targetShopName: String,

  sourceStock: Number,

  targetStock: Number,

  sourceAds: Number,

  targetAds: Number,

  sourceDaysOfCover: Number,

  targetDaysOfCover: Number,

  transferQty: Number,

  priorityScore: Number,

  reason: [String]

}, {
  timestamps: true
})

TransferRecommendationDailySchema.index({
  date: 1,
  sourceShopId: 1,
  targetShopId: 1
})

module.exports = mongoose.model(
  'TransferRecommendationDaily',
  TransferRecommendationDailySchema
)