const mongoose = require('mongoose')
const Schema = mongoose.Schema

const DailyChecklistItemSchema = new Schema({
    dailyChecklistId: {
        type: Schema.Types.ObjectId,
        ref: 'DailyChecklist',
        required: true
    },

    templateItemId: {
        type: Schema.Types.ObjectId,
        ref: 'ChecklistTemplateItem',
        required: true
    },

    category: {
        type: String,
        required: true
    },

    label: {
        type: String,
        required: true
    },

    description: {
        type: String,
        default: ''
    },

    sortOrder: {
        type: Number,
        default: 0
    },

    issueNoteRequired: {
        type: Boolean,
        default: true
    },

    result: {
        type: String,
        enum: [
            'PENDING',
            'OK',
            'ISSUE',
            'NA'
        ],
        default: 'PENDING'
    },

    notes: {
        type: String,
        default: '',
        trim: true
    },

    checkedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
})

DailyChecklistItemSchema.index({
    dailyChecklistId: 1,
    sortOrder: 1
})

DailyChecklistItemSchema.index(
    {
        dailyChecklistId: 1,
        templateItemId: 1
    },
    {
        unique: true
    }
)

module.exports = mongoose.model(
    'DailyChecklistItem',
    DailyChecklistItemSchema
)