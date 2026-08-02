const mongoose = require('mongoose')

const storeOperationalCashTransactionSchema = new mongoose.Schema(
    {
        transactionNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true,
            index: true
        },

        cashId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'StoreOperationalCash',
            required: true,
            index: true
        },

        shopId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shop',
            required: true,
            index: true
        },

        transactionDate: {
            type: Date,
            required: true,
            default: Date.now,
            index: true
        },

        transactionType: {
            type: String,
            enum: [
                'IN',
                'OUT'
            ],
            required: true,
            index: true
        },

        transactionCategory: {
            type: String,
            enum: [
                'INITIAL_BALANCE',
                'FUND_ADDITION',
                'STORE_EXPENSE',
                'OWNER_PERSONAL',
                'ASONGAN_PURCHASE',
                'REFUND',
                'CASH_RETURN',
                'ADJUSTMENT_IN',
                'ADJUSTMENT_OUT'
            ],
            required: true,
            index: true
        },

        amount: {
            type: Number,
            required: true,
            min: 1
        },

        balanceBefore: {
            type: Number,
            required: true,
            min: 0
        },

        balanceAfter: {
            type: Number,
            required: true,
            min: 0
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        referenceType: {
            type: String,
            enum: [
                'STORE_EXPENSE',
                'FINANCE_TRANSFER',
                'MANUAL',
                'OTHER'
            ],
            default: 'MANUAL'
        },

        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },

        receipt: {
            url: {
                type: String,
                default: ''
            },

            fileName: {
                type: String,
                default: ''
            }
        },

        status: {
            type: String,
            enum: [
                'POSTED',
                'CANCELLED'
            ],
            default: 'POSTED',
            index: true
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        cancelledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        cancelledAt: {
            type: Date,
            default: null
        },

        cancellationReason: {
            type: String,
            default: '',
            trim: true
        }
    },
    {
        timestamps: true
    }
)

storeOperationalCashTransactionSchema.index({
    shopId: 1,
    transactionDate: -1
})

storeOperationalCashTransactionSchema.index({
    cashId: 1,
    transactionDate: -1
})

storeOperationalCashTransactionSchema.index({
    shopId: 1,
    transactionType: 1,
    transactionDate: -1
})

storeOperationalCashTransactionSchema.index({
    referenceType: 1,
    referenceId: 1
})

module.exports = mongoose.model(
    'StoreOperationalCashTransaction',
    storeOperationalCashTransactionSchema
)