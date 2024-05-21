const SetorModel = require('../models/setor');
const SalesModel = require('../models/sales');
const PengeluaranModel = require('../models/pengeluaran');
const mongoose = require('mongoose')
exports.getSetor = (req, res) => {
    const date = new Date()
    const today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const totalTunai = SalesModel.aggregate([
        {$match: {$and: [{createdAt: {$gte: today}}, {paymentMethod: 'TUNAI'}]}},
        {$group: {
            _id: null,
            total: {$sum: '$grandTotal'}
        }}
    ])

    const totalPengeluaran = PengeluaranModel.aggregate([
        {$match: {createdAt: {$gte: today}}},
        {$group: {
            _id: null,
            total: {$sum: '$total'}
        }}
    ])
    const totalSetor = SetorModel.aggregate([
        {$match: {createdAt: {$gte: today}}},
    ])
    Promise.all([
        totalTunai,
        totalPengeluaran,
        totalSetor
    ])
    .then(result => {
        const totalTunai = result[0][0]
        const totalPengeluaran = result[1][0]
        const totalSetor = result [2]
        const data = {
            totalTunai: 0,
            totalPengeluaran: 0,
            totalSetor: []
        }
        if(totalTunai) {
            data.totalTunai = totalTunai.total
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
        {$match: {$and: [{createdAt: {$gte: today}}, {paymentMethod: 'TUNAI'}]}},
        {$group: {
            _id: '$shopId',
            total: {$sum: '$grandTotal'}
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
    const pengeluaran = PengeluaranModel.aggregate([
        {$match: {createdAt: {$gte: today}}},
    ])
    Promise.all([
        shops,
        pengeluaran
    ])
    .then(result => {
        const data = {
            shops: result[0],
            pengeluaran: result[1]
        }
        res.status(200).json(data)
    })
}