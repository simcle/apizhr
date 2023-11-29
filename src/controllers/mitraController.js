const mongoose = require('mongoose');
const MitraInventoryModel = require('../models/mitraInventory');
const MitraSaleModel = require('../models/mitraSales');

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