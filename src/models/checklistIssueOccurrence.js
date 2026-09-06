const mongoose = require('mongoose')
const Schema = mongoose.Schema

const ChecklistIssueOccurrenceSchema = new Schema({
    checklistIssueId: {
        type: Schema.Types.ObjectId,
        ref: 'ChecklistIssue',
        required: true,
        index: true
    },

    dailyChecklistId: {
        type: Schema.Types.ObjectId,
        ref: 'DailyChecklist',
        required: true,
        index: true
    },

    dailyChecklistItemId: {
        type: Schema.Types.ObjectId,
        ref: 'DailyChecklistItem',
        required: true,
        index: true
    },

    shopId: {
        type: Schema.Types.ObjectId,
        ref: 'Shop',
        required: true,
        index: true
    },

    templateItemId: {
        type: Schema.Types.ObjectId,
        ref: 'ChecklistTemplateItem',
        required: true
    },

    date: {
        type: String,
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

    issueNote: {
        type: String,
        default: ''
    },

    reportedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    reportedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
})

ChecklistIssueOccurrenceSchema.index(
    {
        checklistIssueId: 1,
        dailyChecklistItemId: 1
    },
    {
        unique: true
    }
)

ChecklistIssueOccurrenceSchema.index({
    checklistIssueId: 1,
    date: -1
})

module.exports = mongoose.model(
    'ChecklistIssueOccurrence',
    ChecklistIssueOccurrenceSchema
)