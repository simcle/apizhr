const mongoose = require('mongoose');
const StockOpnames = require('../models/stockopname');
const InventoryModel = require('../models/inventory');
const updateStock =require('../modules/updateStock');
const stockCard = require('../modules/stockCard')
const Shops = require('../models/shops');

// DEKSTOP
exports.getStockOpname = (req, res) => {
    const search = req.query.search
    const filters = req.query.filters
    const currentPage = req.query.page || 1
    const perPage = req.query.perPage || 20
    let totalItems;
    let query;
    if(filters) {
        query = {status: {$in: filters}}
    } else {
        query = {}
    }
    StockOpnames.aggregate([
        {$lookup: {
            from: 'shops',
            foreignField:'_id',
            localField: 'shopId',
            pipeline: [
                {$project: {
                    _id: 0,
                    name: 1
                }}
            ],
            as: 'shop',
        }},
        {$unwind: {
            path: '$shop',
            preserveNullAndEmptyArrays: true
        }},
        {$lookup: {
            from: 'users',
            foreignField: '_id',
            localField: 'userId',
            pipeline:[
                {$project: {
                    _id: 0,
                    name: 1
                }}
            ],
            as: 'user'
        }},
        {$unwind: '$user'},
        {$addFields: {
            shop: '$shop.name',
            user: '$user.name'
        }},
        {$match: {$and: [{stockOpnameNumber: {$regex: '.*'+search+'.*', $options: 'i'}}, query]}},
        {$count: 'count'}
    ])
    .then(count => {
        if(count.length > 0) {
            totalItems = count[0].count
        } else {
            totalItems = 0
        }
        return StockOpnames.aggregate([
            {$lookup: {
                from: 'shops',
                foreignField:'_id',
                localField: 'shopId',
                pipeline: [
                    {$project: {
                        _id: 0,
                        name: 1
                    }}
                ],
                as: 'shop',
            }},
            {$unwind: {
                path: '$shop',
                preserveNullAndEmptyArrays: true
            }},
            {$lookup: {
                from: 'users',
                foreignField: '_id',
                localField: 'userId',
                pipeline:[
                    {$project: {
                        _id: 0,
                        name: 1
                    }}
                ],
                as: 'user'
            }},
            {$unwind: '$user'},
            {$addFields: {
                shop: '$shop.name',
                user: '$user.name'
            }},
            {$match: {$and: [{stockOpnameNumber: {$regex: '.*'+search+'.*', $options: 'i'}}, query]}},
            {$sort: {createdAt: -1}},
            {$skip: (currentPage -1) * perPage},
            {$limit: perPage}
        ])
    })
    .then (result => {
        const last_page = Math.ceil(totalItems / perPage)
        const pageValue = currentPage * perPage - perPage + 1
        const pageLimit = pageValue + result.length -1
        res.status(200).json({
            data: result,
            pages: {
                current_page: currentPage,
                last_page: last_page,
                pageValue: pageValue+'-'+pageLimit,
                totalItems: totalItems 
            },
        })
    })
}

exports.getDetail = (req, res) => {
    const id = mongoose.Types.ObjectId(req.params.id)
    StockOpnames.aggregate([
        {$match: {_id: id}},
        {$lookup: {
            from: 'shops',
            foreignField: '_id',
            localField: 'shopId',
            as: 'shop'
        }},
        {$unwind: '$shop'},
        {$lookup: {
            from: 'users',
            foreignField: '_id',
            localField: 'userId',
            as: 'user'
        }},
        {$unwind: '$user'},
        {$addFields: {
            user: '$user.name',
            shop: '$shop.name'
        }},
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
                }},
            ],
            as: 'items.product'
        }},
        {$unwind: '$items.product'},
        {$addFields: {
            'items.name': '$items.product.name',
            'items.sku': '$items.product.sku'
        }},
        {$unset: 'items.product'},
        {$group: {
            _id: '$_id',
            items: {$push: '$items'},
            root: {$first: '$$ROOT'}
        }},
        {$project: {
            'root.items' : 0,
            'root.users': 0
        }},
        {$replaceRoot: {
            newRoot: {
                $mergeObjects: [
                    { items: "$items" },
                    "$root"
                ]
            }
        }}
    ])
    .then(result => {
        res.status(200).json(result[0])
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

exports.validateStockOpname = (req, res) => {
    const id = req.params.id;
    let newID;
    const date = new Date();
    let dd = date.getDate();
    let mm = date.getMonth() +1;
    let yy = date.getFullYear().toString().substring(2);
    let YY = date.getFullYear()
    dd = checkTime(dd);
    mm = checkTime(mm)

    function checkTime (i) {
        if(i < 10) {
            i = `0${i}`
        }
        return i
    }
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    StockOpnames.findOne({validated: {$gte: today}}).sort({validated: -1})
    .then(result => {
        if(result) {
            const no = result.stockOpnameNumber.substring(18)
            const newNo = parseInt(no) + 1
            newID = `${dd}${mm}/ZHR/STOCK/${yy}/${newNo}`
        } else {
            newID = `${dd}${mm}/ZHR/STOCK/${yy}/1`
        }
        return StockOpnames.findById(id)
    })
    .then(stockOpname => {
        stockOpname.stockOpnameNumber = newID
        stockOpname.validated = new Date()
        stockOpname.status = 'Validated'
        return stockOpname.save()
    })
    .then(async (result) => {
        const shopId = result.shopId
        const items = result.items
        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            let inventory = await InventoryModel.findOne({$and: [{shopId: shopId}, {productId: item.productId}]})
            if(inventory) {
                inventory.qty += item.difference
                await inventory.save()
            } else {
                await InventoryModel.create({shopId: shopId, productId: item.productId, qty: item.counted})
            }
            const balance = await updateStock(item.productId)
            if(item.difference < 0) {
                await stockCard('out', shopId, item.productId, result._id, 'Stock Opname', item.difference, balance.stock)
            } else {
                await stockCard('in', shopId, item.productId, result._id, 'Stock Opname', item.difference, balance.stock)
            }
        }
        res.status(200).json(result)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

// MOBILE
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

    StockOpnames.updateOne({shopId: shopId, userId: userId, status: 'Draft'}, {status: 'Confirm', stockOpnameNumber: 'Confirm'})
    .then(() => {
        res.status(200).json('OK')
    })
}