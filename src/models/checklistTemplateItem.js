const mongoose = require('mongoose')
const Schema = mongoose.Schema

const ChecklistTemplateItemSchema = new Schema({
    category: {
        type: String,
        required: true,
        trim: true
    },

    label: {
        type: String,
        required: true,
        trim: true
    },

    description: {
        type: String,
        default: '',
        trim: true
    },

    sortOrder: {
        type: Number,
        default: 0
    },

    isActive: {
        type: Boolean,
        default: true
    },

    issueNoteRequired: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
})

ChecklistTemplateItemSchema.index({
    isActive: 1,
    category: 1,
    sortOrder: 1
})

module.exports = mongoose.model(
    'ChecklistTemplateItem',
    ChecklistTemplateItemSchema
)