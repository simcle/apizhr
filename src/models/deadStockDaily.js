const mongoose = require('mongoose')
const Schema = mongoose.Schema

const DeadStockDailySchema = new Schema({
  date: { type: String, required: true },

  shopId: { type: Schema.Types.ObjectId, ref: 'Shops', required: true },
  shopName: { type: String },
  shopType: { type: String },

  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  parentId: { type: Schema.Types.ObjectId, default: null },

  sku: { type: String },
  name: { type: String },

  stockOnHand: { type: Number, default: 0 },
  ads: { type: Number, default: 0 },

  lastSoldDate: { type: String, default: null },
  daysNoSale: { type: Number, default: 9999 },
  lifetimeQtySold: { type: Number, default: 0 },

  unitCost: { type: Number, default: 0 },
  stockValue: { type: Number, default: 0 },

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

  message: { type: String }
}, { timestamps: true })

DeadStockDailySchema.index(
  { date: 1, shopId: 1, productId: 1 },
  { unique: true }
)

DeadStockDailySchema.index({ date: 1, stockValue: -1 })
DeadStockDailySchema.index({ date: 1, shopId: 1, stockValue: -1 })
DeadStockDailySchema.index({ date: 1, deadLevel: 1, stockValue: -1 })
DeadStockDailySchema.index({ date: 1, recommendedAction: 1, stockValue: -1 })

module.exports = mongoose.model('DeadStockDaily', DeadStockDailySchema)