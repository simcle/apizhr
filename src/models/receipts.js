const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReceiptsSchema = new Schema({
    receiptsNo: {type: String},
    supplierId: {type: Schema.Types.ObjectId},
    items: [
        {
            idx: {type: String},
            productId: {type: Schema.Types.ObjectId},
            sku: {type: String},
            name: {type: String},
            purchase: {type: Number},
            qty: {type: Number},
            total: {type: Number}
        }
    ],
    grandTotal: {type: Number},
    remarks: {type: String},
    userId: {type: Schema.Types.ObjectId}
}, {
    timestamps: true
})

module.exports = mongoose.model('Receipts', ReceiptsSchema);