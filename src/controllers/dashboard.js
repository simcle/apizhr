const SalesModel = require('../models/sales');
const OnlineModel = require('../models/online');
const PengeluaranModel = require('../models/pengeluaran');
const NgolesModel = require('../models/ngoles');
const ResellerModel = require('../models/reseller');
exports.getDashboard = (req, res) => {
    const date = new Date()
    const today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const sevenDay = new Date()
    const day = sevenDay.getDate() - 6
    sevenDay.setDate(day)
    sevenDay.setHours(0, 0, 0, 0)
    const online = OnlineModel.aggregate([
        {$match: {createdAt: {$gte: today}}},
        {$group: {
            _id: null,
            total: {$sum: '$grandTotal'}
        }}
    ])
    const omzet = SalesModel.aggregate([
        {$match: {createdAt: {$gte: today}}},
        {$group: {
            _id: null,
            tunai: {$sum: {$cond: [{$eq: ['$paymentMethod','TUNAI']}, '$grandTotal', 0]}},
            debit: {$sum: {$cond: [{$eq: ['$paymentMethod','DEBIT / CREDIT']}, '$grandTotal', 0]}},
            transfer: {$sum: {$cond: [{$eq: ['$paymentMethod','TRANSFER BANK']}, '$grandTotal', 0]}},
            multi: {$sum: {$cond: [{$eq: ['$paymentMethod','MULTI BAYAR']}, '$grandTotal', 0]}},
            total: {$sum: '$grandTotal'}
        }}
    ])
    const pengeluaran = PengeluaranModel.aggregate([
        {$match: {createdAt: {$gte: today}}},
        {$group: {
            _id: null,
            total: {$sum: '$total'}
        }}
    ])
    const ngoles = NgolesModel.aggregate([
        {$match: {status: 'BELUM BAYAR'}},
        {$group: {
            _id: null,
            total: {$sum: '$grandTotal'}
        }}
    ])
    const reseller = ResellerModel.aggregate([
        {$match: {status: false}},
        {$group: {
            _id: null,
            total: {$sum: '$sisa'}
        }}
    ])
    const ngolesToday = NgolesModel.aggregate([
        {$match: {$and: [{tanggalBayar: {$gte: today}}, {status: 'LUNAS'}]}},
        {$group: {
            _id: null,
            total: {$sum: '$grandTotal'}
        }}
    ])
    const resellerToday = ResellerModel.aggregate([
        {$match: {'payments.paymentDate': {$gte: today}}},
        {$unwind: '$payments'},
        {$group: {
            _id: null,
            total: {$sum: {$cond: [{$gte: ['$payments.paymentDate', today]}, '$payments.amount', 0]}},
        }}
    ])
    const stats = SalesModel.aggregate([
        {$match: {createdAt: {$gte: sevenDay}}},
        {$lookup: {
            from: 'shops',
            localField: 'shopId',
            foreignField: '_id',
            as: 'shop'
        }},
        {$unwind: '$shop'},
        {$group: {
            _id: {shopId: '$shopId', tanggal: {$dateToString: {format: "%Y-%m-%d", date: '$createdAt'}}},
            tanggal: {$first: {$dateToString: {format: "%Y-%m-%d", date: '$createdAt'}}},
            total: {$sum: '$grandTotal'},
            shop: {$first: '$shop.name'}
        }},
        {$sort: {'_id.tanggal': 1}},
        {$group: {
            _id: '$_id.shopId',
            shop: {$first: '$shop'},
            total: {$sum: '$total'},
            data: {$push: {tanggal: '$tanggal', total: '$total'}}
        }},
        {$sort: {total: -1}}
    ])
    const onlineStat = OnlineModel.aggregate([
        {$match: {createdAt: {$gte: sevenDay}}},
        {$group: {
            _id: {tanggal: {$dateToString: {format: "%Y-%m-%d", date: '$createdAt'}}},
            tanggal: {$first: {$dateToString: {format: "%Y-%m-%d", date: '$createdAt'}}},
            total: {$sum: '$grandTotal'}
        }},
        {$sort: {'_id.tanggal': 1}},
        {$group: {
            _id: null,
            data: {$push: {tanggal: '$tanggal', total: '$total'}},
            total: {$sum: '$total'}
        }},
        {$project: {
            _id: '6475d52daa375fa751092f5d',
            total: 1,
            data: 1,
            shop: 'ONLINE'
        }}
    ])
    Promise.all([
        online,
        omzet,
        pengeluaran,
        ngoles,
        reseller,
        ngolesToday,
        resellerToday,
        stats,
        onlineStat
    ])
    .then(result => {
        const stat = result[7]
        const onlineStat = result[8]
        const stats = stat.concat(onlineStat)
        stats.sort((a, b) => b.total - a.total)
        res.status(200).json({
            onlineOmzet: result[0][0],
            omzet: result[1][0],
            pengeluaran: result[2][0],
            ngoles: result[3][0],
            reseller: result[4][0],
            ngolesToday: result[5][0],
            resellerToday: result[6][0],
            stats: stats,
            onlineStat: result[8]
        })
    })
}