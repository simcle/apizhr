const salesModel = require('../models/sales');
const OnlineModel = require('../models/online');
const MitraPaymentModel = require('../models/mitraPayment');
const ShopModel = require('../models/shops');
const ProductModel = require('../models/products');

const mongoose = require('mongoose');
const moment = require('moment')
exports.getDashboard = (req, res) => {
    const start = moment(req.query.start).set('hour', 0).set('minute', 0).set('second', 0).toDate()
    const end = moment(req.query.end).set('hour', 23).set('minute', 59).set('second', 59).toDate()
    const offlne = salesModel.aggregate([
        {$match: {createdAt: {$gte: start, $lte: end}}},
        {$group: {
            _id: '$shopId',
            total: {$sum: '$grandTotal'}
        }},
        {$lookup: {
            from: 'shops',
            foreignField: '_id',
            localField: '_id',
            as: 'shop'
        }},
        {$unwind: '$shop'},
        {$addFields: {
            shop: '$shop.name'
        }},
        {$sort: {total: -1}}
    ])

    const online = OnlineModel.aggregate([
        {$match: {createdAt: {$gte: start, $lte: end}}},
        {$group: {
            _id: '$userId',
            total: {$sum: '$grandTotal'}
        }},
        {$lookup: {
            from: 'users',
            foreignField: '_id',
            localField: '_id',
            as: 'user'
        }},
        {$unwind: '$user'},
        {$addFields: {
            user: '$user.name'
        }},
        {$sort: {total: -1}}
    ])
    const mitra = MitraPaymentModel.aggregate([
        {$match: {createdAt: {$gte: start, $lte: end}}},
        {$unwind: '$items'},
        {$group: {
            _id: '$mitraId',
            total: {$sum: '$items.total'}
        }},
        {$lookup: {
            from: 'mitras',
            foreignField: '_id',
            localField: '_id',
            as: 'mitra'
        }},
        {$unwind: '$mitra'},
        {$addFields: {
            mitra: '$mitra.name'
        }}
    ])
    Promise.all([
        offlne,
        online,
        mitra
    ])
    .then(result => {
        const data = {
            offline: result[0],
            online: result[1],
            mitra: result[2]
        }
        res.status(200).json(data)
    })
}
exports.getStatisticsOffline = (req, res) => {
    const shopId = mongoose.Types.ObjectId(req.query.shopId)
    const filter = req.query.filter
    let groupDate, query, start, end;
    if(filter == '7D') {
        start = moment(req.query.start).set('hour', 0).set('minute', 0).set('second', 0).toDate()
        end = moment(req.query.end).set('hour', 23).set('minute', 59).set('second', 59).toDate()
        query = {$and: [{shopId: shopId}, {createdAt: {$gte: start, $lte: end}}]}
        groupDate = {$dateToString: {format: "%Y-%m-%d", date: '$createdAt'}}
        formater = {$dateToString: {format: "%d-%m-%Y", date: '$createdAt'}}
    }
    if(filter == '30D') {
        start = moment().startOf('week').weekday(-20).isoWeekday(1).toDate()
        query = {$and: [{shopId: shopId}, {createdAt: {$gte: start}}]}
        groupDate = {$isoWeek: {date: '$createdAt', timezone: 'Asia/Jakarta'}}
    }
    if(filter == '90D') {
        start = moment().startOf('month').month(-5).toDate()
        query = {$and: [{shopId: shopId}, {createdAt: {$gte: start}}]}
        groupDate = {$month: '$createdAt'}
    }
    if(filter == '1Y') {
        start = moment().startOf('month').month(-11).toDate()
        query = {$and: [{shopId: shopId}, {createdAt: {$gte: start}}]}
        groupDate = {$month: '$createdAt'}
    }
    salesModel.aggregate([
        {$match: query},
        {$group: {
            _id: groupDate,
            total: {$sum: '$grandTotal'},
            date: {$first: '$createdAt'}
        }},
        {$sort: {date: 1}}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}
exports.getStatisticsOnline = (req, res) => {
    const userId = mongoose.Types.ObjectId(req.query.userId)
    const filter = req.query.filter
    let groupDate, query, start, end;
    if(filter == '7D') {
        start = moment(req.query.start).set('hour', 0).set('minute', 0).set('second', 0).toDate()
        end = moment(req.query.end).set('hour', 23).set('minute', 59).set('second', 59).toDate()
        query = {$and: [{userId: userId}, {createdAt: {$gte: start, $lte: end}}]}
        groupDate = {$dateToString: {format: "%Y-%m-%d", date: '$createdAt'}}
        formater = {$dateToString: {format: "%d-%m-%Y", date: '$createdAt'}}
    }
    if(filter == '30D') {
        start = moment().startOf('week').weekday(-20).isoWeekday(1).toDate()
        query = {$and: [{userId: userId}, {createdAt: {$gte: start}}]}
        groupDate = {$isoWeek: {date: '$createdAt', timezone: 'Asia/Jakarta'}}
    }
    if(filter == '90D') {
        start = moment().startOf('month').month(-5).toDate()
        query = {$and: [{userId: userId}, {createdAt: {$gte: start}}]}
        groupDate = {$month: '$createdAt'}
    }
    if(filter == '1Y') {
        start = moment().startOf('month').month(-11).toDate()
        query = {$and: [{userId: userId}, {createdAt: {$gte: start}}]}
        groupDate = {$month: '$createdAt'}
    }
    OnlineModel.aggregate([
        {$match: query},
        {$group: {
            _id: groupDate,
            total: {$sum: '$grandTotal'},
            date: {$first: '$createdAt'}
        }},
        {$sort: {date: 1}}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}
exports.getStatisticsOneYear = (req, res) => {
    salesModel.aggregate([
        {$project: {
            createdAt: 1,
            grandTotal: 1
        }},
        {$group: {
            _id: {$dateToString: {format: "%Y-%m", date: '$createdAt'}},
            createdAt: {$first: '$createdAt'},
            total: {$sum: '$grandTotal'},
        }},
        {$lookup: {
            from: 'onlines',
            let: {'id': '$_id'},
            pipeline: [
                {$group: {
                    _id: {$dateToString: {format: "%Y-%m", date: '$createdAt'}},
                    createdAt: {$first: '$createdAt'},
                    total: {$sum: '$grandTotal'},
                }},
                {$match: {
                    $expr: {$eq: ['$_id', '$$id']}
                }}
            ],
            as: 'online'
        }},
        {$unwind: {
            path: '$online',
            preserveNullAndEmptyArrays: true
        }},
        {$lookup: {
            from: 'mitrapayments',
            let: {'id': '$_id'},
            pipeline: [
                {$unwind: '$items'},
                {$group: {
                    _id: {$dateToString: {format: "%Y-%m", date: '$createdAt'}},
                    createdAt: {$first: '$createdAt'},
                    total: {$sum: '$items.total'},
                }},
                {$match: {
                    $expr: {$eq: ['$_id', '$$id']}
                }}
            ],
            as: 'mitra'
        }},
        {$unwind: {
            path: '$mitra',
            preserveNullAndEmptyArrays: true
        }},
        {$addFields: {
            online:{
                $cond: [
                    {$ifNull: ['$online', false]},'$online.total', 0
                ]
            },
            mitra:{
                $cond: [
                    {$ifNull: ['$mitra', false]},'$mitra.total', 0
                ]
            },
        }},
        {$sort: {createdAt: 1}},
        {$project: {
            _id: 1,
            total: {$sum: ['$total', '$online', '$mitra']}
        }}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}

exports.getBestSeller = (req, res) => {
    const currentPage = req.query.page || 1
    const filter = req.query.filter
    const categoryId = req.query.categoryId
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
    byDate = {createdAt: {$gte: date}}
    salesModel.aggregate([
        {$match: byDate},
        {$unwind: '$items'},
        {$group: {
            _id: '$items.productId',
            qty: {$sum: '$items.qty'},
            sku: {$first: '$items.sku'}

        }},
        {$sort: {qty: -1}},
        {$unionWith: {
            coll: 'onlines',
            pipeline: [
                {$match: byDate},
                {$unwind: '$items'},
                {$group: {
                    _id: '$items.productId',
                    qty: {$sum: '$items.qty'},
                    sku: {$first: '$items.sku'}
                }},
                {$sort: {qty: -1}},
            ]
        }},
        {$unionWith: {
            coll: 'mitrapayments',
            pipeline: [
                {$match: byDate},
                {$unwind: '$items'},
                {$group: {
                    _id: '$items.sku',
                    qty: {$sum: '$items.qty'},
                    sku: {$first: '$items.sku'}
                }},
                {$sort: {qty: -1}},
            ]
        }},
        {$group: {
            _id: '$sku',
            qty: {$sum: '$qty'}
        }},
        {$sort: {qty: -1}},
        {$project: {
            _id: 1,
            qty: 1
        }},
        {$lookup: {
            from: 'products', 
            foreignField: 'sku',
            localField: '_id',
            as: 'product'
        }},
        {$unwind: '$product'},
        {$addFields: {
            name: '$product.name',
            stock: '$product.stock',
            categoryId: '$product.categoryId'
        }},
        {$unset: 'product'},
        {$match: query},
        {$skip: (currentPage -1) * 20},
        {$limit: 20},
    ])
    .then(result => {
        res.status(200).json({
            data: result,
            page: currentPage
        })
    })
    .catch(err => {
        console.log(err)
    })
}

exports.getDetailProduct = async (req, res) => {
    const sku = req.params.sku
    const filter = req.query.filter
    let day;
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
    const product = await ProductModel.findOne({sku: sku})
    const productId = product._id
    const exceptShopId = new mongoose.Types.ObjectId('6475d52daa375fa751092f5d')
    const offline = ShopModel.aggregate([
        {$match: {_id: {$ne: exceptShopId}}},
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
    const online = OnlineModel.aggregate([
        {$match: {createdAt: {$gte: date}}},
        {$unwind: '$items'},
        {$match: {'items.productId': productId}},
        {$addFields: {
            qty: '$items.qty'
        }},
        {$lookup: {
            from: 'customers',
            foreignField: '_id',
            localField: 'customerId',
            as: 'customer'
        }},
        {$unwind: '$customer'},
        {$addFields: {
            marketId: '$customer.marketplaceId'
        }},
        {$unset: 'customer'},
        {$lookup: {
            from: 'marketplaces',
            foreignField: '_id',
            localField: 'marketId',
            as: 'market'
        }},
        {$unwind: '$market'},
        {$addFields: {
            market: '$market.name'
        }},
        {$group: {
            _id: '$marketId',
            sold: {$sum: '$qty'},
            market: {$first: '$market'}
        }},
        {$sort: {sold: -1}}
    ])
    const mitra =  MitraPaymentModel.aggregate([
        {$match: {createdAt: {$gte: date}}},
        {$unwind: '$items'},
        {$match: {'items.sku': sku}},
        {$group: {
            _id: '$items.sku',
            mitraId: {$first: '$mitraId'},
            qty: {$sum: '$items.qty'}
        }},
        {$lookup: {
            from: 'products',
            localField: '_id',
            foreignField: 'sku',
            as: 'productId'
        }},
        {$unwind: '$productId'},
        {$addFields: {
            productId: '$productId._id'
        }},
        {$lookup: {
            from: 'mitrainventories',
            localField: 'productId',
            foreignField: 'productId',
            as: 'stock'
        }},
        {$unwind: {
            path: '$stock',
            preserveNullAndEmptyArrays: true
        }},
        {$lookup: {
            from: 'mitras',
            localField: 'mitraId',
            foreignField: '_id',
            as: 'mitra'
        }},
        {$unwind: '$mitra'},
        {$addFields: {
            mitra: '$mitra.name',
            stock: {
                $cond: [
                    {$ifNull: ['$stock', false]},'$stock.qty', 0
                ]
            }
        }}
    ])
    Promise.all([
        offline,
        online,
        mitra
    ])
    .then(result => {
        res.status(200).json({
            offline: result[0],
            online: result[1],
            mitra: result[2]
        })
    })
}