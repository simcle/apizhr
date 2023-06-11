const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const StockOpnameSchmea = new Schema({
    stockOpnameNumber: {type: String},
    shopId: {type: Schema.Types.ObjectId},
    remarks: {type: String, default: 'Stock opname'},
    items: [
        {
            productId: {type: Schema.Types.ObjectId},
            stock: {type: Number},
            counted: {type: Number},
            difference: {type: Number}
        }
    ],
    status: {type: String, default: 'Draft'},
    validated: {type: Date},
    userId: {type: Schema.Types.ObjectId}  
}, {
    timestamps: true
})

module.exports = mongoose.model('StockOpname', StockOpnameSchmea)