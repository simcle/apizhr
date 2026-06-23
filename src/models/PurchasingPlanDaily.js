const mongoose = require('mongoose')
const Schema = mongoose.Schema

const PurchasingPlanDailySchema = new Schema({
  date: String,

  productId: Schema.Types.ObjectId,

  sku: String,
  name: String,

  parentId: Schema.Types.ObjectId,
  parentName: String,

  categoryId: Schema.Types.ObjectId,
  categoryName: String,

  flow: String,

  purchase: Number,

  leadTime: Number,
  safetyDays: Number,

  totalDemand: Number,

  totalRecommended: Number,

  warehouseStock: Number,

  transferAvailableQty: Number,

  netToBuy: Number,

  estimatedValue: Number,

  parentHealthStatus: String,
  parentHealthScore: Number,

  isGlobalDeadStock: Boolean,
  deadLevel: String,

  priorityScore: Number,

  planAction: {
    type: String,
    enum: [
      'BUY',
      'BUY_WITH_REVIEW',
      'TRANSFER_FIRST',
      'DO_NOT_BUY',
      'NO_ACTION'
    ]
  },

  reasons: [String]

}, {
  timestamps: true
})

PurchasingPlanDailySchema.index(
  { date: 1, productId: 1 },
  { unique: true }
)

PurchasingPlanDailySchema.index({
  date: 1,
  planAction: 1
})

PurchasingPlanDailySchema.index({
  date: 1,
  categoryId: 1
})

PurchasingPlanDailySchema.index({
  date: 1,
  parentId: 1
})

PurchasingPlanDailySchema.index({
  date: 1,
  priorityScore: -1
})

PurchasingPlanDailySchema.index({
  date: 1,
  estimatedValue: -1
})

module.exports =
  mongoose.model(
    'PurchasingPlanDaily',
    PurchasingPlanDailySchema
  )