const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const draftSalesSchema = new Schema(
    {
        no: {type: Number},
        shopId: {type: Schema.Types.ObjectId},
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
    }, {
        timestamps: true
    }
)

module.exports = mongoose.model('draftsale', draftSalesSchema)