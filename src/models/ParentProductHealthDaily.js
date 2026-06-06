const mongoose = require('mongoose')
const Schema = mongoose.Schema

const ParentProductHealthDailySchema = new Schema({
  date: { type: String, required: true },

  parentId: {
    type: Schema.Types.ObjectId,
    ref: 'Products',
    required: true
  },

  parentSku: { type: String },
  parentName: { type: String },

  totalVariants: { type: Number, default: 0 },

  healthyVariants: { type: Number, default: 0 },
  warningVariants: { type: Number, default: 0 },
  seriousVariants: { type: Number, default: 0 },
  criticalVariants: { type: Number, default: 0 },

  totalStock: { type: Number, default: 0 },
  totalStockValue: { type: Number, default: 0 },

  avgAds: { type: Number, default: 0 },

  healthScore: { type: Number, default: 0 },

  healthStatus: {
    type: String,
    enum: ['HEALTHY', 'WARNING', 'SERIOUS', 'CRITICAL']
  },

  recommendation: { type: String },

  topDeadVariants: [
    {
      productId: Schema.Types.ObjectId,
      sku: String,
      name: String,
      deadLevel: String,
      stockValue: Number
    }
  ]

}, { timestamps: true })

ParentProductHealthDailySchema.index(
  { date: 1, parentId: 1 },
  { unique: true }
)

ParentProductHealthDailySchema.index({
  date: 1,
  healthStatus: 1
})

module.exports = mongoose.model(
  'ParentProductHealthDaily',
  ParentProductHealthDailySchema
)