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
const BankModel = require('../models/banks');

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
            {$sort: {createdAt: -1}},
            {$skip: (currentPage-1) * perPage},
            {$limit: perPage},
            {$lookup: {
                from: 'mitras',
                localField: 'mitraId',
                foreignField: '_id',
                as: 'mitra'
            }},
            {$unwind: '$mitra'},
            {$addFields: {
                mitra: '$mitra.name'
            }}
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
    try {
        const userId = req.user._id
        const shopId = req.user.shopId
        const mitraId = req.body.mitraId
        const paymentMethod = req.body.paymentMethod
        const bankId = req.body.bankId || null
        const cash = Number(req.body.cash || 0)

        const allowedPaymentMethods = [
            'TUNAI',
            'DEBIT / CREDIT',
            'TRANSFER BANK',
            'MULTI BAYAR'
        ]

        if(!mongoose.Types.ObjectId.isValid(mitraId)) {
            return res.status(400).json({
                message: 'Mitra tidak valid'
            })
        }

        if(!allowedPaymentMethods.includes(paymentMethod)) {
            return res.status(400).json({
                message: 'Metode pembayaran tidak valid'
            })
        }

        const mitra = await MitraModel.findById(mitraId).select('_id').lean()

        if(!mitra) {
            return res.status(404).json({
                message: 'Mitra tidak ditemukan'
            })
        }

        const sales = await MitraSalesModel.find({
            mitraId: mitraId,
            status: 'BELUM BAYAR'
        }).lean()

        if(!sales.length) {
            return res.status(400).json({
                message: 'Tidak ada tagihan Mitra yang belum dibayar'
            })
        }

        const grandTotal = sales.reduce((sum, item) => {
            return sum + Number(item.unitPrice * item.qty || 0)
        }, 0)

        if(!Number.isFinite(grandTotal) || grandTotal <= 0) {
            return res.status(400).json({
                message: 'Total tagihan Mitra tidak valid'
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

        const date = new Date()
        let dd = date.getDate()
        let mm = date.getMonth() + 1
        let yy = date.getFullYear().toString().substring(2)

        dd = checkTime(dd)
        mm = checkTime(mm)

        function checkTime(i) {
            if(i < 10) {
                i = `0${i}`
            }

            return i
        }

        const today = new Date(date.getFullYear(), date.getMonth(), date.getDate())

        const lastPayment = await MitraPaymentModel.findOne({
            createdAt: {$gte: today}
        }).sort({createdAt: -1})

        let paymentNo

        if(lastPayment) {
            const no = lastPayment.paymentNo.substring(16)
            const newNo = parseInt(no) + 1
            paymentNo = `${dd}${mm}/MTR/BYR/${yy}/${newNo}`
        } else {
            paymentNo = `${dd}${mm}/MTR/BYR/${yy}/1`
        }

        const paymentItems = sales.map(item => ({
            productId: item.productId,
            sku: item.sku,
            name: item.name,
            unitPrice: item.unitPrice,
            qty: item.qty,
            total: item.total
        }))

        const mitraPayment = new MitraPaymentModel({
            paymentNo: paymentNo,
            mitraId: mitraId,
            items: paymentItems,
            grandTotal: grandTotal,
            paymentMethod: paymentMethod,
            bankId: payment.bankId,
            cash: payment.cash,
            debit: payment.debit,
            transfer: payment.transfer,
            userId: userId
        })

        await mitraPayment.save()

        const salesIds = sales.map(item => item._id)

        const updateResult = await MitraSalesModel.updateMany(
            {
                _id: {$in: salesIds},
                mitraId: mitraId,
                status: 'BELUM BAYAR'
            },
            {
                $set: {
                    status: 'LUNAS'
                }
            }
        )

        const modifiedCount = updateResult.modifiedCount !== undefined
            ? updateResult.modifiedCount
            : updateResult.nModified

        if(modifiedCount !== salesIds.length) {
            await MitraPaymentModel.deleteOne({_id: mitraPayment._id})

            return res.status(409).json({
                message: 'Sebagian tagihan Mitra sudah berubah. Silakan ulangi pembayaran'
            })
        }

        const mitraHistory = new MitraHistoryModel({
            documentNo: paymentNo,
            type: 'Bayar',
            mitraId: mitraId,
            shopId: shopId,
            items: paymentItems,
            grandTotal: grandTotal,
            userId: userId
        })

        await mitraHistory.save()

        res.status(200).json(mitraPayment)
    } catch(err) {
        console.error('mitraPayment error:', err)

        res.status(400).json({
            message: err.message || 'Pembayaran Mitra gagal diproses'
        })
    }
}