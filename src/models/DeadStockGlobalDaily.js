const mongoose = require('mongoose')
const Schema = mongoose.Schema

const DeadStockGlobalDailySchema = new Schema({
  date: { type: String, required: true },

  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  parentId: { type: Schema.Types.ObjectId, default: null },
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },

  categoryName: {
    type: String,
    default: null
  },

  sku: String,
  name: String,

  totalStock: { type: Number, default: 0 },
  totalStockValue: { type: Number, default: 0 },

  avgAds: { type: Number, default: 0 },
  totalAds: { type: Number, default: 0 },

  lastSoldDate: { type: String, default: null },
  daysNoSale: { type: Number, default: 9999 },
  lifetimeQtySold: { type: Number, default: 0 },

  shopCount: { type: Number, default: 0 },

  deadLevel: {
    type: String,
    enum: ['WARNING', 'SERIOUS', 'CRITICAL'],
    required: true
  },

  recommendedAction: {
    type: String,
    enum: ['PROMO', 'DISCOUNT', 'CLEARANCE'],
    required: true
  },

  message: String
}, { timestamps: true })

DeadStockGlobalDailySchema.index(
  { date: 1, productId: 1 },
  { unique: true }
)

DeadStockGlobalDailySchema.index({ date: 1, deadLevel: 1 })
DeadStockGlobalDailySchema.index({ date: 1, totalStockValue: -1 })
DeadStockGlobalDailySchema.index({ date: 1, parentId: 1 })
DeadStockGlobalDailySchema.index({ date: 1, categoryId: 1 })
DeadStockGlobalDailySchema.index({ date: 1, categoryId: 1, totalStockValue: -1 })

module.exports = mongoose.model('DeadStockGlobalDaily', DeadStockGlobalDailySchema)