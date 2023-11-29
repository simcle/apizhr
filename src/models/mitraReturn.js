const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MitraReturnSchema = new Schema({
    returnNo: {type: String},
    mitraId: {type: mongoose.Types.ObjectId},
    shopId: {tyep: mongoose.Types.ObjectId},
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
    note: {type: String},
    userId: {type: mongoose.Types.ObjectId}
}, {
    timestamps: true
})

module.exports = mongoose.model('MitraRetruns', MitraReturnSchema)