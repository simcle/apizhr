const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ResellerSchema = new Schema({
    resellerNo: {type: String},
    shopId: {type: Schema.Types.ObjectId},
    sellerId: {type: Schema.Types.ObjectId},
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
    status: {type: Boolean, default: false},
    grandTotal: {type: Number},
    payments: [
        {
            paymentDate: {type: Date},
            paymentMethod: {type: String},
            bankId: {type: Schema.Types.ObjectId},
            cash: {type: Number},
            transfer: {type: Number},
            amount: {type: Number},
            sisa: {type: Number}
        }
    ],
    bayar: {type: Number, default: 0},
    sisa: {type: Number, default: 0},
    userId: {type: Schema.Types.ObjectId}
}, {
    timestamps: true
})

module.exports = mongoose.model('Reseller', ResellerSchema);