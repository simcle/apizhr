const mongoose = require('mongoose')
const Schema = mongoose.Schema

const DeadStockActionSchema = new Schema({
    deadStockDate: {
        type: String,
        required: true,
        index: true
    },

    deadStockId: {
        type: Schema.Types.ObjectId,
        ref: 'DeadStockDaily',
        required: true,
        index: true
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

    deadLevel: {
        type: String,
        enum: [
            'WARNING',
            'SERIOUS',
            'CRITICAL'
        ],
        required: true
    },

    actionType: {
        type: String,
        enum: [
            'PROMO',
            'DISCOUNT',
            'CLEARANCE'
        ],
        required: true,
        index: true
    },

    status: {
        type: String,
        enum: [
            'DONE',
            'CANCELLED'
        ],
        default: 'DONE',
        index: true
    },

    notes: {
        type: String,
        default: ''
    },

    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    completedAt: {
        type: Date,
        default: null
    },

    cancelledAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
})

DeadStockActionSchema.index({
    deadStockDate: 1,
    shopId: 1,
    productId: 1,
    createdAt: -1
})

DeadStockActionSchema.index({
    deadStockId: 1,
    status: 1,
    createdAt: -1
})

DeadStockActionSchema.index({
    actionType: 1,
    status: 1,
    createdAt: -1
})

module.exports = mongoose.model(
    'DeadStockAction',
    DeadStockActionSchema
)