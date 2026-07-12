const mongoose = require('mongoose')
const Schema = mongoose.Schema

const StockCardSchema = new Schema({
  shopId: {
    type: Schema.Types.ObjectId,
    ref: 'Shop',
    index: true
  },

  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    index: true
  },

  documentId: {
    type: Schema.Types.ObjectId,
    index: true
  },

  documentName: {
    type: String
  },
  document: {
    tyep: String
  },
  type: {
    type: String,
    enum: [
      'SALE',
      'ONLINE_SALE',
      'RECEIPT',
      'TRANSFER_IN',
      'TRANSFER_OUT',
      'STOCK_OPNAME',
      'ADJUSTMENT'
    ],
    default: 'ADJUSTMENT'
  },

  stockIn: {
    type: Number,
    default: 0
  },

  stockOut: {
    type: Number,
    default: 0
  },

  qtyBefore: {
    type: Number,
    default: 0
  },

  qtyAfter: {
    type: Number,
    default: 0
  },

  balance: {
    type: Number,
    default: 0
  },

  remarks: {
    type: String,
    default: ''
  },

  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
})

StockCardSchema.index({ shopId: 1, productId: 1, createdAt: -1 })
StockCardSchema.index({ documentId: 1, type: 1 })
StockCardSchema.index({ type: 1, createdAt: -1 })

module.exports = mongoose.model('Stockcard', StockCardSchema)