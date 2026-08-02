const mongoose = require('mongoose')

const storeOperationalCashSchema = new mongoose.Schema(
    {
        shopId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shop',
            required: true,
            unique: true,
            index: true
        },

        balance: {
            type: Number,
            default: 0,
            min: 0
        },

        status: {
            type: String,
            enum: [
                'ACTIVE',
                'INACTIVE',
                'LOCKED'
            ],
            default: 'ACTIVE',
            index: true
        },

        lastTransactionAt: {
            type: Date,
            default: null
        },

        notes: {
            type: String,
            default: '',
            trim: true
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        }
    },
    {
        timestamps: true
    }
)

storeOperationalCashSchema.index({
    status: 1,
    updatedAt: -1
})

module.exports = mongoose.model(
    'StoreOperationalCash',
    storeOperationalCashSchema
)