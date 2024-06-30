const mongoose = require('mongoose');
const TransferModle = require('../models/transfer');
const ShopModel = require('../models/shops');
const InventoryModel = require('../models/inventory');
const updateStock = require('../modules/updateStock');
const stockCard = require('../modules/stockCard');

exports.getShopTransfer = (req, res) => {
    const shopId = mongoose.Types.ObjectId(req.user.shopId)
    const currentPage = req.query.page || 1
    const perPage = req.query.perPage || 20
    let totalItems;
    TransferModle.find({fromId: shopId})
    .countDocuments()
    .then(count => {
        totalItems = count
        return TransferModle.aggregate([
            {$match: {fromId: shopId}},
            {$sort: {createdAt: -1}},
            {$skip: (currentPage -1) * perPage},
            {$limit: perPage},
            {$lookup: {
                from:'shops',
                localField: 'fromId',
                foreignField: '_id',
                as: 'from'
            }},
            {$unwind: '$from'},
            {$lookup: {
                from: 'shops',
                localField: 'toId',
                foreignField: '_id',
                as: 'to'
            }},
            {$unwind: '$to'},
            {$lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user'
            }},
            {$unwind: '$user'},
            {$addFields: {
                from: '$from.name',
                to: '$to.name',
                user: '$user.name'
            }},
        ])
    })
    .then(result => {
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

exports.getAllTransfer = (req, res) => {
    const currentPage = req.query.page || 1
    const perPage = req.query.perPage || 20
    let totalItems;
    TransferModle.find()
    .countDocuments()
    .then(count => {
        totalItems = count
        return TransferModle.aggregate([
            {$sort: {createdAt: -1}},
            {$skip: (currentPage -1) * perPage},
            {$limit: perPage},
            {$lookup: {
                from:'shops',
                localField: 'fromId',
                foreignField: '_id',
                as: 'from'
            }},
            {$unwind: '$from'},
            {$lookup: {
                from: 'shops',
                localField: 'toId',
                foreignField: '_id',
                as: 'to'
            }},
            {$unwind: '$to'},
            {$lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user'
            }},
            {$unwind: '$user'},
            {$addFields: {
                from: '$from.name',
                to: '$to.name',
                user: '$user.name'
            }}
        ])
    })
    .then(result => {
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

exports.getDetailTransfer = (req, res) => {
    const transferId = mongoose.Types.ObjectId(req.params.transferId)
    TransferModle.aggregate([
        {$match: {_id: transferId}},
        {$lookup: {
            from:'shops',
            localField: 'fromId',
            foreignField: '_id',
            as: 'from'
        }},
        {$unwind: '$from'},
        {$lookup: {
            from: 'shops',
            localField: 'toId',
            foreignField: '_id',
            as: 'to'
        }},
        {$unwind: '$to'},
        {$lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
        }},
        {$unwind: '$user'},
        {$addFields: {
            from: '$from.name',
            to: '$to.name',
            user: '$user.name'
        }}
    ])
    .then(result => {
        res.status(200).json(result[0])
    })
}

exports.createTransfer = (req, res) => {
    const shopId = req.user.shopId
    ShopModel.find({_id: {$ne: shopId}}).lean()
    .then(result => {
        const shops = result.map(obj => {
            obj.id = obj._id
            obj.text = obj.name
            return obj
        })
        res.status(200).json(shops)
    })
}

exports.insertTransfer = async (req, res) => {
    const toId = req.body.toId
    const fromId = req.user.shopId
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
    let trf = await TransferModle.findOne({createdAt: {$gte: today}}).sort({createdAt: -1})
    let trfNo;
    if(trf) {
        const no = trf.transferNo.substring(16)
        const newNo = parseInt(no)+1
        trfNo = `${dd}${mm}/ZHR/TRF/${yy}/${newNo}`
    } else {
        trfNo = `${dd}${mm}/ZHR/TRF/${yy}/1`
    }
    trf = new TransferModle({
        transferNo: trfNo,
        fromId: fromId,
        toId: toId,
        remarks: req.body.remarks,
        items: req.body.items,
        userId: userId,
        status: 'Sent'
    })
    trf.save ()
    .then(async (result) => {
        let documentId = result._id
        const items = result.items
        for(let i = 0; i < items.length; i ++) {
            const item = items[i]
            // from inventory
            const fromInventory = await InventoryModel.findOne({$and: [{shopId: fromId}, {productId: item.productId}]})
            if(fromInventory) {
                fromInventory.qty = fromInventory.qty - item.qty
                await fromInventory.save()
            } else {
                await InventoryModel.create({shopId: fromId, productId: item.productId, qty: 0})
            }
            const fromBalance = await updateStock(item.productId)
            await stockCard('out', fromId, item.productId, documentId, 'Transfer', item.qty, fromBalance.stock)

            // to inventory
            const toInventory = await InventoryModel.findOne({$and: [{shopId: toId}, {productId: item.productId}]})
            if(toInventory) {
                toInventory.qty = toInventory.qty + item.qty
                await toInventory.save()
            } else {
                await InventoryModel.create({shopId: toId, productId: item.productId, qty: item.qty})
            }
            const toBalance = await updateStock(item.productId)
            await stockCard('in', toId, item.productId, documentId, 'Receive', item.qty, toBalance.stock)
        }
        res.status(200).json(result)
    })
}