const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PreorderSchema = new Schema({
    customerId: {type: mongoose.Types.ObjectId},
    supplierId: {type: mongoose.Types.ObjectId},
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
            subTotal: {type: Number},
            status: {type: String, default: 'Menunggu'},
            description: {type: String, default: null}
        }
    ],
    userId: {type: mongoose.Types.ObjectId}
}, {
    timestamps: true
});

module.exports = mongoose.model('Preorders', PreorderSchema);

