const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SalesSchema = new Schema({
    salesNo: {type: String},
    shopId: {type: Schema.Types.ObjectId},
    items: [
        {
            idx: {type: String},
            productId: {type: Schema.Types.ObjectId},
            name: {type: String},
            sku: {type: String},
            purchase: {type: Number},
            nettPrice: {type: Number},
            price: {type: Number},
            qty: {type: Number},
            total: {type: Number},
            discount: {type: Number},
            subTotal: {type: Number}
        }
    ],
    grandTotal: {type: Number},
    paymentMethod: {type: String},
    bankId: {type: Schema.Types.ObjectId},
    cash: {type: Number, default: 0},
    transfer: {type: Number, default: 0},
    debit: {type: Number, default: 0},
    bayar: {type: Number},
    kembali: {type: Number},
    userId: {type: Schema.Types.ObjectId}
}, {
    timestamps: true
})

module.exports = mongoose.model('Sales', SalesSchema);