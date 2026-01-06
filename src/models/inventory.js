const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const InventorySchema = new Schema({
    shopId: {type: Schema.Types.ObjectId, ref: 'Shop'},
    productId: {type: Schema.Types.ObjectId, ref: 'Product'},
    qty: {type: Number}
}, {
    timestamps: true
})
InventorySchema.index({ shopId: 1, productId: 1 }, { unique: true });
module.exports = mongoose.model('Inventory', InventorySchema);