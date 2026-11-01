const mongoose = require('mongoose');
const PedagangModel = require('../models/pedagang');
const NgolesModel = require('../models/ngoles');
const InventoryModel = require('../models/inventory');
const updateStock = require('../modules/updateStock');
const stockCard = require('../modules/stockCard');
const BankModel = require('../models/banks');

exports.statNgoles = (req, res) => {
    const shopId = mongoose.Types.ObjectId(req.user.shopId)
    const date = new Date();
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    NgolesModel.aggregate([
        {$match: {shopId: shopId}},
        {$group: {
            _id: null,
            belumBayar: {$sum: {$cond: [{$eq: ['$status','BELUM BAYAR']}, '$grandTotal', 0]}},
            bayarHariIni : {$sum: {$cond: [{$and: [{$eq: ['$status', 'LUNAS']}, {$gte: ['$tanggalBayar', today]}]}, '$grandTotal', 0]}},
            count: {$sum: {$cond: [{$gte: ['$createdAt', today]}, 1, 0]}}
        }}
    ])
    .then(result => {
        let stat = {}
        if(result.length > 0) {
            stat = result[0]
        }
        res.status(200).json(stat)
    })
},
exports.getNgoles = (req, res) => {
    const shopId = mongoose.Types.ObjectId(req.user.shopId)
    const search = req.query.search
    const currentPage = req.query.page || 1
    const perPage = req.query.perPage || 20
    const filter = req.query.filter
    let query = {};
    if(filter) {
        query = {status: {$in: filter}}
    }
    let totalItems;
    NgolesModel.aggregate([
        {$match: {$and: [{shopId: shopId}, query]}},
        {$lookup: {
            from: 'pedagangs',
            localField: 'pedagangId',
            foreignField: '_id',
            as: 'pedagang'
        }},
        {$unwind: '$pedagang'},
        {$addFields: {
            pedagang: '$pedagang.name'
        }},
        {$match: {pedagang: {$regex: '.*'+search+'.*', $options: 'i'}}},
        {$count: 'count'}
    ])
    .then(result => {
        if(result.length > 0) {
            totalItems = result[0].count
        } else {
            totalItems = 0
        }
        return NgolesModel.aggregate([
            {$match: {$and: [{shopId: shopId}, query]}},
            {$lookup: {
                from: 'pedagangs',
                localField: 'pedagangId',
                foreignField: '_id',
                as: 'pedagang'
            }},
            {$unwind: '$pedagang'},
            {$addFields: {
                pedagang: '$pedagang.name',
                totalQty: {$sum: '$items.qty'}
            }},
            {$match: {pedagang: {$regex: '.*'+search+'.*', $options: 'i'}}},
            {$sort: {status: 1, tanggalBayar: -1, createdAt: -1}},
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

exports.getDetailNgoles = (req , res) => {
    const ngolesId = mongoose.Types.ObjectId(req.params.ngolesId)
    NgolesModel.aggregate([
        {$match: {_id: ngolesId}},
        {$lookup: {
            from: 'pedagangs',
            localField: 'pedagangId',
            foreignField: '_id',
            as: 'pedagang'
        }},
        {$unwind: '$pedagang'},
        {$addFields: {
            pedagang: '$pedagang.name'
        }}
    ])
    .then(result => {
        res.status(200).json(result[0])
    })
}

exports.insertNgoles = async (req, res) => {
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
    let ngoles = await NgolesModel.findOne({createdAt: {$gte: today}}).sort({createdAt: -1})
    let ngolesNo;
    if(ngoles) {
        const no = ngoles.ngolesNo.substring(19)
        const newNo = parseInt(no) + 1
        ngolesNo = `${dd}${mm}/ZHR/NGOLES/${yy}/${newNo}`
    } else {
        ngolesNo = `${dd}${mm}/ZHR/NGOLES/${yy}/1`
    }   
    ngoles = new NgolesModel({
        ngolesNo: ngolesNo,
        shopId: shopId,
        pedagangId: req.body.pedagangId,
        items: req.body.items,
        grandTotal: req.body.grandTotal,
        userId: userId
    })
    ngoles.save()
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
            await stockCard('out', shopId, item.productId, documentId, 'Ngoles', item.qty, balance.stock)
        }
        res.status(200).json(result)
    })
    .catch(err => {
        res.status(400).send(err)
    })

}

exports.updateQty = (req, res) => {
    const ngolesId = req.body._id
    const shopId = req.user.shopId
    NgolesModel.findById(ngolesId)
    .then(async (result )=> {
        let documentId = result._id
        const items = result.items
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const inventory = await InventoryModel.findOne({$and: [{shopId: shopId}, {productId: item.productId}]})
            if(inventory) {
                inventory.qty = inventory.qty + item.qty
                await inventory.save()
            }
            const balance = await updateStock(item.productId)
            await stockCard('in', shopId, item.productId, documentId, 'Ngoles edit qty', item.qty, balance.stock)
        }
        result.items = req.body.items
        result.grandTotal = req.body.grandTotal
        return result.save()
    })
    .then(async (result) => {
        let documentId = result._id
        const items = result.items
        for(let i = 0; i < items.length; i ++) {
            const item = items[i]
            const inventory = await InventoryModel.findOne({$and: [{shopId: shopId}, {productId: item.productId}]})
            if(inventory) {
                inventory.qty = inventory.qty - item.qty
                await inventory.save()
            }
            const balance = await updateStock(item.productId)
            await stockCard('out', shopId, item.productId, documentId, 'Ngoles edit qty', item.qty, balance.stock)
        }
        res.status(200).json(result)        
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

exports.bayarNgoles = async (req, res) => {
    try {
        const ngolesId = req.body._id
        const penerima = req.body.penerima
        const paymentMethod = req.body.paymentMethod
        const bankId = req.body.bankId || null
        const cash = Number(req.body.cash || 0)

        const allowedPaymentMethods = [
            'TUNAI',
            'DEBIT / CREDIT',
            'TRANSFER BANK',
            'MULTI BAYAR'
        ]

        if(!mongoose.Types.ObjectId.isValid(ngolesId)) {
            return res.status(400).json({
                message: 'ID Ngoles tidak valid'
            })
        }

        if(!penerima || !penerima.trim()) {
            return res.status(400).json({
                message: 'Nama penerima pembayaran harus diisi'
            })
        }

        if(!allowedPaymentMethods.includes(paymentMethod)) {
            return res.status(400).json({
                message: 'Metode pembayaran tidak valid'
            })
        }

        const ngoles = await NgolesModel.findById(ngolesId)

        if(!ngoles) {
            return res.status(404).json({
                message: 'Transaksi Ngoles tidak ditemukan'
            })
        }

        if(ngoles.status !== 'BELUM BAYAR') {
            return res.status(400).json({
                message: 'Transaksi Ngoles sudah dibayar atau dibatalkan'
            })
        }

        const grandTotal = Number(ngoles.grandTotal || 0)

        if(!Number.isFinite(grandTotal) || grandTotal <= 0) {
            return res.status(400).json({
                message: 'Total tagihan Ngoles tidak valid'
            })
        }

        let payment = {
            cash: 0,
            debit: 0,
            transfer: 0,
            bankId: null
        }

        if(paymentMethod === 'TUNAI') {
            payment.cash = grandTotal
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
                payment.debit = grandTotal
            }

            if(paymentMethod === 'TRANSFER BANK') {
                payment.transfer = grandTotal
            }
        }

        if(paymentMethod === 'MULTI BAYAR') {
            if(!bankId || !mongoose.Types.ObjectId.isValid(bankId)) {
                return res.status(400).json({
                    message: 'Rekening tujuan harus dipilih'
                })
            }

            if(!Number.isFinite(cash) || cash <= 0 || cash >= grandTotal) {
                return res.status(400).json({
                    message: 'Jumlah pembayaran tunai harus lebih dari 0 dan kurang dari total tagihan'
                })
            }

            const bank = await BankModel.findById(bankId).select('_id').lean()

            if(!bank) {
                return res.status(400).json({
                    message: 'Rekening tujuan tidak ditemukan'
                })
            }

            payment.cash = cash
            payment.transfer = grandTotal - cash
            payment.bankId = bank._id
        }

        const result = await NgolesModel.findOneAndUpdate(
            {
                _id: ngoles._id,
                status: 'BELUM BAYAR'
            },
            {
                $set: {
                    status: 'LUNAS',
                    tanggalBayar: new Date(),
                    penerima: penerima.trim(),
                    paymentMethod,
                    bankId: payment.bankId,
                    cash: payment.cash,
                    debit: payment.debit,
                    transfer: payment.transfer
                }
            },
            {
                new: true
            }
        )

        if(!result) {
            return res.status(409).json({
                message: 'Transaksi Ngoles sudah diproses'
            })
        }

        res.status(200).json(result)
    } catch(err) {
        console.error('bayarNgoles error:', err)

        res.status(400).json({
            message: err.message || 'Pembayaran Ngoles gagal diproses'
        })
    }
}

exports.cancelNgoles = (req, res) => {
    const ngolesId = req.params.ngolesId
    const shopId = req.user.shopId
    NgolesModel.findById(ngolesId)
    .then(async (result) => {
        let documentId = result._id
        const items = result.items
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const inventory = await InventoryModel.findOne({$and: [{shopId: shopId}, {productId: item.productId}]})
            if(inventory) {
                inventory.qty = inventory.qty + item.qty
                await inventory.save()
            }
            const balance = await updateStock(item.productId)
            await stockCard('in', shopId, item.productId, documentId, 'Ngoles canceled', item.qty, balance.stock)
        }
        result.status = 'BATAL'
        return result.save()
    })
    .then(result => {
        res.status(200).json(result)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

exports.getPedagang = (req, res) => {
    const search = req.query.search
    PedagangModel.find({name: {$regex: '.*'+search+'.*', $options: 'i'}})
    .limit(5)
    .then(result => {
        res.status(200).json(result)
    })
}

exports.insertPedagang = (req, res) => {
    const pedagang = new PedagangModel({
        name: req.body.name,
        userId: req.user._id
    })
    pedagang.save()
    .then(result => {
        res.status(200).json(result)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}