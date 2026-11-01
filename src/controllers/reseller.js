const mongoose = require('mongoose');
const SellerModel = require('../models/seller');
const ResellerModel = require('../models/reseller');
const InventoryModel = require('../models/inventory');
const updateStock = require('../modules/updateStock');
const stockCard = require('../modules/stockCard');
const BankModel = require('../models/banks');

exports.statReseller = (req, res ) => {
    const shopId = mongoose.Types.ObjectId(req.user.shopId)
    const date = new Date();
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    ResellerModel.aggregate([
        {$match: {shopId: shopId}},
        {$group: {
            _id: null,
            belumBayar: {$sum: {$cond: [{$eq: ['$status', false]}, '$sisa', 0]}},
            payments: {$push: '$payments'},
            
        }},
        {$unwind: '$payments'},
        {$unwind: {
            path: '$payments',
        }},
        {$group: {
            _id: null,
            belumBayar: {$first: '$belumBayar'},
            bayarHariIni: {$sum: {$cond: [{$gte: ['$payments.paymentDate', today]}, '$payments.amount', 0]}},
        }}
    ])
    .then(result => {
        let stat = {}
        if(result.length > 0) {
            stat = result[0]
        }
        res.status(200).json(stat)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

exports.getReseller = (req, res) => {
    const shopId = mongoose.Types.ObjectId(req.user.shopId)
    const search = req.query.search
    const currentPage = req.query.page || 1
    const perPage = req.query.perPage || 20
    const filter = req.query.filter
    let query = {};
    if(filter) {
        if(filter == 'true') {
            query = {status: true}
        } else {
            query = {status: false}
        }
    }
    let totalItems;
    ResellerModel.aggregate([
        {$match: {$and: [{shopId: shopId}, query]}},
        {$lookup: {
            from: 'sellers',
            localField: 'sellerId',
            foreignField: '_id',
            as: 'seller'
        }},
        {$unwind: '$seller'},
        {$addFields: {
            seller: '$seller.name'
        }},
        {$match: {seller: {$regex: '.*'+search+'.*', $options: 'i'}}},
        {$count: 'count'}
    ])
    .then(result => {
        if(result.length > 0) {
            totalItems = result[0].count
        } else {
            totalItems = 0
        }
        return ResellerModel.aggregate([
            {$match: {$and: [{shopId: shopId}, query]}},
            {$lookup: {
                from: 'sellers',
                localField: 'sellerId',
                foreignField: '_id',
                as: 'seller'
            }},
            {$unwind: '$seller'},
            {$addFields: {
                seller: '$seller.name',
                totalQty: {$sum: '$items.qty'}
            }},
            {$match: {seller: {$regex: '.*'+search+'.*', $options: 'i'}}},
            {$sort: {createdAt: -1}},
            {$skip: (currentPage -1) * perPage},
            {$limit: perPage},
        ])
    })
    .then (result => {
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

exports.inserReseller = async (req, res) => {
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
    let reseller = await ResellerModel.findOne({createdAt: {$gte: today}}).sort({createdAt: -1})
    let resellerNo;
    if(reseller) {
        const no = reseller.resellerNo.substring(16)
        const newNo = parseInt(no) + 1
        resellerNo = `${dd}${mm}/ZHR/INV/${yy}/${newNo}`
    } else {
        resellerNo = `${dd}${mm}/ZHR/INV/${yy}/1`
    }
    reseller = new ResellerModel({
        resellerNo: resellerNo,
        shopId: shopId,
        sellerId: req.body.sellerId,
        items: req.body.items,
        grandTotal: req.body.grandTotal,
        sisa: req.body.grandTotal
    })
    reseller.save()
    .then(async (result) => {
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
            await stockCard('out', shopId, item.productId, documentId, 'Reseller', item.qty, balance.stock)
        }
        res.status(200).json(result)
    })
    .catch(err => [
        res.status(400).send(err)
    ])
}

exports.updateReseller = (req, res) => {
    const shopId = req.user.shopId
    const resellerId = req.body._id
    ResellerModel.findById(resellerId)
    .then(async (result) => {
        const sisa = req.body.grandTotal - result.bayar
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
            await stockCard('in', shopId, item.productId, documentId, 'Reseller edit', item.qty, balance.stock)
        }
        result.items = req.body.items
        result.grandTotal = req.body.grandTotal
        result.sisa = sisa
        return result.save()
    })
    .then (async (result) => {
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
            await stockCard('out', shopId, item.productId, documentId, 'Reseller', item.qty, balance.stock)
        }
        res.status(200).json(result)
    })
}

exports.getSeller = (req, res) => {
    const search = req.query.search
    SellerModel.find({name: {$regex: '.*'+search+'.*', $options: 'i'}})
    .limit(5)
    .then(result => {
        res.status(200).json(result)
    })
}

exports.bayarReseller = async (req, res) => {
    try {
        const resellerId = req.params.resellerId
        const paymentMethod = req.body.paymentMethod
        const bankId = req.body.bankId || null
        const bayar = Number(req.body.bayar || 0)
        const cash = Number(req.body.cash || 0)

        const allowedPaymentMethods = [
            'TUNAI',
            'DEBIT / CREDIT',
            'TRANSFER BANK',
            'MULTI BAYAR'
        ]

        if(!mongoose.Types.ObjectId.isValid(resellerId)) {
            return res.status(400).json({
                message: 'Transaksi Reseller tidak valid'
            })
        }

        if(!allowedPaymentMethods.includes(paymentMethod)) {
            return res.status(400).json({
                message: 'Metode pembayaran tidak valid'
            })
        }

        if(!Number.isFinite(bayar) || bayar <= 0) {
            return res.status(400).json({
                message: 'Jumlah pembayaran harus lebih dari 0'
            })
        }

        const reseller = await ResellerModel.findById(resellerId)

        if(!reseller) {
            return res.status(404).json({
                message: 'Transaksi Reseller tidak ditemukan'
            })
        }

        const currentSisa = Number(reseller.sisa || 0)

        if(reseller.status === true || currentSisa <= 0) {
            return res.status(400).json({
                message: 'Transaksi Reseller sudah lunas'
            })
        }

        if(bayar > currentSisa) {
            return res.status(400).json({
                message: 'Jumlah pembayaran melebihi sisa tagihan'
            })
        }

        const payment = {
            cash: 0,
            debit: 0,
            transfer: 0,
            bankId: null
        }

        if(paymentMethod === 'TUNAI') {
            payment.cash = bayar
        }

        if(paymentMethod === 'DEBIT / CREDIT' || paymentMethod === 'TRANSFER BANK') {
            if(!bankId || !mongoose.Types.ObjectId.isValid(bankId)) {
                return res.status(400).json({
                    message: 'Rekening tujuan harus dipilih'
                })
            }

            const bank = await BankModel.findById(bankId).select('_id').lean()

            if(!bank) {
                return res.status(400).json({
                    message: 'Rekening tujuan tidak ditemukan'
                })
            }

            payment.bankId = bank._id

            if(paymentMethod === 'DEBIT / CREDIT') {
                payment.debit = bayar
            }

            if(paymentMethod === 'TRANSFER BANK') {
                payment.transfer = bayar
            }
        }

        if(paymentMethod === 'MULTI BAYAR') {
            if(!bankId || !mongoose.Types.ObjectId.isValid(bankId)) {
                return res.status(400).json({
                    message: 'Rekening tujuan harus dipilih'
                })
            }

            if(!Number.isFinite(cash) || cash <= 0 || cash >= bayar) {
                return res.status(400).json({
                    message: 'Jumlah pembayaran tunai harus lebih dari 0 dan kurang dari jumlah pembayaran'
                })
            }

            const bank = await BankModel.findById(bankId).select('_id').lean()

            if(!bank) {
                return res.status(400).json({
                    message: 'Rekening tujuan tidak ditemukan'
                })
            }

            payment.cash = cash
            payment.transfer = bayar - cash
            payment.bankId = bank._id
        }

        const sisa = currentSisa - bayar
        const currentBayar = Number(reseller.bayar || 0)

        reseller.payments.push({
            paymentDate: new Date(),
            paymentMethod: paymentMethod,
            bankId: payment.bankId,
            cash: payment.cash,
            debit: payment.debit,
            transfer: payment.transfer,
            amount: bayar,
            sisa: sisa
        })

        reseller.bayar = currentBayar + bayar
        reseller.sisa = sisa
        reseller.status = sisa === 0

        const result = await reseller.save()

        res.status(200).json(result)
    } catch(err) {
        console.error('bayarReseller error:', err)

        res.status(400).json({
            message: err.message || 'Pembayaran Reseller gagal diproses'
        })
    }
}

exports.insertSeller = (req, res) => {
    const userId = req.user._id
    const seller = new SellerModel({
        name: req.body.name,
        userId: userId
    })
    seller.save()
    .then(result => {
        res.status(200).json(result)
    })
}