const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SalesDailySchema = new Schema({
  date: { type: String, required: true }, // "YYYY-MM-DD" (Asia/Jakarta)
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },

  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  sku: { type: String, required: true },

  qtySold: { type: Number, default: 0 },
  trxCount: { type: Number, default: 0 },
}, { timestamps: true });

SalesDailySchema.index({ date: 1, shopId: 1, sku: 1 }, { unique: true });
SalesDailySchema.index({ sku: 1, shopId: 1, date: -1 });
SalesDailySchema.index({ date: 1, shopId: 1 });

module.exports = mongoose.model('SalesDaily', SalesDailySchema);