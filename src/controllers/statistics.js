const SalesModel = require('../models/sales')
const OnlineModel = require('../models/online')
const NgolesModel = require('../models/ngoles')
const ResellerModel = require('../models/reseller');
const PengeluaranModel = require('../models/pengeluaran');
const ReceiptsModel = require('../models/receipts');
const ProductModel = require('../models/products');

exports.getStats = (req, res)=> {
    const date = new Date()
    const tahun= date.getFullYear()
    const sales = SalesModel.aggregate([
        {$project: {
            tahun: {$year: '$createdAt'},
            bulan: {$month: '$createdAt'},
            createdAt: 1,
            grandTotal: 1
        }},
        {$match: {'tahun': tahun}},
        {$group: {
            _id: {$dateToString: {format: "%Y-%m", date: '$createdAt'}},
            bulan: {$first: '$bulan'},
            tahun: {$first: '$tahun'},
            total: {$sum: '$grandTotal'},
        }},
        {$sort: {_id: 1}}
    ])
    const online =  OnlineModel.aggregate([
        {$project: {
            tahun: {$year: '$createdAt'},
            createdAt: 1,
            grandTotal: 1
        }},
        {$match: {'tahun': tahun}},
        {$group: {
            _id: {$dateToString: {format: "%Y-%m", date: '$createdAt'}},
            tahun: {$first: '$tahun'},
            total: {$sum: '$grandTotal'},
        }},
        {$sort: {_id: 1}}
    ])
    const ngoles = NgolesModel.aggregate([
        {$project: {
            tahun: {$year: '$createdAt'},
            createdAt: 1,
            grandTotal: 1,
            status: 1
        }},
        {$match: {$and:[{'tahun': tahun}, {'status': 'LUNAS'}]}},
        {$group: {
            _id: {$dateToString: {format: "%Y-%m", date: '$createdAt'}},
            tahun: {$first: '$tahun'},
            total: {$sum: '$grandTotal'},
        }},
        {$sort: {_id: 1}}
    ])
    const reseller = ResellerModel.aggregate([
        {$project: {
            tahun: {$year: '$updatedAt'},
            updatedAt: 1,
            grandTotal: 1,
            bayar: 1
        }},
        {$match: {'tahun': tahun}},
        {$group: {
            _id: {$dateToString: {format: "%Y-%m", date: '$updatedAt'}},
            tahun: {$first: '$tahun'},
            total: {$sum: '$bayar'},
        }},
        {$sort: {_id: 1}}
    ])
    const pengeluaran = PengeluaranModel.aggregate([
        {$project: {
            tahun: {$year: '$createdAt'},
            bulan: {$month: '$createdAt'},
            createdAt: 1,
            total: 1
        }},
        {$match: {'tahun': tahun}},
        {$group: {
            _id: {$dateToString: {format: "%Y-%m", date: '$createdAt'}},
            bulan: {$first: '$bulan'},
            tahun: {$first: '$tahun'},
            total: {$sum: '$total'},
        }},
        {$sort: {_id: 1}}
    ])
    const barangaMasuk = ReceiptsModel.aggregate([
        {$unwind: '$items'},
        {$addFields: {
            qty: '$items.qty'
        }},
        {$project: {
            tahun: {$year: '$createdAt'},
            bulan: {$month: '$createdAt'},
            createdAt: 1,
            qty: 1
        }},
        {$group: {
            _id: {$dateToString: {format: "%Y-%m", date: '$createdAt'}},
            bulan: {$first: '$bulan'},
            tahun: {$first: '$tahun'},
            total: {$sum: '$qty'},
        }},
        {$sort: {_id: 1}}
    ])
    Promise.all([
        sales,
        online,
        ngoles,
        reseller,
        pengeluaran,
        barangaMasuk
    ])
    .then(result => {
        const sales = result[0]
        const online = result[1]
        const ngoles = result[2]
        const reseller = result[3]
        const pengeluaran = result[4]
        const barangaMasuk = result[5]
        const pendapatan = []
        for (let i = 0; i < sales.length; i++) {
            const sale = sales[i]
            pendapatan.push(sale)
            for(let a = 0; a < online.length; a ++) {
                const ol = online[a]
                if(ol._id == sale._id) {
                    pendapatan[i].total = pendapatan[i].total + ol.total
                }
            }
            for (let b = 0; b < ngoles.length; b++) {
                const ng = ngoles[b]
                if(ng._id == sale._id) {
                    pendapatan[i].total = pendapatan[i].total + ng.total
                }
            }
            for(let c = 0; c < reseller.length; c++) {
                const rs = reseller[c]
                if(rs._id == sale._id) {
                    pendapatan[i].total = pendapatan[i].total + rs.total
                }
            }
        }
        const data = []
        const month = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
        for (let i = 0; i < month.length; i ++) {
            const a = i +1
            data.push({bulan: month[i], pendapatan: 0, pengeluaran: 0, barangMasuk: 0})
            for(let p = 0; p < pendapatan.length; p++) {
                const pnd = pendapatan[p]
                if(pnd.bulan == a) {
                    data[i].pendapatan = pnd.total
                }
            }
            for(let c = 0; c < pengeluaran.length; c++) {
                const pnl = pengeluaran[c]
                if(pnl.bulan == a) {
                    data[i].pengeluaran = pnl.total
                }
            }
            for(let m = 0; m < barangaMasuk.length; m++) {
                const bm = barangaMasuk[m]
                if(bm.bulan == a) {
                    data[i].barangMasuk = bm.total
                }
            }
        }
        let total = 0
        let bulan = pendapatan.length  
        let avg 
        for (let i = 0; i < pendapatan.length; i++) {
            total+= pendapatan[i].total
        }
        avg = total / bulan
        avg = Math.ceil(avg)
        res.status(200).json({
            data: data,
            avg: avg
        })
    })
}

