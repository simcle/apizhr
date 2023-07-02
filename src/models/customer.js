const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CustomerSchema = new Schema({
    name: {type: String},
    marketplaceId: {type: Schema.Types.ObjectId},
    mobile: {type: String},
    address: {type: String},
    subdistrictId: {type: Number},
    subdistrictName: {type: String},
    cityId: {type: Number},
    cityName: {type: String},
    provinceId: {type: Number},
    provinceName: {type: String},
    zip: {type: String},
    type: {type: String, default: 'Retail'},
    userId: {type: Schema.Types.ObjectId}
}, {
    timestamps: true
})

module.exports = mongoose.model('Customer', CustomerSchema);