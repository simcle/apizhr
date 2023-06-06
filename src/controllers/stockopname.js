const mongoose = require('mongoose');
const StockOpnames = require('../models/stockopname');
const Shops = require('../models/shops');


exports.getShop = (req, res) => {
    const shopId = req.user.shopId
    Shops.findById(shopId)
    .then(shops => {
        res.status(200).json(shops)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}


exports.getDraft = (req,res) => {
    const userId = mongoose.Types.ObjectId(req.user._id)
    const shopId = mongoose.Types.ObjectId(req.user.shopId)
    const sku = req.query.sku
    let query;
    if(sku) {
        query = {sku: sku}
    } else {
        query = {}
    }
    StockOpnames.aggregate([
        {$match: {$and: [{shopId: shopId}, {userId: userId}, {status: 'Draft'}]}},
        {$unwind: '$items'},
        {$lookup: {
            from: 'products',
            localField: 'items.productId',
            foreignField: '_id',
            pipeline: [
                {$project: {
                    _id: 0,
                    name: 1,
                    sku: 1
                }}
            ],
            as: 'items.product'
        }},
        {$unwind: '$items.product'},
        {$addFields: {
            'items.name': '$items.product.name',
            'items.sku': '$items.product.sku',
        }},
        {$unset: 'items.product'},
        {$addFields: {
            productId: '$items.productId',
            sku: '$items.sku',
            name: '$items.name',
            stock: '$items.stock',
            counted: '$items.counted',
            difference: '$items.difference'
        }},
        {$unset: 'items'},
        {$match: query}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}
exports.updateDraft = (req, res) => {
    const id = req.body._id
    const productId = req.body.productId
    const items = {
        productId: req.body.productId,
        stock: req.body.stock,
        counted: req.body.counted,
        difference: req.body.difference
    }
    StockOpnames.updateOne({_id: id, 'items.productId': productId}, {
        $set: {'items.$': items}
    })
    .then(() => {
        res.status(200).json('OK')
    })
}
exports.insertDraf = (req, res) => {
    const userId = req.user._id
    const shopId = req.user.shopId
    const items = {
        productId: req.body._id,
        stock: req.body.stock,
        counted: req.body.counted,
        difference: req.body.difference
    }
    StockOpnames.findOne({shopId: shopId, userId: userId, status: 'Draft'})
    .then(result => {
        if(result) {
            const duplicate = result.items.find((obj) => obj.productId == items.productId)
            if(!duplicate) {
                result.items.push(items)
                return result.save()
            } else {
                res.status(400).send('Duplicate')
            }
        } else {
            const stockopname = new StockOpnames({
                stockOpnameNumber: 'Draft',
                shopId: shopId,
                userId: userId,
                items: items,
            })
            return stockopname.save()
        }
    })
    .then(result => {
        res.status(200).json(result)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

exports.confirmDraft = (req, res) => {
    const userId = req.user._id
    const shopId = req.user.shopId

    StockOpnames.updateOne({shopId: shopId, userId: userId, status: 'Draft'}, {status: 'Confirm'})
    .then(() => {
        res.status(200).json('OK')
    })
}