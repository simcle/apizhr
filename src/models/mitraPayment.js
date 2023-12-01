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
    userId: {type: mongoose.Types.ObjectId}
}, {
    timestamps: true
})

module.exports = mongoose.model('MitraPayments', MitraPaymentSchema);