const mongoose = require('mongoose')

const storeExpenseCategorySchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            default: '',
            trim: true
        },

        examples: {
            type: [String],
            default: []
        },

        sortOrder: {
            type: Number,
            default: 0
        },

        isActive: {
            type: Boolean,
            default: true,
            index: true
        }
    },
    {
        timestamps: true
    }
)

storeExpenseCategorySchema.index({
    isActive: 1,
    sortOrder: 1
})

module.exports = mongoose.model(
    'StoreExpenseCategory',
    storeExpenseCategorySchema
)