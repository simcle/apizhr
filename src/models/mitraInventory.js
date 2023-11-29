const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MitraInventories = new Schema({
    mitraId: {type: mongoose.Types.ObjectId},
    productId: {type: mongoose.Types.ObjectId},
    sku: {type: String},
    name: {type: String},
    unitPrice: {type: Number},
    qty: {type: Number}
})
MitraInventories.index({name: 'text', sku: 'text'})
module.exports = mongoose.model('MitraInventories', MitraInventories)