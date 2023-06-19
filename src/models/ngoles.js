const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NgolesSchema = new Schema({
    ngolesNo: {type: String},
    shopId: {type: mongoose.Types.ObjectId},
    pedagangId: {type: Schema.Types.ObjectId},
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
    status: {type: String, default: 'BELUM BAYAR'},
    grandTotal: {type: Number},
    penerima: {type: String},
    tanggalBayar: {type: Date},
}, {
    timestamps: true
});

module.exports = mongoose.model('Ngoles', NgolesSchema);
