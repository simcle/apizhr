const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MitraSaleSchema = new Schema({
    mitraId: {type: mongoose.Types.ObjectId},
    productId: {type: mongoose.Types.ObjectId},
    sku: {type: String},
    name: {type: String},
    unitPrice: {type: Number},
    price: {type: Number},
    qty: {type: Number},
    total: {type: Number},
    status: {type: String, default: 'BELUM BAYAR'}
}, {
    timestamps: true
})

module.exports = mongoose.model('MitraSales', MitraSaleSchema);