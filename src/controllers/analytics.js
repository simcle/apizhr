const mongoose = require('mongoose')
const SalesModel = require('../models/sales');
const ReceiptsModel = require('../models/receipts');
const CategoryModel = require('../models/categories');
const ShopModel = require('../models/shops');
const ProductModel = require('../models/products');

exports.getShop = (req, res) => {
    ShopModel.find().sort({name: 1}).lean()
    .then(result => {
        const data = result.map(obj => {
            obj.id = obj._id,
            obj.text = obj.name
            return obj
        })
        res.status(200).json(data)
    })
}

exports.getCategories = (req, res) => {
    CategoryModel.find().sort({name: 1}).lean()
    .then(result => {
        const data = result.map(obj => {
            obj.id = obj._id,
            obj.text = obj.name
            return obj
        })
        res.status(200).json(data)
    })
}

exports.getProducts = (req, res) => {
    const sortKey = req.query.sortKey
    const sortOrder = parseInt(req.query.sortOrder)
    const search = req.query.search
    const categoryId = req.query.filterCategories
    const filter = req.query.time
    let byDate, query, day;
    if(categoryId) {
        query = {categoryId: mongoose.Types.ObjectId(categoryId)}
    } else {
        query = {}
    }
    const date = new Date();
    if(filter == '1D') {
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '7D') {
        day = date.getDate() - 6
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '30D') {
        day = date.getDate() - 29
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '90D') {
        day = date.getDate() - 89
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '1Y') {
        day = date.getDate() - 359
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    if(filter) {
        byDate = {createdAt: {$gte: date}}
    }
    switch (sortKey) {
        case 'sold':
            SalesModel.aggregate([
                {$match: byDate},
                {$unwind: '$items'},
                {$group: {
                    _id: '$items.productId',
                    sold: {$sum: '$items.qty'}
                }},
                {$sort: {sold: sortOrder}}, 
                {$lookup: {
                    from: 'products',
                    let: {'itemId': '$_id'},
                    pipeline: [
                        {$match: {
                            $expr: {
                                $eq: ['$_id', '$$itemId']
                            }
                        }},
                        {$project: {
                            _id: 0,
                            name: 1,
                            sku: 1,
                            categoryId: 1
                        }}
                    ],
                    as: 'product'
                }},
                {$unwind: '$product'},
                {$addFields: {
                    name: '$product.name',
                    sku: '$product.sku',
                    categoryId: '$product.categoryId'
                }},
                {$unset: 'product'},
                {$match: query},
                {$limit: 50},
                {$lookup: {
                    from: 'inventories',
                    let: {'itemId': '$_id'},
                    pipeline: [
                        {$match: {
                            $expr: {
                                $eq: ['$productId', '$$itemId']
                            }
                        }},
                        {$group: {
                            _id: '$productId',
                            stock: {$sum: '$qty'}
                        }}
                    ],
                    as: 'stock'
                }},
                {$unwind: '$stock'},
                {$addFields: {
                    stock: '$stock.stock'
                }},
            ]) 
            .then(async (result) => {
                res.status(200).json(result)
            })
            break;
        case 'stock':    
            console.log(sortKey)
        break;
    }
}

exports.detailProducts = (req, res) => {
    const productId = mongoose.Types.ObjectId(req.query.productId)
    const filter = req.query.time
    const date = new Date();
    if(filter == '1D') {
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '7D') {
        day = date.getDate() - 6
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '30D') {
        day = date.getDate() - 29
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '90D') {
        day = date.getDate() - 89
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '1Y') {
        day = date.getDate() - 359
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    const shops = ShopModel.aggregate([
        {$lookup: {
            from: 'sales',
            let: {'shopid': '$_id'},
            pipeline: [
                {$match: {
                    $expr: {
                        $and: [
                            {$eq: ['$shopId', '$$shopid']},
                            {$gte: ['$createdAt', date]}
                        ]
                    }
                }},
                {$unwind: '$items'},
                {$project: {
                    items: 1
                }},
                {$match: {
                    $expr: {
                        $eq: ['$items.productId', productId]
                    }
                }},
                {$group: {
                    _id: '$shopId',
                    qty: {$sum: '$items.qty'}
                }}
            ],
            as: 'sold'
        }},
        {$unwind: {
            path: '$sold',
            preserveNullAndEmptyArrays: true
        }},
        {$addFields: {
            sold: {
                $cond: [
                    {$ifNull: ['$sold', false]},'$sold.qty', 0
                ]
            }
        }},
        {$sort: {sold: -1}},
        {$lookup: {
            from: 'inventories',
            let: {'shopId': '$_id'},
            pipeline: [
                {$match: {
                    $expr: {
                        $and: [
                            {$eq: ['$productId', productId]},
                            {$eq: ['$shopId', '$$shopId']}
                        ]
                    }
                }}
            ],
            as: 'stock'
        }},
        {$unwind: {
            path: '$stock',
            preserveNullAndEmptyArrays: true
        }},
        {$addFields: {
            stock: '$stock.qty'
        }}
    ])

    const stats = SalesModel.aggregate([
        {$unwind: '$items'},
        {$match: {'items.productId': productId}},
        {$group: {
            _id: {$dateToString: {format: "%Y-%m-%d", date: '$createdAt'}},
            qty: {$sum: '$items.qty'}
        }},
        {$sort: {_id: 1}}
    ])

    Promise.all([
        shops,
        stats
    ])
    .then(result => {
        res.status(200).json({
            shops: result[0],
            stats: result[1]
        })
    })
}

exports.getAnalyticSKU = (req, res) => {
    const sku = req.query.search
    const filter = req.query.time
    const date = new Date();
    if(filter == '1D') {
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '7D') {
        day = date.getDate() - 6
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '30D') {
        day = date.getDate() - 29
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '90D') {
        day = date.getDate() - 89
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '1Y') {
        day = date.getDate() - 359
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    let query;
    ProductModel.findOne({sku: sku})
    .then (result => {
        if(result) {
            if(result.parentId) {
                return query = {parentId: result.parentId}
            } else {
                return query = {_id: result._id}
            }
        } else {
            res.status(200).json([])
        }
    })
    .then(queryId => {
        if(queryId) {
            ProductModel.aggregate([
                {$match: query},
                {$lookup: {
                    from: 'sales',
                    let: {'itemId': '$_id'},
                    pipeline: [
                        {$match: {
                            $expr: {$gte: ['$createdAt', date]}
                        }},
                        {$unwind: '$items'},
                        {$match: {
                            $expr: {
                                $eq: ['$items.productId', '$$itemId']
                            }
                        }},
                        {$group: {
                            _id: '$items.productId',
                            qty: {$sum: '$items.qty'}
                        }}
                    ],
                    as: 'sold'
                }},
                {$unwind: {
                    path: '$sold',
                    preserveNullAndEmptyArrays: true
                }},
                {$addFields: {
                    sold: {
                        $cond: [
                            {$ifNull: ['$sold', false]},'$sold.qty', 0
                        ]
                    }
                }},
                {$sort: {sold: -1}}
            ])
            .then(result => {
                res.status(200).json(result)
            })
        }
    })
}
exports.taskStockOpname = (req, res) => {
    const sku = req.query.sku
    const shopId = mongoose.Types.ObjectId(req.query.shopId)
    ProductModel.findOne({sku: sku})
    .then (result => {
        if(result) {
            if(result.parentId) {
                return query = {parentId: result.parentId}
            } else {
                return query = {_id: result._id}
            }
        } else {
            res.status(200).json([])
        }
    })
    .then(queryId => {
        if(queryId) {
            ProductModel.aggregate([
                {$match: query},
                {$lookup: {
                    from: 'sales',
                    let: {'itemId': '$_id'},
                    pipeline: [
                        // {$match: {
                        //     $expr: {$gte: ['$createdAt', date]}
                        // }},
                        {$unwind: '$items'},
                        {$match: {
                            $expr: {
                                $and: [
                                    {$eq: ['$items.productId', '$$itemId']},
                                    {$eq: ['$shopId', shopId]}
                                ]
                            }
                        }},
                        {$group: {
                            _id: '$items.productId',
                            qty: {$sum: '$items.qty'}
                        }}
                    ],
                    as: 'sold'
                }},
                {$unwind: {
                    path: '$sold',
                    preserveNullAndEmptyArrays: true
                }},
                {$addFields: {
                    sold: {
                        $cond: [
                            {$ifNull: ['$sold', false]},'$sold.qty', 0
                        ]
                    }
                }},
                {$lookup: {
                    from: 'inventories',
                    foreignField: 'productId',
                    localField: '_id',
                    as: 'inventory'
                }},
                {$unwind: {
                    path: '$inventory',
                    preserveNullAndEmptyArrays: true
                }},
                {$match: {'inventory.shopId': shopId}},
                {$addFields: {
                    inventory: '$inventory.qty'
                }},
                {$sort: {sku: 1}}
            ])
            .then(result => {
                res.status(200).json(result)
            })
        }
    })
}
exports.getProductKonsumtif = (req, res) => {
    ProductModel.aggregate([
        {$match: {stock: {$gt: 0}}},
        {$sort: {stock: -1}},
        {$lookup: {
            from: 'sales',
            foreignField: 'items.productId',
            localField: '_id',
            as: 'sales'
        }},
        {$lookup: {
            from: 'onlines',
            foreignField: 'items.productId',
            localField: '_id',
            as: 'online'
        }},
        {$match: {$and: [{sales: []}, {online: []}]}},
        // {$limit: 100},
        {$project: {
            sku: 1,
            name: 1,
            stock: 1,
            purchase: 1,
            total: {$multiply: ['$purchase', '$stock']}
        }}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}