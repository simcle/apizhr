const mongoose = require('mongoose');
const ReceiptsModel = require('../models/receipts');
const ShopModel = require('../models/shops');
const InventoryModel = require('../models/inventory');
const updateStock = require('../modules/updateStock');
const stockCard = require('../modules/stockCard');

exports.getAllReceipts = (req, res) => {
    const search = req.query.search
    const currentPage = req.query.page || 1
    const perPage = req.query.perPage || 20
    let totalItems;
    ReceiptsModel.aggregate([
        {$lookup: {
            from: 'suppliers',
            foreignField: '_id',
            localField: 'supplierId',
            as: 'supplier'
        }},
        {$unwind: {
            path: '$supplier',
            preserveNullAndEmptyArrays: true
        }},
        {$addFields: {
            supplier: '$supplier.name'
        }},
        {$match: {supplier: {$regex: '.*'+search+'.*', $options: 'i'}}},
        {$count: 'count'}
    ])
    .then(count => {
        if(count.length > 0) {
            totalItems = count[0].count
        } else {
            totalItems = 0
        }
        return ReceiptsModel.aggregate([
            {$lookup: {
                from: 'users',
                foreignField: '_id',
                localField: 'userId',
                as: 'user'
            }},
            {$unwind: '$user'},
            {$lookup: {
                from: 'suppliers',
                foreignField: '_id',
                localField: 'supplierId',
                as: 'supplier'
            }},
            {$unwind: {
                path: '$supplier',
                preserveNullAndEmptyArrays: true
            }},
            {$addFields: {
                user: '$user.name',
                supplier: '$supplier.name'
            }},
            {$match: {supplier: {$regex: '.*'+search+'.*', $options: 'i'}}},
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
    const receiptsId = mongoose.Types.ObjectId(req.params.receiptsId);
    ReceiptsModel.aggregate([
        {$match: {_id: receiptsId}},
        {$lookup: {
            from: 'users',
            foreignField: '_id',
            localField: 'userId',
            as: 'user'
        }},
        {$unwind: '$user'},
        {$lookup: {
            from: 'suppliers',
            foreignField: '_id',
            localField: 'supplierId',
            as: 'supplier'
        }},
        {$unwind: '$supplier'},
        {$addFields: {
            user: '$user.name',
            supplier: '$supplier.name'
        }}
    ])
    .then(result => {
        res.status(200).json(result[0])
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

exports.insertReceipts = async (req, res) => {
    const shop = await ShopModel.findOne({name: 'GUDANG'});
    const shopId = shop._id
    const userId = req.user._id
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
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    let receipts = await ReceiptsModel.findOne({createdAt: {$gte: today}}).sort({createdAt: -1})
    let receiptsNo; 
    if(receipts) {
        const no = receipts.receiptsNo.substring(16)
        const newNo = parseInt(no)+1
        receiptsNo = `${dd}${mm}/ZHR/RCP/${yy}/${newNo}`
    } else {
        receiptsNo = `${dd}${mm}/ZHR/RCP/${yy}/1`   
    }
    receipts = new ReceiptsModel({
        receiptsNo: receiptsNo,
        supplierId: req.body.supplierId,
        items: req.body.items,
        grandTotal: req.body.grandTotal,
        remarks: req.body.remarks,
        userId: req.user._id
    })
    receipts.save()
    .then(async (result) => {
        let documentId = result._id
        const items = result.items
        for(let i = 0; i < items.length; i ++) {
            const item = items[i]
            const inventory = await InventoryModel.findOne({$and: [{shopId: shopId}, {productId: item.productId}]})
            if(inventory) {
                inventory.qty = inventory.qty + item.qty
                await inventory.save()
            } else {
                await InventoryModel.create({shopId: shopId, productId: item.productId, qty: item.qty})
            }
            const balance = await updateStock(item.productId)
            await stockCard('in', shopId, item.productId, documentId, 'Receipts', item.qty, balance.stock)
        }
        res.status(200).json(result)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}