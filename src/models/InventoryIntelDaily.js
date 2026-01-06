const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const InventoryIntelDailySchema = new Schema({
  date: { type: String, required: true }, // "YYYY-MM-DD" (Asia/Jakarta)

  shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  sku: { type: String, required: true },

  // stock
  stockOnHand: { type: Number, default: 0 },
  warehouseStockOnHand: { type: Number, default: 0 }, // untuk keputusan TRANSFER

  // demand
  windowDays: { type: Number, default: 30 },
  sumSoldWindow: { type: Number, default: 0 },
  ads: { type: Number, default: 0 }, // average daily sales
  daysOfCover: { type: Number, default: 0 },

  // policy
  leadTimeDays: { type: Number, default: 5 },
  safetyDays: { type: Number, default: 2 },
  rop: { type: Number, default: 0 }, // reorder point

  // decision
  status: { type: String, enum: ['AMAN', 'WASPADA', 'SIAGA', 'AWAS'], default: 'AMAN' },
  action: { type: String, enum: ['NO_ACTION', 'TRANSFER', 'ORDER', 'PRODUKSI', 'DISCOUNT'], default: 'NO_ACTION' },
  recommendedQty: { type: Number, default: 0 },
  priorityScore: { type: Number, default: 0 },

  reasons: { type: [String], default: [] },
}, { timestamps: true });

InventoryIntelDailySchema.index({ date: 1, shopId: 1, productId: 1 }, { unique: true });
InventoryIntelDailySchema.index({ date: 1, status: 1, shopId: 1 });
InventoryIntelDailySchema.index({ date: 1, priorityScore: -1 });

module.exports = mongoose.model('InventoryIntelDaily', InventoryIntelDailySchema);