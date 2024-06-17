const SetorModel = require('../models/setor');
const SalesModel = require('../models/sales');
const PengeluaranModel = require('../models/pengeluaran');
const MitraPaymentModel = require('../models/mitraPayment');
const mongoose = require('mongoose')
exports.getSetor = (req, res) => {
    const date = new Date()
    const today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const totalTunai = SalesModel.aggregate([
        {$match: {$and: [{createdAt: {$gte: today}}, {paymentMethod: 'TUNAI'}, {paymentMethod: 'MULTI BAYAR'}]}},
        {$group: {
            _id: null,
            total: {$sum: '$cash'}
        }}
    ])
    const shopId = new mongoose.Types.ObjectId('647aa84733581aaca9c7725b')
    const totalPengeluaran = PengeluaranModel.aggregate([
        {$match: {$and: [{createdAt: {$gte: today}}, {shopId: {$ne: shopId}}]}},
        {$group: {
            _id: null,
            total: {$sum: '$total'}
        }}
    ])
    const totalSetor = SetorModel.aggregate([
        {$match: {createdAt: {$gte: today}}},
    ])
    const mitra = MitraPaymentModel.aggregate([
        {$match: {createdAt: {$gte: today}}},
        {$unwind: '$items'},
        {$group: {
            _id: null,
            total: {$sum: '$items.total'}
        }},
    ])
    Promise.all([
        totalTunai,
        totalPengeluaran,
        totalSetor,
        mitra
    ])
    .then(result => {
        const totalTunai = result[0][0]
        const totalPengeluaran = result[1][0]
        const totalSetor = result [2]
        const totalMitra = result[3][0]
        const data = {
            totalTunai: 0,
            totalMitra: 0,
            totalPengeluaran: 0,
            totalSetor: []
        }
        if(totalTunai) {
            data.totalTunai = totalTunai.total
        }
        if(totalMitra) {
            data.totalMitra = totalMitra.total
        }
        if(totalPengeluaran) {
            data.totalPengeluaran = totalPengeluaran.total
        }
        if(totalSetor) {
            data.totalSetor = totalSetor
        }
        res.status(200).json(data)
    })
}

exports.postSetor = (req, res) => {
    const setor = new SetorModel({
        setor: req.body.setor,
        penerima: req.body.penerima
    })
    setor.save()
    .then(() => {
        res.status(200).json('OK')
    })
}

exports.deleteSetor = async (req, res) => {
    const id = req.params.id
    await SetorModel.deleteOne({_id: id})
    res.status(200).json('OK')
}

exports.getLaporan = (req, res) => {
    const date = new Date()
    const today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const shops = SalesModel.aggregate([
        {$match: {$and: [{createdAt: {$gte: today}}, {paymentMethod: 'TUNAI'}, {paymentMethod: 'MULTI BAYAR'}]}},
        {$group: {
            _id: '$shopId',
            total: {$sum: '$cash'}
        }},
        {$sort: {total: -1}},
        {$lookup: {
            from: 'shops',
            localField: '_id',
            foreignField: '_id',
            as: 'shop'
        }},
        {$unwind: '$shop'},
        {$addFields: {
            shop: '$shop.name'
        }}
    ])
    const shopId = new mongoose.Types.ObjectId('647aa84733581aaca9c7725b')
    const pengeluaran = PengeluaranModel.aggregate([
        {$match: {$and: [{createdAt: {$gte: today}}, {shopId: {$ne: shopId}}]}},
    ])
    const mitra = MitraPaymentModel.aggregate([
        {$match: {createdAt: {$gte: today}}},
        {$unwind: '$items'},
        {$group: {
            _id: '$mitraId',
            total: {$sum: '$items.total'}
        }},
        {$lookup: {
            from: 'mitras',
            foreignField: '_id',
            localField: '_id',
            as: 'mitra'
        }},
        {$unwind: '$mitra'},
        {$addFields: {
            mitra: '$mitra.name'
        }}
    ])
    Promise.all([
        shops,
        pengeluaran,
        mitra
    ])
    .then(result => {
        const data = {
            shops: result[0],
            pengeluaran: result[1],
            mitras: result[2]
        }
        res.status(200).json(data)
    })
}