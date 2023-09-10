const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OnlineSchema = new Schema({
    onlineNo: {type: String},
    dropshipperId: {type: Schema.Types.ObjectId},
    customerId: {type: Schema.Types.ObjectId},
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
            subTotal: {type: Number}
        }
    ],
    shippingId: {type: Schema.Types.ObjectId},
    shippingName: {type: String},
    service: {type: String},
    bookingCode: {type: String},
    shipmentCost: {type: Number},
    grandTotal: {type: Number},
    bankId: {type: Schema.Types.ObjectId},
    type: {type: String, default: 'Retail'},
    isPrinted: {type: Boolean, default: false},
    status: {type: String, default: 'New'},
    resi: {type: String, default: null},
    userId: {type: Schema.Types.ObjectId}
}, {
    timestamps: true
});


module.exports = mongoose.model('Online', OnlineSchema);