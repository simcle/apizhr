const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ShopSchema = new Schema({
    name: {type: String},
    address: {type: String},
    mobile: {type: String}
}, {
    timestamps: true
})

module.exports = mongoose.model('Shop', ShopSchema);