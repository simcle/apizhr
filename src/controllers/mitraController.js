const mongoose = require('mongoose');
const MitraInventoryModel = require('../models/mitraInventory');
const MitraSaleModel = require('../models/mitraSales');
const ProductModel = require('../models/products');

exports.getSoSku = (req, res) => {
    const sku = req.query.sku
    ProductModel.findOne({sku: sku})
    .then(result => {
        res.status(200).json(result)
    })
}

exports.insertSoInventory = (req, res) => {
    const productId = req.body.productId
    const mitraId = req.body.mitraId
    const sku = req.body.sku
    const name = req.body.name
    const unitPrice = req.body.unitPrice
    const qty = req.body.qty
    MitraInventoryModel.findOne({$and: [{productId: productId}, {mitraId: mitraId}]})
    .then(item => {
        if(item) {
            item.unitPrice = unitPrice
            item.name = item.name
            item.qty = item.qty + qty
            item.save()
            .then(() => {
                res.status(200).json('OK')
            })
        } else {
            const inv = new MitraInventoryModel({
                mitraId: mitraId,
                productId: productId,
                sku: sku,
                name: name,
                unitPrice: unitPrice,
                qty: qty
            })
            inv.save()
            .then(() => {
                res.status(200).json('OK')
            })
        }
    })
}

exports.getDashboard = (req, res) => {
    const mitraId = mongoose.Types.ObjectId(req.query.mitraId)
    const thirtyDay = new Date()
    const day = thirtyDay.getDate() - 29
    thirtyDay.setDate(day)
    thirtyDay.setHours(0, 0, 0, 0)
    const stats = MitraSaleModel.aggregate([
        {$match: {$and: [{mitraId: mitraId}, {createdAt: {$gte: thirtyDay}}]}},
        {$project: {
            createdAt: 1,
            total: 1,
            unitPrice: {$multiply: ['$unitPrice', '$qty']},
            profit: {$subtract: ['$total', {$multiply: ['$unitPrice', '$qty']}]}
        }},
        {$group: {
        _id: {$dateToString: {format: "%Y-%m-%d", date: '$createdAt'}},
            total: {$sum: '$total'},
            unitPrice: {$sum: '$unitPrice'},
            profit: {$sum: '$profit'}
        }},
        {$sort: {_id: 1}}
    ])
    const recap = MitraSaleModel.aggregate([
        {$match: {$and: [{mitraId: mitraId}, {createdAt: {$gte: thirtyDay}}]}},
        {$project: {
            productId: 1,
            sku: 1,
            name: 1,
            qty: 1,
            total: 1,
            unitPrice: {$multiply: ['$unitPrice', '$qty']},
            profit: {$subtract: ['$total', {$multiply: ['$unitPrice', '$qty']}]}
        }},
        {$group: {
            _id: '$productId',
            sku: {$first: '$sku'},
            name: {$first: '$name'},
            sold: {$sum: '$qty'},
            omzet: {$sum: '$total'},
            unitcost: {$sum: '$unitPrice'},
            profit: {$sum: '$profit'}
        }},
        {$lookup: {
            from: 'mitrainventories',
            let: {'itemId':'$_id'},
            pipeline: [
                {$match: {
                    $expr: { $and: [
                        {$eq: ['$$itemId', '$productId']},
                        {$eq: [mitraId, '$mitraId']},

                    ]}
                }},
            ],
            as: 'stock'
        }},
        {$unwind: '$stock'},
        {$addFields: {
            stock: '$stock.qty'
        }},
        {$sort: {sold: -1}}
    ])
    Promise.all([
        stats,
        recap
    ])
    .then(result => {
        res.status(200).json({
            stats: result[0],
            recap: result[1]
        })
    })
}


exports.getSKU = (req, res) => {
    const mitraId = req.query.mitraId
    const sku = req.query.sku
    MitraInventoryModel.findOne({$and: [{mitraId: mitraId}, {sku: sku}]})
    .then(result => {
        res.status(200).json(result)
    })
}
exports.getSales = (req, res) => {
    const mitraId = req.query.mitraId
    MitraSaleModel.find({$and: [{mitraId: mitraId}, {status: 'BELUM BAYAR'}]}).sort({createdAt: -1})
    .then(result => {
        res.status(200).json(result)
    })
}
exports.insertSales =  (req, res) => {
    const sales = new MitraSaleModel({
        mitraId: req.body.mitraId,
        productId: req.body.productId,
        sku: req.body.sku,
        name: req.body.name,
        unitPrice: req.body.unitPrice,
        price: req.body.price,
        qty: req.body.qty,
        total: req.body.total
    })
    sales.save() 
    .then(async () => {
        const inv = await MitraInventoryModel.findOne({$and: [{mitraId: req.body.mitraId}, {_id: req.body._id}]})
        inv.qty = inv.qty - req.body.qty
        await inv.save()
        return MitraSaleModel.find({$and: [{mitraId: req.body.mitraId}, {status: 'BELUM BAYAR'}]}).sort({createdAt: -1})
    })
    .then(result => {
       res.status(200).json(result)
    })
}

exports.deleteSales = async (req, res) => {
    const inv = await MitraInventoryModel.findOne({$and: [{mitraId: req.body.mitraId}, {productId: req.body.productId}]})
    inv.qty = inv.qty + req.body.qty
    await inv.save()
    await MitraSaleModel.deleteOne({_id: req.body._id})
    res.status(200).json("OK")
}

exports.getInventory = (req, res) => {
    const mitraId = mongoose.Types.ObjectId(req.query.mitraId)
    const search = req.query.search
    const currentPage = req.query.page || 1
    const perPage = req.query.perPage || 20
    let totalItems;
    var queryString = '\"' + search.split(' ').join('\" \"') + '\"';
    let query;
    if(search) {
        query = {$and: [{mitraId: mitraId}, {$text: {$search: queryString}}]}
    } else {
        query = {mitraId: mitraId}
    }
    MitraInventoryModel.aggregate([
        {$match: query},
        {$count: 'count'}
    ])
    .then(result => {
        if(result.length > 0) {
            totalItems = result[0].count
        } else {
            totalItems = 0
        }
        return MitraInventoryModel.aggregate([
            {$match: query},
            {$sort: {sku: 1}},
            {$skip: (currentPage -1) * perPage},
            {$limit: perPage},
            {$lookup: {
                from: 'mitrasales',
                let: {'itemId':'$productId'},
                pipeline: [
                    {$group: {
                        _id: '$productId',
                        sold: {$sum: '$qty'}
                    }},
                    {$match: {
                        $expr: {
                            $eq: ['$$itemId', '$_id'],
                        }
                    }},
                ],
                as: 'sales'
            }},
            {$unwind: {
                path: '$sales',
                preserveNullAndEmptyArrays: true
            }},
            {$addFields: {
                sales: {
                    $cond: [
                        {$ifNull: ['$sales', false]},'$sales.sold', 0
                    ]
                }
            }}
        ])
    })
    .then(result => {
        const last_page = Math.ceil(totalItems / perPage)
        res.status(200).json({
            data: result,
            pages: {
                current_page: currentPage,
                last_page: last_page,
                totalItems: totalItems
            }
        })
    })
}