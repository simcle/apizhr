const mongoose = require('mongoose');
const MitraModel = require('../models/mitra');
const MitraTakeModel = require('../models/mitraTake');
const MitraRetrunModel = require('../models/mitraReturn');
const MitraPaymentModel = require('../models/mitraPayment');
const MitraSalesModel = require('../models/mitraSales');
const InventoryModel = require('../models/inventory');
const updateStock = require('../modules/updateStock');
const stockCard = require('../modules/stockCard');
const mitraInventoryModule = require('../modules/mitraInventory');
const MitraHistoryModel = require('../models/mitraHistory');

exports.getHistory = (req, res) => {
    const currentPage = req.query.page || 1
    const perPage = req.query.perPage || 20
    let totalItems;
    const shopId = mongoose.Types.ObjectId(req.user.shopId)
    MitraHistoryModel.aggregate([
        {$match: {shopId: shopId}},
        {$count: 'count'}
    ])
    .then(count => {
        if(count.length > 0) {
            totalItems = count[0].count
        } else {
            totalItems = 0
        }
        return MitraHistoryModel.aggregate([
            {$match: {shopId: shopId}},
            {$lookup: {
                from: 'mitras',
                localField: 'mitraId',
                foreignField: '_id',
                as: 'mitra'
            }},
            {$unwind: '$mitra'},
            {$addFields: {
                mitra: '$mitra.name'
            }},
            {$sort: {createdAt: -1}},
            {$skip: (currentPage-1) * perPage},
            {$limit: perPage},
        ])
    })
    .then(result => {
        const last_page = Math.ceil(totalItems / perPage)
        res.status(200).json({
            data: result,
            count: totalItems,
            pages: {
                current_page: currentPage,
                last_page: last_page
            }
        }) 
    })

}

exports.getMitra = (req, res) => {
    MitraModel.find()
    .then(result => {
        res.status(200).json(result)
    })
}

exports.getAllMitras = (req, res) => {
    MitraModel.aggregate([
        {$sort: {createdAt: -1}}
    ])
    .then(result => {
        res.status(200).json(result)

    })
}

exports.newMitra = (req, res) => {
    const mitra = new MitraModel({
        name: req.body.name,
        description: req.body.description
    })
    mitra.save()
    .then(() => {
        res.status(200).json('OK')
    })
}

exports.mitraTake = async (req, res) => {
    const mitraId = req.body.mitraId
    const items = req.body.items
    const grandTotal = req.body.grandTotal
    const shopId = req.user.shopId
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
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    let take = await MitraTakeModel.findOne({createdAt: {$gte: today}}).sort({createdAt: -1})
    let takeNo;
    if(take) {
        const no = take.takeNo.substring(16)
        const newNo = parseInt(no)+1
        takeNo = `${dd}${mm}/MTR/ABL/${yy}/${newNo}`
    } else {
        takeNo = `${dd}${mm}/MTR/ABL/${yy}/1`
    }
    take = new MitraTakeModel({
        takeNo: takeNo,
        mitraId: mitraId,
        shopId: shopId,
        items: items,
        grandTotal: grandTotal,
        note: req.body.note,
        userId: userId
    })
    take.save()
    .then( async (result) => {
        const mitraHistory = new MitraHistoryModel({
            documentNo: takeNo,
            type: 'Ambil Barang',
            mitraId: mitraId,
            shopId: shopId,
            items: result.items,
            grandTotal: grandTotal,
            userId: userId
        })
        await mitraHistory.save()
        let documentId = result._id
        const items = result.items
        for(let i = 0; i < items.length; i ++) {
            const item = items[i]
            const inventory = await InventoryModel.findOne({$and: [{shopId: shopId}, {productId: item.productId}]})
            if(inventory) {
                inventory.qty = inventory.qty - item.qty
                await inventory.save()
            } else {
                await InventoryModel.create({shopId: shopId, productId: item.productId, qty: 0})
            }
            const balance = await updateStock(item.productId)
            await stockCard('out', shopId, item.productId, documentId, 'Mitra', item.qty, balance.stock)
            await mitraInventoryModule('receipt', mitraId, item)
        }
        res.status(200).json(result)
    })
}

exports.mitraReturn = async (req, res) => {
    const mitraId = req.body.mitraId
    const items = req.body.items
    const grandTotal = req.body.grandTotal
    const shopId = req.user.shopId
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
        note: req.body.note,
        userId: userId
    })
    retur.save()
    .then( async (result) => {
        const mitraHistory = new MitraHistoryModel({
            documentNo: returnNo,
            type: 'Kembali Barang',
            mitraId: mitraId,
            shopId: shopId,
            items: result.items,
            grandTotal: grandTotal,
            userId: userId
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

exports.getSales = (req, res) => {
    const mitraId = req.params.mitraId
    MitraSalesModel.find({$and: [{mitraId: mitraId}, {status: 'BELUM BAYAR'}]})
    .then(result => {
        res.status(200).json(result)
    })
}

exports.mitraPayment = async (req, res) => {
    const userId = req.user._id
    const shopId = req.user.shopId
    const mitraId = req.body.mitraId
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
    let payment = await MitraPaymentModel.findOne({createdAt: {$gte: today}}).sort({createdAt: -1})
    let paymentNo;
    if(payment) {
        const no = payment.paymentNo.substring(16)
        const newNo = parseInt(no)+1
        paymentNo = `${dd}${mm}/MTR/BYR/${yy}/${newNo}`
    } else {
        paymentNo = `${dd}${mm}/MTR/BYR/${yy}/1`
    }
    for (let i = 0; i < items.length; i++) {
        const item = items[i]
        await MitraSalesModel.updateOne({_id: item._id}, {status: 'LUNAS'})
    }

    const mitraPayment = new MitraPaymentModel({
        paymentNo: paymentNo,
        mitraId: mitraId,
        items: items,
        userId: userId
    })
    await mitraPayment.save();
    const mitraHistory = new MitraHistoryModel({
        documentNo: paymentNo,
        type: 'Bayar',
        mitraId: mitraId,
        shopId: shopId,
        items: items,
        grandTotal: grandTotal,
        userId: userId
    })
    await mitraHistory.save()
    res.status(200).json('OK')
}