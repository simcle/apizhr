const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ShopSchema = new Schema({
    name: {type: String},
    address: {type: String},
    mobile: {type: String},
    type: {
        type: String,
        enum: [
            'STORE',
            'WAREHOUSE',
            'ONLINE',
            'WORKSHOP'
        ],
        default: 'STORE'
    }
}, {
    timestamps: true
})
ShopSchema.index({type: 1})

module.exports = mongoose.model('Shop', ShopSchema);