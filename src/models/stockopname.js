const mongoose = require('mongoose')
const Schema = mongoose.Schema

const StockOpnameSchema = new Schema({
  stockOpnameNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  shopId: {
    type: Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
    index: true
  },

  opnameDate: {
    type: Date,
    default: Date.now
  },

  remarks: {
    type: String,
    default: 'Stock opname'
  },

  status: {
    type: String,
    enum: [
      'DRAFT',
      'COUNTING',
      'FINISHED',
      'CANCELLED'
    ],
    default: 'DRAFT',
    index: true
  },
  opnameType: {
    type: String,
    enum: ['FULL', 'PARENT', 'RANDOM'],
    default: 'CYCLE'
  },
  parentId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    default: null
  },

  parentName: {
    type: String,
    default: null
  },
  totalItems: {
    type: Number,
    default: 0
  },

  countedItems: {
    type: Number,
    default: 0
  },

  recheckItems: {
    type: Number,
    default: 0
  },

  differenceItems: {
    type: Number,
    default: 0
  },

  totalSystemQty: {
    type: Number,
    default: 0
  },

  totalCountedQty: {
    type: Number,
    default: 0
  },

  totalPlusQty: {
    type: Number,
    default: 0
  },

  totalMinusQty: {
    type: Number,
    default: 0
  },

  totalPlusValue: {
      type: Number,
      default: 0
  },

  totalMinusValue: {
      type: Number,
      default: 0
  },

  startedAt: {
    type: Date,
    default: null
  },

  reviewedAt: {
    type: Date,
    default: null
  },

  approvedAt: {
    type: Date,
    default: null
  },

  postedAt: {
    type: Date,
    default: null
  },

  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  postedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  snapshotAt: {
    type: Date,
    default: null
  },
  postedItems: {
      type: Number,
      default: 0
  },
  validated: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
})

StockOpnameSchema.index({ shopId: 1, status: 1 })
StockOpnameSchema.index({ createdAt: -1 })

module.exports = mongoose.model('StockOpname', StockOpnameSchema)