const mongoose = require('mongoose')
const SalesModel = require('../models/sales');
const ReceiptsModel = require('../models/receipts');
const CategoryModel = require('../models/categories');
const ShopModel = require('../models/shops');

exports.getCategories = (req, res) => {
    CategoryModel.find()
    .then(result => {
        res.status(200).json(result)
    })
}

exports.getProducts = (req, res) => {
    const sortKey = req.query.sortKey
    const sortOrder = parseInt(req.query.sortOrder)
    const search = req.query.search
    const categories = req.query.filterCategories
    const filter = req.query.time
    let categoryIds, byDate, query, day;
    if(categories) {
        const cateObjId = []
        for (let i = 0; i < categories.length; i++) {
            cateObjId.push(mongoose.Types.ObjectId(categories[i]))
        }
        query = {categoryId: {$in: cateObjId}}
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
                {$limit: 30},
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
                {$lookup: {
                    from: 'receipts',
                    let: {'productId': '$_id'},
                    pipeline: [
                        {$match: {
                            $expr: {
                                $gte: ['$createdAt', date]
                            }
                        }},
                        {$unwind: '$items'},
                        {$project: {
                            items: 1
                        }},
                        {$group: {
                            _id: '$items.productId',
                            qty: {$sum: '$items.qty'}
                        }},
                        {$match: {
                            $expr: {
                                $eq: ['$$productId', '$_id'],
                            }
                        }},
                    ],
                    as: 'receipt'
                }},
                {$unwind: {
                    path: '$receipt',
                    preserveNullAndEmptyArrays: true
                }},
                {$addFields: {
                    receipt: {
                        $cond: [
                            {$ifNull: ['$receipt', false]},'$receipt.qty', 0
                        ]
                    }
                }},
            ]) 
            .then(async (result) => {
                res.status(200).json(result)
            })
            break;
        case 'incoming':    
            console.log(sortKey)
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