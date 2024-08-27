const mongoose = require('mongoose');
const MitraInventoryModel = require('../models/mitraInventory');
const MitraSaleModel = require('../models/mitraSales');
const ProductModel = require('../models/products');
const ShopModel = require('../models/shops');
const MitraRetrunModel = require('../models/mitraReturn');
const mitraInventoryModule = require('../modules/mitraInventory');
const MitraHistoryModel = require('../models/mitraHistory');
const InventoryModel = require('../models/inventory');
const updateStock = require('../modules/updateStock');
const stockCard = require('../modules/stockCard');
const MitraSO = require('../models/mitraSo')

exports.getSoSku = (req, res) => {
    const sku = req.query.sku
    ProductModel.aggregate([
        {$match: {sku: sku}},
        {$lookup: {
            from: 'mitrainventories',
            localField: '_id',
            foreignField: 'productId',
            as: 'inventory'
        }},
        {$unwind: {
            path: '$inventory',
            preserveNullAndEmptyArrays: true
        }},
        {$addFields: {
            unitPrice: '$inventory.unitPrice',
            qty: '$inventory.qty'
        }}
    ])
    .then(result => {
        res.status(200).json(result[0])
    })
   
}

exports.insertSoInventory = (req, res) => {
    const productId = req.body.productId
    const mitraId = req.body.mitraId
    const sku = req.body.sku
    const name = req.body.name
    const unitPrice = req.body.unitPrice
    const qty = req.body.qty
    const onHand = req.body.onHand
    MitraInventoryModel.findOne({$and: [{productId: productId}, {mitraId: mitraId}]})
    .then(item => {
        if(item) {
            item.unitPrice = unitPrice
            item.name = item.name
            item.qty = qty
            return item.save()
        } else {
            const inv = new MitraInventoryModel({
                mitraId: mitraId,
                productId: productId,
                sku: sku,
                name: name,
                unitPrice: unitPrice,
                qty: qty
            })
            return inv.save()
            
        }
    })
    .then(() => {
        const mitraso = new MitraSO({
            mintraId: mitraId,
            productId: productId,
            sku: sku,
            name: name,
            onHand: onHand,
            qty: qty
        })
        return mitraso.save()
    })
    .then(() => {
        res.status(200).json('OK')
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

exports.getShop = (req, res) => {
    ShopModel.find().lean()
    .then(result => {
        const data = result.map(obj => {
            obj.text = obj.name,
            obj.id = obj._id
            return obj
        })
        res.status(200).json(data)
    })
}

exports.getTransfer = async (req, res) => {
    const mitraId = mongoose.Types.ObjectId(req.query.mitraId)
    const currentPage = req.query.page || 1
    const perPage = req.query.perPage || 20
    let totalItems;
    MitraRetrunModel.aggregate([
        {$match: {$and: [{shopId: {$exists: true}}, {mitraId: mitraId}]}},
        {$count: 'count'}
    ])
    .then(result => {
        if(result.length > 0) {
            totalItems = result[0].count
        } else {
            totalItems = 0
        }

        return MitraRetrunModel.aggregate([
            {$match: {$and: [{shopId: {$exists: true}}, {mitraId: mitraId}]}},
            {$sort: {createdAt: -1}},
            {$skip: (currentPage -1) * perPage},
            {$limit: perPage},
            {$lookup: {
                from: 'shops',
                foreignField: '_id',
                localField: 'shopId',
                as: 'shop'
            }},
            {$unwind: '$shop'},
            {$addFields: {
                shop: '$shop.name'
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

exports.transferStok = async (req, res) => {
    const shopId = req.body.toId
    const mitraId  = req.body.mitraId
    const items = req.body.items
    const grandTotal = req.body.grandTotal
    const date = new Date();
    let dd = date.getDate();
    let mm = date.getMonth() +1;
    let yy = date.getFullYear().toString().substring(2);
    dd = checkTime(dd);
    mm = checkTime(mm)
    function checkTime (i) {
        if(i < 10) {
            i = `0${i}`
        }
        return i
    }
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    let retur = await MitraRetrunModel.findOne({createdAt: {$gte: today}}).sort({createdAt: -1})
    let returnNo;
    if(retur) {
        const no = retur.returnNo.substring(16)
        const newNo = parseInt(no)+1
        returnNo = `${dd}${mm}/MTR/KBL/${yy}/${newNo}`
    } else {
        returnNo = `${dd}${mm}/MTR/KBL/${yy}/1`
    }
    retur = new MitraRetrunModel({
        returnNo: returnNo,
        mitraId: mitraId,
        shopId: shopId,
        items: items,
        grandTotal: grandTotal,
        note: req.body.note
    })
    retur.save()
    .then( async (result) => {
        const mitraHistory = new MitraHistoryModel({
            documentNo: returnNo,
            type: 'Kembali Barang',
            mitraId: mitraId,
            shopId: shopId,
            items: result.items,
            grandTotal: grandTotal
        })
        await mitraHistory.save()
        let documentId = result._id
        const items = result.items
        for(let i = 0; i < items.length; i ++) {
            const item = items[i]
            const inventory = await InventoryModel.findOne({$and: [{shopId: shopId}, {productId: item.productId}]})
            if(inventory) {
                inventory.qty = inventory.qty + item.qty
                await inventory.save()
            } else {
                await InventoryModel.create({shopId: shopId, productId: item.productId, qty: 0})
            }
            const balance = await updateStock(item.productId)
            await stockCard('in', shopId, item.productId, documentId, 'Mitra', item.qty, balance.stock)
            await mitraInventoryModule('return', mitraId, item)
        }
        res.status(200).json(result)
    })
}

exports.getStockBarang = (req, res) => {
    const search = req.query.search
    var queryString = '\"' + search.split(' ').join('\" \"') + '\"';
    ProductModel.aggregate([
        {$match: {$text: {$search: queryString}}},
        {$project: {
            _id: 1,
            sku: 1,
            name: 1,
            score: {$meta: 'textScore'}
        }},
        {$sort: {score: -1}},
        {$lookup: {
            from: 'inventories',
            localField: '_id',
            foreignField: 'productId',
            as: 'inventory'
        }},
        {$project: {
            _id: 0,
            name: 1,
            sku: 1,
            inventory: 1,
            score: 1
        }},
        {$unwind: '$inventory'},
        {$replaceRoot: {newRoot: {$mergeObjects: ['$$ROOT', '$inventory']}}},
        {$project: {
            _id: 1,
            name: 1,
            sku: 1,
            shopId: 1,
            productId: 1,
            qty: 1,
            score: 1
        }},
        {$lookup: {
            from: 'shops',
            localField: 'shopId',
            foreignField: '_id',
            as: 'shop'
        }},
        {$unwind: '$shop'},
        {$addFields: {
            shop: '$shop.name'
        }},
        {$limit: 10}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}