exports.getStatItems = (req, res) => {
    const filter = req.query.filter
    let day;
    let query = {}
    const date = new Date();
    if(filter == '1D') {
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '7D') {
        day = date.getDate() - 6
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '30D') {
        day = date.getDate() - 29
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '90D') {
        day = date.getDate() - 89
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '1Y') {
        day = date.getDate() - 359
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    query = {'createdAt': {$gte: date}}
    SalesModel.aggregate([
        {$match: query},
        {$unwind: '$items'},
        {$addFields: {
            productId: '$items.productId',
            sku: '$items.sku',
            name: '$items.name',
            qty: '$items.qty',
        }},
        {$group: {
            _id: '$productId',
            sku: {$first: '$sku'},
            name: {$first: '$name'},
            sold: {$sum: '$qty'},
        }},
        {$sort: {sold: -1}},
        {$limit: 50},
        {$lookup: {
            from: 'receipts',
            let: {'productId': '$_id'},
            pipeline: [
                {$match: {
                    $expr: {
                        $gte: ['$createdAt', date]
                    }
                }},
                {$unwind: '$items'},
                {$project: {
                    items: 1
                }},
                {$group: {
                    _id: '$items.productId',
                    qty: {$sum: '$items.qty'}
                }},
                {$match: {
                    $expr: {
                        $eq: ['$$productId', '$_id'],
                    }
                }},
            ],
            as: 'receipt'
        }},
        {$unwind: '$receipt'},
        {$addFields: {
            receipt: '$receipt.qty'
        }},
        {$lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'stock'
        }},
        {$unwind: '$stock'},
        {$addFields: {
            stock: '$stock.stock'
        }}
    ])
    .then(result => {
        return res.status(200).json(result)
    })

}

exports.detailItems = (req, res) => {
    const sku = req.query.sku
    const filter = req.query.filter
    let day;
    let query = {}
    const date = new Date();
    if(filter == '1D') {
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '7D') {
        day = date.getDate() - 6
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '30D') {
        day = date.getDate() - 29
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '90D') {
        day = date.getDate() - 89
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    if(filter == '1Y') {
        day = date.getDate() - 359
        date.setDate(day)
        date.setHours(0, 0, 0, 0)
    }
    query = {$and: [{'createdAt': {$gte: date}},{'items.sku': sku}]}
    const sales = SalesModel.aggregate([
        {$unwind: '$items'},
        {$match: query},
        {$group: {
            _id: '$shopId',
            sku: {$first : '$items.sku'},
            price: {$avg: '$items.price'},
            qty: {$sum: '$items.qty'},
            omzet: {$sum: '$items.subTotal'},
            transaki: {$sum: 1}
        }},
        {$lookup: {
            from: 'shops',
            foreignField: '_id',
            localField: '_id',
            as: 'outlet'
        }},
        {$unwind: '$outlet'},
        {$addFields: {
            outlet: '$outlet.name'
        }},
        {$sort: {qty: -1}}
    ])
    const online = OnlineModel.aggregate([
        {$unwind: '$items'},
        {$match: query},
        {$lookup: {
            from: 'customers',
            foreignField: '_id',
            localField: 'customerId',
            as: 'marketId'
        }},
        {$unwind: '$marketId'},
        {$addFields: {
            marketId: '$marketId.marketplaceId'
        }},
        {$lookup: {
            from: 'marketplaces',
            foreignField: '_id',
            localField: 'marketId',
            as: 'marketplace'
        }},
        {$unwind: '$marketplace'},
        {$addFields: {
            marketplace: '$marketplace.name'
        }},
        {$group: {
            _id: '$marketId',
            marketplace: {$first: '$marketplace'},
            sku: {$first : '$items.sku'},
            price: {$avg: '$items.price'},
            qty: {$sum: '$items.qty'},
            omzet: {$sum: '$items.subTotal'},
            transaki: {$sum: 1}
        }},
        {$sort: {qty: -1}}
    ])
    const receipts = ReceiptsModel.aggregate([
        {$unwind: '$items'},
        {$match: query},
        {$group: {
            _id: '$items.productId',
            qty: {$sum: '$items.qty'}
        }}
    ])
    Promise.all([
        sales,
        online,
        receipts
    ])
    .then(result => {
        const sales = result[0]
        const online = result[1]
        const receipts = result[2]
        res.status(200).json({
            // sales: sales,
            // online: online,
            // receipts: receipts
        })
    })
}