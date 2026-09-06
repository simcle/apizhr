const mongoose = require('mongoose')
const Schema = mongoose.Schema

const ChecklistIssueSchema = new Schema({
    shopId: {
        type: Schema.Types.ObjectId,
        ref: 'Shop',
        required: true,
        index: true
    },

    templateItemId: {
        type: Schema.Types.ObjectId,
        ref: 'ChecklistTemplateItem',
        required: true,
        index: true
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

    status: {
        type: String,
        enum: [
            'OPEN',
            'RESOLVED'
        ],
        default: 'OPEN',
        index: true
    },

    firstReportedAt: {
        type: Date,
        required: true
    },

    lastReportedAt: {
        type: Date,
        required: true
    },

    occurrenceCount: {
        type: Number,
        default: 1
    },

    latestIssueNote: {
        type: String,
        default: ''
    },

    reportedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    resolvedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    resolvedAt: {
        type: Date,
        default: null
    },

    resolutionNote: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
})

ChecklistIssueSchema.index({
    shopId: 1,
    templateItemId: 1,
    status: 1
})

ChecklistIssueSchema.index({
    status: 1,
    lastReportedAt: -1
})

ChecklistIssueSchema.index({
    shopId: 1,
    status: 1,
    lastReportedAt: -1
})

module.exports = mongoose.model(
    'ChecklistIssue',
    ChecklistIssueSchema
)