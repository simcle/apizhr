const mongoose = require('mongoose')
const Schema = mongoose.Schema

const ProductionOrderSchema = new Schema({
  productionNo: {
    type: String,
    required: true,
    unique: true
  },

  supplierId: {
    type: Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },

  productionType: {
    type: String,
    enum: ['ASONGAN', 'SUPPLIER', 'WORKSHOP_INTERNAL'],
    default: 'SUPPLIER'
  },

  orderDate: {
    type: Date,
    default: Date.now
  },

  sentAt: {
    type: Date,
    default: null
  },

  targetDate: {
    type: Date,
    default: null
  },

  priority: {
    type: Boolean,
    default: false
  },

  items: [
    {
      productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product'
      },

      sku: String,
      name: String,

      parentId: Schema.Types.ObjectId,
      parentName: String,

      categoryId: Schema.Types.ObjectId,
      categoryName: String,

      flow: String,

      price: Number,
      qty: Number,

      receivedQty: {
        type: Number,
        default: 0
      },

      remainingQty: {
        type: Number,
        default: 0
      },

      total: Number
    }
  ],

  grandTotal: {
    type: Number,
    default: 0
  },

  status: {
    type: String,
    enum: ['DRAFT', 'SENT', 'PARTIAL_RECEIVED', 'DONE', 'CANCELLED'],
    default: 'DRAFT'
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

ProductionOrderSchema.index({ productionNo: 1 })
ProductionOrderSchema.index({ status: 1, createdAt: -1 })
ProductionOrderSchema.index({ supplierId: 1, status: 1 })
ProductionOrderSchema.index({ productionType: 1, status: 1 })
ProductionOrderSchema.index({ 'items.productId': 1, status: 1 })

module.exports = mongoose.model('ProductionOrder', ProductionOrderSchema)