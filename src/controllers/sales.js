const mongoose = require('mongoose');
const SalesModel = require('../models/sales');
const InventoryModel = require('../models/inventory');
const updateStock = require('../modules/updateStock');
const stockCard = require('../modules/stockCard');


exports.getSales = (req, res) => {
    const currentPage = req.query.page || 1
    const perPage = req.query.perPage || 20
    let totalItems;
    const shopId = req.user.shopId
    const date = new Date();
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    SalesModel.find({$and:[{shopId: shopId},{createdAt: {$gte: today}}]}).sort({createdAt: -1})
    .countDocuments()
    .then(count => {
        totalItems = count
        return SalesModel.find({$and:[{shopId: shopId},{createdAt: {$gte: today}}]})
        .skip((currentPage-1) * perPage)
        .limit(perPage)
        .sort({createdAt: -1})
    })
    .then(result => {
        const last_page = Math.ceil(totalItems / perPage)
        res.status(200).json({
            data: result,
            pages: {
                current_page: currentPage,
                last_page: last_page
            }
        }) 
    })   
}

exports.getDetailSales = (req, res) => {
    const salesId = req.params.salesId
    SalesModel.findById(salesId)
    .then(result => {
        res.status(200).json(result)
    })
    .catch(err => {
       res.status(400).send(err)
    })
}

exports.insertSales = async (req, res) => {
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
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    let sales = await SalesModel.findOne({createdAt: {$gte: today}}).sort({createdAt: -1})
    let salesNo;
    if(sales) {
        const no = sales.salesNo.substring(16)
        const newNo = parseInt(no)+1
        salesNo = `${dd}${mm}/ZHR/POS/${yy}/${newNo}`
    } else {
        salesNo = `${dd}${mm}/ZHR/POS/${yy}/1`
    }
    sales = new SalesModel({
        salesNo: salesNo,
        shopId: shopId,
        items: req.body.items,
        grandTotal: req.body.grandTotal,
        paymentMethod: req.body.paymentMethod,
        bankId: req.body.bankId,
        cash: req.body.cash,
        transfer: req.body.transfer,
        debit: req.body.debit,
        bayar: req.body.bayar,
        kembali: req.body.kembali,
        userId: userId
    })
    sales.save()
    .then( async (result) => {
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
            await stockCard('out', shopId, item.productId, documentId, 'Penjualan', item.qty, balance.stock)
        }
        res.status(200).json(result)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

exports.updateSales = async (req, res) => {
    const salesId = req.body._id
    const original = req.body.originalItems
    const shopId = req.user.shopId
    for(let i = 0; i < original.length; i++) {
        const item = original[i]
        const inventory = await InventoryModel.findOne({$and: [{shopId: shopId}, {productId: item.productId}]})
        inventory.qty += item.qty
        await inventory.save()
        const balance = await updateStock(mongoose.Types.ObjectId(item.productId))
        await stockCard('in', shopId, item.productId, salesId, 'Edit penjualan', item.qty, balance.stock)
    }
    SalesModel.findById(salesId)
    .then(sale => {
        sale.items = req.body.items
        sale.grandTotal = req.body.grandTotal
        sale.paymentMethod = req.body.paymentMethod
        sale.bankId = req.body.bankId
        sale.cash = req.body.cash
        sale.transfer = req.body.transfer
        sale.debit = req.body.debit
        sale.bayar = req.body.bayar
        sale.kembali = req.body.kembali
        return sale.save()
    })
    .then( async (result) => {
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
            await stockCard('out', shopId, item.productId, documentId, 'Update penjualan', item.qty, balance.stock)
        }
        res.status(200).json(result)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}