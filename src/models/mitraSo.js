const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MitraSoSchema = new Schema({
    mintraId: {type: mongoose.Types.ObjectId},
    productId: {type: mongoose.Types.ObjectId},
    sku: {type: String},
    name: {type: String},
    unitPrice: {type: Number},
    qty: {type: Number},
    onHand: {type: Number}
}, {
    timestamps: true
})

module.exports = mongoose.model('MitraStockOpnames', MitraSoSchema)