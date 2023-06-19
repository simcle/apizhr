const mongoose = require('mongoose');
const SalesModel = require('../models/sales');
const PengeluaranModel = require('../models/pengeluaran')
const NgolesModel = require('../models/ngoles');
const ResellerModel = require('../models/reseller')

exports.getStat = (req, res) => {
    const shopId = mongoose.Types.ObjectId(req.user.shopId)
    const date = new Date()
    const today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const sevenDay = new Date(new Date() - 7 * 60 * 60 * 24 * 1000)
    const omzet = SalesModel.aggregate([
        {$match: {$and: [{createdAt: {$gte: today}}, {shopId: shopId}]}},
        {$group: {
            _id: null,
            tunai: {$sum: {$cond: [{$eq: ['$paymentMethod','TUNAI']}, '$grandTotal', 0]}},
            debit: {$sum: {$cond: [{$eq: ['$paymentMethod','DEBIT / CREDIT']}, '$grandTotal', 0]}},
            transfer: {$sum: {$cond: [{$eq: ['$paymentMethod','TRANSFER BANK']}, '$grandTotal', 0]}},
            multi: {$sum: {$cond: [{$eq: ['$paymentMethod','MULTI BAYAR']}, '$grandTotal', 0]}},
            total: {$sum: '$grandTotal'}
        }}
    ])
    const stats = SalesModel.aggregate([
        {$match: {$and: [{createdAt: {$gte: sevenDay}}, {shopId: shopId}]}},
        {$group: {
            _id: {$dateToString:{format: "%Y-%m-%d", date: "$createdAt"}},
            count: {$sum: 1},
            total: {$sum: '$grandTotal'}
        }},
        {$sort: {_id: 1}}
    ])
    const pengeluaran = PengeluaranModel.aggregate([
        {$match: {$and: [{createdAt: {$gte: today}}, {shopId: shopId}]}},
        {$group: {
            _id: null,
            total: {$sum: '$total'}
        }}
    ])
    const ngoles = NgolesModel.aggregate([
        {$match: {$and: [{tanggalBayar: {$gte: today}}, {shopId: shopId}]}},
        {$group: {
            _id: null,
            total: {$sum: '$grandTotal'}
        }}
    ])
    const reseller = ResellerModel.aggregate([
        {$match: {$and: [{'payments.paymentDate': {$gte: today}}, {shopId: shopId}]}},
        {$unwind: '$payments'},
        {$group: {
            _id: null,
            total: {$sum: {$cond: [{$gte: ['$payments.paymentDate', today]}, '$payments.amount', 0]}},
        }}
    ])
    Promise.all([
        omzet,
        stats,
        pengeluaran,
        ngoles,
        reseller
    ])
    .then(result => {
        const data = {
            omzet: result[0][0],
            stats: result[1],
            pengeluaran: result[2][0],
            ngoles: result[3][0],
            reseller: result[4][0]
        }
        res.status(200).json(data)
    })
}