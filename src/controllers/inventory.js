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

exports.getStockBarang = (req, res) => {
    const search = req.query.search
    InventoryModel.aggregate([
        {$lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product'
        }},
        {$unwind: '$product'},
        {$lookup: {
            from: 'shops',
            localField: 'shopId',
            foreignField: '_id',
            as: 'shop'
        }},
        {$unwind: '$shop'},
        {$addFields: {
            name: '$product.name',
            sku: '$product.sku',
            shop: '$shop.name'
        }},
        {$match: {$or: [{sku: {$regex:'.*'+search+'.*', $options: 'i'}}, {name: {$regex: ',*'+search+'.*', $options: 'i'}}]}},
        {$limit: 10}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}