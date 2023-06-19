const mongoose = require('mongoose');
const InventoryModel = require('../models/inventory');

exports.getStock = (req, res) => {
    const productId = mongoose.Types.ObjectId(req.params.productId)
    InventoryModel.aggregate([
        {$match: {productId: productId}},
        {$lookup: {
            from: 'shops',
            localField: 'shopId',
            foreignField: '_id',
            as: 'shop'
        }},
        {$unwind: '$shop'},
        {$addFields: {
            shop: '$shop.name'
        }}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}