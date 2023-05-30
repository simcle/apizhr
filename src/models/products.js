const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProductSchema = new Schema({
    name: {type: String},
    sku: {type: String},
    parentId: {type: Schema.Types.ObjectId},
    categoryId: {type: Schema.Types.ObjectId},
    brandId: {type: Schema.Types.ObjectId},
    isVarian: {type: Boolean},
    isActive: {type: Boolean, default: true},
    images: {type: Array},
    imageVarian: {type: String},
    idx: {type: Number},
    purchase: {type: Number},
    nettPrice: {type: Number},
    price: {type: Number},
    attributes: {type: Array},
    description: {type: String},
    stock: {type: Number, default: 0},
    weight: {type: Object},
    userCreated: {type: Schema.Types.ObjectId},
    userUpdated: {type: Schema.Types.ObjectId}
}, {
    timestamps: true
})

module.exports = mongoose.model('Product', ProductSchema);