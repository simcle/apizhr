const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PurchaseSchema = new Schema({
    purchaseNo: {type: String},
    priority: {type: Boolean, default: false},
    supplierId: {type: mongoose.Types.ObjectId},
    invoiceDate: {type: Date},
    validityDate: {type: Date, default: null},
    items: [
        {
            productId: {type: mongoose.Types.ObjectId},
            sku: {type: String},
            name: {type: String},
            price: {type: Number},
            qty: {type: Number},
            total: {type: Number}
        }
    ],
    remarks: {type: String},
    status: {type: String}
}, {
    timestamps: true
})

module.exports = mongoose.model('Purchases', PurchaseSchema);