const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TransferSchema = new Schema({
    transferNo: {type: String},
    fromId: {type: Schema.Types.ObjectId},
    toId: {type: Schema.Types.ObjectId},
    remarks: {type: String},
    items: [
        {
            idx: {type: String},
            productId: {type: Schema.Types.ObjectId},
            name: {type: String},
            sku: {type: String},
            onHand: {type: Number},
            qty: {type: Number}
        }
    ],
    status: {type: String, default: 'Draft'},
    userId: {type: Schema.Types.ObjectId}
}, {
    timestamps: true
});

module.exports = mongoose.model('Transfer', TransferSchema);