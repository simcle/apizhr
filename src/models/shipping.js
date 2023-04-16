const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ShippingSchema = new Schema({
    name: {type: String, unique: true, required: true},
    services: {type: Array, required: true},
    logo: {type: String, required: true},
    status: {type: Boolean}
}, {
    timestamps: true
});

module.exports = mongoose.model('Shipping', ShippingSchema);

