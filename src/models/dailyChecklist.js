const mongoose = require('mongoose')
const Schema = mongoose.Schema

const DailyChecklistSchema = new Schema({
    date: {
        type: String,
        required: true
    },

    shopId: {
        type: Schema.Types.ObjectId,
        ref: 'Shop',
        required: true
    },

    shopName: {
        type: String,
        required: true
    },

    status: {
        type: String,
        enum: [
            'PENDING',
            'IN_PROGRESS',
            'COMPLETED'
        ],
        default: 'PENDING'
    },

    supervisorId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    startedAt: {
        type: Date,
        default: null
    },

    completedAt: {
        type: Date,
        default: null
    },

    totalItems: {
        type: Number,
        default: 0
    },

    totalOk: {
        type: Number,
        default: 0
    },

    totalIssue: {
        type: Number,
        default: 0
    },

    totalNA: {
        type: Number,
        default: 0
    },

    notes: {
        type: String,
        default: '',
        trim: true
    }
}, {
    timestamps: true
})

DailyChecklistSchema.index(
    {
        date: 1,
        shopId: 1
    },
    {
        unique: true
    }
)

DailyChecklistSchema.index({
    date: 1,
    status: 1
})

DailyChecklistSchema.index({
    shopId: 1,
    date: -1
})

module.exports = mongoose.model(
    'DailyChecklist',
    DailyChecklistSchema
)