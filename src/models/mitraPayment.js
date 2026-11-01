const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MitraPaymentSchema = new Schema({
    paymentNo: {type: String},
    mitraId: {type: mongoose.Types.ObjectId},
    items: [
        {
            productId: {type: mongoose.Types.ObjectId},
            sku: {type: String},
            name: {type: String},
            unitPrice: {type: Number},
            qty: {type: Number},
            total: {type: Number}
        }
    ],
    grandTotal: {type: Number},
    paymentMethod: {type: String},
    bankId: {type: Schema.Types.ObjectId},
    cash: {type: Number, default: 0},
    debit: {type: Number, default: 0},
    transfer: {type: Number, default: 0},
    userId: {type: mongoose.Types.ObjectId}
}, {
    timestamps: true
})

module.exports = mongoose.model('MitraPayments', MitraPaymentSchema);