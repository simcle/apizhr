const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReturnSchema = new Schema({
    returnNo: {type: String},
    shopId: {type: Schema.Types.ObjectId},
    reason: {type: String},
    itemRetur: {
        productId: {type: Schema.Types.ObjectId},
        name: {type: String},
        sku: {type: String},
        purchase: {type: Number},
        nettPrice: {type: Number},
        price: {type: Number},
    },
    itemPengganti: {
        productId: {type: Schema.Types.ObjectId},
        name: {type: String},
        sku: {type: String},
        purchase: {type: Number},
        nettPrice: {type: Number},
        price: {type: Number},
    },
    selisih: {type: Number},
    userId: {type: Schema.Types.ObjectId}
}, {
    timestamps: true
})

module.exports = mongoose.model('Returns', ReturnSchema);