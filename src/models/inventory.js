const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const InventorySchema = new Schema({
    shopId: {type: Schema.Types.ObjectId, ref: 'Shop'},
    productId: {type: Schema.Types.ObjectId, ref: 'Product'},
    qty: {type: Number}
}, {
    timestamps: true
})

module.exports = mongoose.model('Inventory', InventorySchema);