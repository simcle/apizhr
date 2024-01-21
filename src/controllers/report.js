const salesModel = require('../models/sales');
const OnlineModel = require('../models/online');
const MitraPaymentModel = require('../models/mitraPayment');

const mongoose = require('mongoose');
const moment = require('moment')
exports.getDashboard = (req, res) => {
    const start = moment(req.query.start).set('hour', 0).set('minute', 0).set('second', 0).toDate()
    const end = moment(req.query.end).set('hour', 23).set('minute', 59).set('second', 59).toDate()
    const offlne = salesModel.aggregate([
        {$match: {createdAt: {$gte: start, $lte: end}}},
        {$group: {
            _id: '$shopId',
            total: {$sum: '$grandTotal'}
        }},
        {$lookup: {
            from: 'shops',
            foreignField: '_id',
            localField: '_id',
            as: 'shop'
        }},
        {$unwind: '$shop'},
        {$addFields: {
            shop: '$shop.name'
        }},
        {$sort: {total: -1}}
    ])

    const online = OnlineModel.aggregate([
        {$match: {createdAt: {$gte: start, $lte: end}}},
        {$group: {
            _id: '$userId',
            total: {$sum: '$grandTotal'}
        }},
        {$lookup: {
            from: 'users',
            foreignField: '_id',
            localField: '_id',
            as: 'user'
        }},
        {$unwind: '$user'},
        {$addFields: {
            user: '$user.name'
        }},
        {$sort: {total: -1}}
    ])
    const mitra = MitraPaymentModel.aggregate([
        {$match: {createdAt: {$gte: start, $lte: end}}},
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
        offlne,
        online,
        mitra
    ])
    .then(result => {
        const data = {
            offline: result[0],
            online: result[1],
            mitra: result[2]
        }
        res.status(200).json(data)
    })
}

exports.getStatisticsOffline = (req, res) => {
    const shopId = mongoose.Types.ObjectId(req.query.shopId)
    const filter = req.query.filter
    let groupDate, query, start, end;
    if(filter == '7D') {
        start = moment(req.query.start).set('hour', 0).set('minute', 0).set('second', 0).toDate()
        end = moment(req.query.end).set('hour', 23).set('minute', 59).set('second', 59).toDate()
        query = {$and: [{shopId: shopId}, {createdAt: {$gte: start, $lte: end}}]}
        groupDate = {$dateToString: {format: "%Y-%m-%d", date: '$createdAt'}}
        formater = {$dateToString: {format: "%d-%m-%Y", date: '$createdAt'}}
    }
    if(filter == '30D') {
        start = moment().startOf('week').week(+1).isoWeekday(1).toDate()
        query = {$and: [{shopId: shopId}, {createdAt: {$gte: start}}]}
        groupDate = {$isoWeek: {date: '$createdAt', timezone: 'Asia/Jakarta'}}
    }
    if(filter == '90D') {
        start = moment().startOf('month').month(-5).toDate()
        query = {$and: [{shopId: shopId}, {createdAt: {$gte: start}}]}
        groupDate = {$month: '$createdAt'}
    }
    if(filter == '1Y') {
        start = moment().startOf('month').month(-11).toDate()
        query = {$and: [{shopId: shopId}, {createdAt: {$gte: start}}]}
        groupDate = {$month: '$createdAt'}
    }
    salesModel.aggregate([
        {$match: query},
        {$group: {
            _id: groupDate,
            total: {$sum: '$grandTotal'},
            date: {$first: '$createdAt'}
        }},
        {$sort: {date: 1}}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}