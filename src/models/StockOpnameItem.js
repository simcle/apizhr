const mongoose = require('mongoose')
const Schema = mongoose.Schema

const StockOpnameItemSchema = new Schema({
  stockOpnameId: {
    type: Schema.Types.ObjectId,
    ref: 'StockOpname',
    required: true,
    index: true
  },
  systemQtyAtCount: {
      type: Number,
      default: null
  },
  shopId: {
    type: Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
    index: true
  },

  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },

  sku: {
    type: String,
    index: true
  },

  name: {
    type: String
  },

  parentId: {
    type: Schema.Types.ObjectId,
    default: null,
    index: true
  },

  parentName: {
    type: String,
    default: null
  },

  categoryId: {
    type: Schema.Types.ObjectId,
    default: null,
    index: true
  },

  categoryName: {
    type: String,
    default: null
  },

  systemQtySnapshot: {
    type: Number,
    default: 0
  },

  countedQty: {
    type: Number,
    default: null
  },

  differenceQty: {
    type: Number,
    default: 0
  },

  unitCost: {
    type: Number,
    default: 0
  },

  differenceValue: {
    type: Number,
    default: 0
  },

  countStatus: {
    type: String,
    enum: [
      'NOT_COUNTED',
      'COUNTED',
      'POSTED'
    ],
    default: 'NOT_COUNTED',
    index: true
  },

  note: {
    type: String,
    default: ''
  },

  countedAt: {
    type: Date,
    default: null
  },

  countedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  sortKey: {
    type: String,
    index: true
  },
    lastUpdatedAt: {
    type: Date,
    default: null
  },

  lastUpdatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },

  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  approvedAt: {
    type: Date,
    default: null
  },

  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  postedAt: {
    type: Date,
    default: null
  },

  postedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
}, {
  timestamps: true
})

StockOpnameItemSchema.index(
  { stockOpnameId: 1, productId: 1 },
  { unique: true }
)

StockOpnameItemSchema.index({
  stockOpnameId: 1,
  countStatus: 1
})

StockOpnameItemSchema.index({
  stockOpnameId: 1,
  categoryId: 1
})

StockOpnameItemSchema.index({
  stockOpnameId: 1,
  parentId: 1
})

StockOpnameItemSchema.index({
  stockOpnameId: 1,
  differenceQty: 1
})

StockOpnameItemSchema.index({
  stockOpnameId: 1,
  sku: 1
})


module.exports = mongoose.model('StockOpnameItem', StockOpnameItemSchema)