const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const StockCardSchema = new Schema({
    shopId: {type: Schema.Types.ObjectId},
    productId: {type: Schema.Types.ObjectId},
    documentId: {type: Schema.Types.ObjectId},
    documentName: {type: String},
    stockIn: {type: Number, default: 0},
    stockOut: {type: Number, default: 0},
    balance: {type: Number}
}, {
    timestamps: true
})

module.exports = mongoose.model('Stockcard', StockCardSchema);

