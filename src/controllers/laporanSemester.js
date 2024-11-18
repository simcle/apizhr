const salesModel = require('../models/sales')
const onlineModel = require('../models/online');
const mitraModel = require('../models/mitraSales');
const attlogModel = require('../models/attlog');
const employeeModel = require('../models/users');
const receiptModel =require('../models/receipts');
const productModel = require('../models/products')
const purchaseModel = require('../models/purchases')
const excel = require('exceljs');
const mongoose = require('mongoose')

const starDate = new Date('2024-10-01')
const endDate = new Date('2024-10-30')

exports.getSalesBySupplier = (req, res) => {
    let day;
    const date = new Date();
    day = date.getDate() - 30
    date.setDate(day)
    date.setHours(0, 0, 0, 0)
    const supplierId = mongoose.Types.ObjectId('64992c314a5ea7413b1e0821')
    receiptModel.aggregate([
        {$match: {$and: [{createdAt: {$gte: date}}, {supplierId: supplierId}]}},
        {$unwind: '$items'},
        {$group: {
            _id: '$items.productId',
            sku: {$first: '$items.sku'},
            name: {$first: '$items.name'},
            qty: {$sum: '$items.qty'}
        }}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}

exports.getCategory = (req, res) => {
    salesModel.aggregate([
        {$match: {createdAt: {$gte: new Date('2024-01-01'), $lt: new Date('2024-07-1')}}},
        {$unwind: '$items'},
        {$unionWith: {coll: 'onlines', pipeline: [{$match: {createdAt: {$gte: new Date('2024-01-01'), $lt: new Date('2024-07-1')}}}, {$unwind: '$items'}]}},
        {$project : {
            createdAt: 1,
            items: 1
        }},
        {$group: {
            _id: {productId: '$items.productId', createdAt: {$dateToString: {date: '$createdAt', format: "%Y-%m"}}},
            count: {$sum: "$items.qty"},
            total: {$sum: '$items.total'}
        }},
        {$lookup: {
            from: 'products',
            localField: '_id.productId',
            foreignField: '_id',
            as: 'products'
        }},
        {$unwind: '$products'},
        {$group: {
            _id: {categoryId: '$products.categoryId', createdAt: '$_id.createdAt'},
            count: {$sum: '$count'},
            total: {$sum: '$total'}
        }},
        {$sort: {count: -1}},
        {$lookup: {
            from: 'categories',
            localField: '_id.categoryId',
            foreignField: '_id',
            as: 'categories'
        }},
        {$unwind: '$categories'},
        {$group: {
            _id: '$_id.createdAt',
            categories: {$push: {total: '$total', count: '$count', category: '$categories.name'}}
        }},
        {$sort: {_id: 1}}
        // {$project: {
        //     _id: 1,
        //     category: '$categories.name',
        //     count: 1,
        //     total: 1
        // }},
    ])
    .then(result => {
        // console.log(result)
        res.status(200).json(result)
    })
}   

exports.getModelPerMonth = (req, res) => {
    salesModel.aggregate([
        {$match: {createdAt: {$gte: new Date('2024-01-01'), $lt: new Date('2024-07-1')}}},
        {$unwind: '$items'},
        {$unionWith: {coll: 'onlines', pipeline: [{$match: {createdAt: {$gte: new Date('2024-01-01'), $lt: new Date('2024-07-1')}}}, {$unwind: '$items'}]}},
        {$project : {
            createdAt: 1,
            items: 1
        }},
        {$group: {
            _id: {productId: '$items.productId', createdAt: {$dateToString: {date: '$createdAt', format: '%Y-%m'}}},
            createdAt: {$first: '$createdAt'},
            count: {$sum: '$items.qty'},
            total: {$sum: '$items.total'}
        }},
        {$lookup: {
            from: 'products',
            localField: '_id.productId',
            foreignField: '_id',
            as: 'products'
        }},
        {$unwind: '$products'},
        {$group: {
            _id: {parentId: '$products.parentId', createdAt: '$_id.createdAt'},
            categoryId: {$first: '$products.categoryId'},
            createdAt: {$first: '$_id.createdAt'},
            count: {$sum: '$count'},
            total: {$sum: '$total'}
        }},
        {$lookup: {
            from: 'products',
            foreignField: '_id',
            localField: '_id.parentId',
            as: 'product'
        }},
        {$unwind: '$product'},
        {$project: {
            parentId: '$product._id',
            name: '$product.name',
            createdAt: 1,
            categoryId: 1,
            count: 1,
            total: 1
        }},
        {$sort: {createdAt: 1, count: -1}},
        {$group: {
            _id: '$categoryId',
            createdAt: {$first: '$_id.createdAt'},
            items: {$push: {createdAt: '$_id.createdAt', parentId: '$parentId', name: '$name', count: '$count', total: '$total'}}
        }},
        {$lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'category'
        }},
        {$unwind: '$category'},
        {$addFields: {
            category: '$category.name',
            categoryId: '$category._id'
        }},
        {$sort: {createdAt: 1}},
        {$unwind: '$items'},
        {$group: {
            _id: {createdAt: '$createdAt', parentId: '$items.parentId'},
            categoryId: {$first: '$categoryId'},
            category: {$first: '$category'},
            createdAt: {$first: '$items.createdAt'},
            items: {$push: '$items'}
        }},
        {$sort: {'cretedAt': 1}},
        {$group: {
            _id: {categoryId: '$categoryId'},
            category: {$first: '$category'},
            items: {$push: {name: {$first: '$items.name'}, items: '$items'}}
        }}
    ])
    .then(async (result) => {
        // res.status(200).json(result)
        const workbook = new excel.Workbook()
        for(let i = 0; i < result.length; i ++) {
            const el = result[i]
            let worksheet = workbook.addWorksheet(el.category)
            worksheet.mergeCells('A1:A2')
            worksheet.mergeCells('B1:C1')
            worksheet.mergeCells('D1:E1')
            worksheet.mergeCells('F1:G1')
            worksheet.mergeCells('H1:I1')
            worksheet.mergeCells('J1:K1')
            worksheet.mergeCells('L1:M1')
            worksheet.getCell('A1').value = 'Model'
            worksheet.getCell('B1').value = 'Januari'
            worksheet.getCell('D1').value = 'Februari'
            worksheet.getCell('F1').value = 'Maret'
            worksheet.getCell('H1').value = 'April'
            worksheet.getCell('J1').value = 'Mei'
            worksheet.getCell('L1').value = 'Juni'
            worksheet.getColumn(1).width = 45
            worksheet.getRow(2).values = ['', 'qty', 'omset', 'qty', 'omset', 'qty', 'omset', 'qty', 'omset', 'qty', 'omset', 'qty', 'omset']
            let row = 2
            for(let c = 0; c < el.items.length; c++) {
                const model = el.items[c]
                row += 1
                worksheet.getRow(row).values = [model.name]
                for(let a = 0; a < 7; a++) {
                    for(let l = 0; l < model.items.length; l++) {
                        const val = model.items[l]
                        if(val.createdAt == '2024-01') {
                           worksheet.getRow(row).getCell('B').value = val.count
                           worksheet.getRow(row).getCell('C').value = val.total
                        }
                        if(val.createdAt == '2024-02') {
                           worksheet.getRow(row).getCell('D').value = val.count
                           worksheet.getRow(row).getCell('E').value = val.total
                        }
                        if(val.createdAt == '2024-03') {
                           worksheet.getRow(row).getCell('F').value = val.count
                           worksheet.getRow(row).getCell('G').value = val.total
                        }
                        if(val.createdAt == '2024-04') {
                           worksheet.getRow(row).getCell('H').value = val.count
                           worksheet.getRow(row).getCell('I').value = val.total
                        }
                        if(val.createdAt == '2024-05') {
                           worksheet.getRow(row).getCell('J').value = val.count
                           worksheet.getRow(row).getCell('K').value = val.total
                        }
                        if(val.createdAt == '2024-06') {
                           worksheet.getRow(row).getCell('L').value = val.count
                           worksheet.getRow(row).getCell('M').value = val.total
                        }
                    }
                }
            }
        }
        
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + "products.xlsx"
        );
        await workbook.xlsx.write(res);
        res.status(200).end();
    })
}

exports.getModelVarian = (req, res) => {
    salesModel.aggregate([
        {$match: {createdAt: {$gte: starDate, $lt: endDate}}},
        {$unwind: '$items'},
        {$unionWith: {coll: 'onlines', pipeline: [{$match: {createdAt: {$gte: starDate, $lt: endDate}}}, {$unwind: '$items'}]}},
        {$group: {
            _id: '$items.productId',
            count: {$sum: '$items.qty'},
            total: {$sum: '$items.total'}
        }},
        {$lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'products'
        }},
        {$unwind: '$products'},
        {$group: {
            _id: '$products.parentId',
            categoryId: {$first: '$products.categoryId'},
            count: {$sum: '$count'},
            total: {$sum: '$total'}
        }},
        {$match: {_id: {$ne: null}}},
        {$sort: {count: -1}},
        {$lookup: {
            from: 'products',
            foreignField: '_id',
            localField: '_id',
            as: 'product'
        }},
        {$unwind: '$product'},
        {$project: {
            name: '$product.name',
            categoryId: 1,
            total: 1,
            count: 1
        }},
        {$group: {
            _id: '$categoryId',
            items: {$push: {name: '$name', count: '$count', total: '$total'}}
        }},
        {$lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'category'
        }},
        {$unwind: '$category'},
        {$addFields: {
            category: '$category.name'
        }},
        {$sort: {category: 1}}
    ])
    .then(async (result) => {
        // res.status(200).json(result)
        let workbook = new excel.Workbook()
        for(let i = 0; i < result.length; i++) {
            const el = result[i]
            let worksheet = workbook.addWorksheet(el.category)
            worksheet.columns = [
                {key: 'name', width: 30},
                {key: 'count', width: 10},
                {key: 'total', width: 10}
            ]
            worksheet.getRow(1).values = ['Nama Produk', 'terujual', 'omset']
            worksheet.addRows(el.items)
        }
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + "products.xlsx"
        );
        await workbook.xlsx.write(res);
        res.status(200).end();
    })
}

exports.getWarna = (req, res) => {
    salesModel.aggregate([
        {$match: {createdAt: {$gte: starDate, $lt: endDate}}},
        {$unionWith: {coll: 'onlines', pipeline: [{$match: {createdAt: {$gte: starDate, $lt: endDate }}}]}},
        {$unwind: '$items'},
        {$match: {'items.name': {$regex: /Warna.(.*?)(?=\s)/}}},
        {$addFields: {
            warna: {$regexFind: {input: '$items.name', regex: /Warna.(.*?)(?=\s)/}}
        }},
        {$project: {
            count: '$items.qty',
            total: '$items.total',
            warna: '$warna.match',
            createdAt: 1
        }},
        {$group: {
            _id: {warna: '$warna', createdAt: {$dateToString: {date: '$createdAt', format: '%Y-%m'}}},
            warna: {$first: '$warna'},
            count: {$sum: '$count'},
            total: {$sum: '$total'},
            createdAt: {$first: {$dateToString: {date:'$createdAt', format: '%Y-%m'}}}
        }},
        {$sort: {count: -1}},
        {$group: {
            _id: '$createdAt',
            warna: {$push: {createdAt: '$createdAt', warna: '$warna', count: '$count', total: '$total'}}
        }},
        {$unwind: '$warna'},
        {$sort: {'warna.createdAt': 1}},
        {$group: {
            _id: '$warna.warna',
            warna: {$push: {createdAt: '$warna.createdAt', warna: '$warna.warna', count: '$warna.count', total: '$warna.total'}}
        }},
        {$sort: {_id: 1}}
    ])
    .then(async (result) => {
        // res.status(200).json(result)
        const workbook = new excel.Workbook()
        let worksheet = workbook.addWorksheet('warna')
        worksheet.mergeCells('A1:A2')
            worksheet.mergeCells('B1:C1')
            worksheet.mergeCells('D1:E1')
            worksheet.mergeCells('F1:G1')
            worksheet.mergeCells('H1:I1')
            worksheet.mergeCells('J1:K1')
            worksheet.mergeCells('L1:M1')
            worksheet.getCell('A1').value = 'WARNA'
            worksheet.getCell('B1').value = 'Januari'
            worksheet.getCell('D1').value = 'Februari'
            worksheet.getCell('F1').value = 'Maret'
            worksheet.getCell('H1').value = 'April'
            worksheet.getCell('J1').value = 'Mei'
            worksheet.getCell('L1').value = 'Juni'
            worksheet.getColumn(1).width = 45
            worksheet.getRow(2).values = ['', 'qty', 'omset', 'qty', 'omset', 'qty', 'omset', 'qty', 'omset', 'qty', 'omset', 'qty', 'omset']
        let row = 2
        for(let i = 0; i < result.length; i ++) {
            row += 1
            const el = result[i]
            worksheet.getRow(row).values = [el._id]
            for(let a = 0; a < 7; a++) {
                for(let l = 0; l < el.warna.length; l++) {
                    const val = el.warna[l]
                    if(val.createdAt == '2024-01') {
                       worksheet.getRow(row).getCell('B').value = val.count
                       worksheet.getRow(row).getCell('C').value = val.total
                    }
                    if(val.createdAt == '2024-02') {
                       worksheet.getRow(row).getCell('D').value = val.count
                       worksheet.getRow(row).getCell('E').value = val.total
                    }
                    if(val.createdAt == '2024-03') {
                       worksheet.getRow(row).getCell('F').value = val.count
                       worksheet.getRow(row).getCell('G').value = val.total
                    }
                    if(val.createdAt == '2024-04') {
                       worksheet.getRow(row).getCell('H').value = val.count
                       worksheet.getRow(row).getCell('I').value = val.total
                    }
                    if(val.createdAt == '2024-05') {
                       worksheet.getRow(row).getCell('J').value = val.count
                       worksheet.getRow(row).getCell('K').value = val.total
                    }
                    if(val.createdAt == '2024-06') {
                       worksheet.getRow(row).getCell('L').value = val.count
                       worksheet.getRow(row).getCell('M').value = val.total
                    }
                }
            }
        }
        
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + "products.xlsx"
        );
        await workbook.xlsx.write(res);
        res.status(200).end();
    })
}

exports.getSize = (req, res) => {
    salesModel.aggregate([
        {$match: {createdAt: {$gte: starDate, $lt: endDate}}},
        {$unionWith: {coll: 'onlines', pipeline: [{$match: {createdAt: {$gte: starDate, $lt: endDate }}}]}},
        {$unwind: '$items'},
        {$match: {'items.name': {$regex: /Size.(.*?)[0-z]{0,}/}}},
        {$addFields: {
            size: {$regexFind: {input: '$items.name', regex: /Size.(.*?)[0-z]{0,}/}}
        }},
        {$project: {
            count: '$items.qty',
            total: '$items.total',
            size: '$size.match',
            createdAt: 1
        }},
        {$group: {
            _id: {size: '$size', createdAt: {$dateToString: {date: '$createdAt', format: '%Y-%m'}}},
            size: {$first: '$size'},
            count: {$sum: '$count'},
            total: {$sum: '$total'},
            createdAt: {$first: {$dateToString: {date:'$createdAt', format: '%Y-%m'}}}
        }},
        {$sort: {count: -1}},
        {$group: {
            _id: '$createdAt',
            size: {$push: {createdAt: '$createdAt', size: '$size', count: '$count', total: '$total'}}
        }},
        {$unwind: '$size'},
        {$sort: {'size.createdAt': 1}},
        {$group: {
            _id: '$size.size',
            size: {$push: {createdAt: '$size.createdAt', size: '$size.size', count: '$size.count', total: '$size.total'}}
        }},
        {$sort: {_id: 1}}
    ])
    .then(async (result) => {
        // res.status(200).json(result)
        const workbook = new excel.Workbook()
        let worksheet = workbook.addWorksheet('size')
        worksheet.mergeCells('A1:A2')
        worksheet.mergeCells('B1:C1')
        worksheet.mergeCells('D1:E1')
        worksheet.mergeCells('F1:G1')
        worksheet.mergeCells('H1:I1')
        worksheet.mergeCells('J1:K1')
        worksheet.mergeCells('L1:M1')
        worksheet.getCell('A1').value = 'SIZE'
        worksheet.getCell('B1').value = 'Januari'
        worksheet.getCell('D1').value = 'Februari'
        worksheet.getCell('F1').value = 'Maret'
        worksheet.getCell('H1').value = 'April'
        worksheet.getCell('J1').value = 'Mei'
        worksheet.getCell('L1').value = 'Juni'
        worksheet.getColumn(1).width = 45
        worksheet.getRow(2).values = ['', 'qty', 'omset', 'qty', 'omset', 'qty', 'omset', 'qty', 'omset', 'qty', 'omset', 'qty', 'omset']
        let row = 2
        for(let i = 0; i < result.length; i ++) {
            row += 1
            const el = result[i]
            worksheet.getRow(row).values = [el._id]
            for(let a = 0; a < 7; a++) {
                for(let l = 0; l < el.size.length; l++) {
                    const val = el.size[l]
                    if(val.createdAt == '2024-01') {
                       worksheet.getRow(row).getCell('B').value = val.count
                       worksheet.getRow(row).getCell('C').value = val.total
                    }
                    if(val.createdAt == '2024-02') {
                       worksheet.getRow(row).getCell('D').value = val.count
                       worksheet.getRow(row).getCell('E').value = val.total
                    }
                    if(val.createdAt == '2024-03') {
                       worksheet.getRow(row).getCell('F').value = val.count
                       worksheet.getRow(row).getCell('G').value = val.total
                    }
                    if(val.createdAt == '2024-04') {
                       worksheet.getRow(row).getCell('H').value = val.count
                       worksheet.getRow(row).getCell('I').value = val.total
                    }
                    if(val.createdAt == '2024-05') {
                       worksheet.getRow(row).getCell('J').value = val.count
                       worksheet.getRow(row).getCell('K').value = val.total
                    }
                    if(val.createdAt == '2024-06') {
                       worksheet.getRow(row).getCell('L').value = val.count
                       worksheet.getRow(row).getCell('M').value = val.total
                    }
                }
            }
        }
        
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + "products.xlsx"
        );
        await workbook.xlsx.write(res);
        res.status(200).end();
    })
}

exports.getToko = (req, res) => {
    salesModel.aggregate([
        {$match: {createdAt: {$gte: starDate, $lt: endDate}}},
        {$group: {
            _id: {toko: '$shopId', createdAt: {$dateToString: {date: '$createdAt', format: '%Y-%m'}}},
            createdAt: {$first: {$dateToString: {date: '$createdAt', format: '%Y-%m'}}},
            count: {$sum: 1},
            total: {$sum: '$grandTotal'},
        }},
        {$lookup: {
            from: 'shops',
            localField: '_id.toko',
            foreignField: '_id',
            as: 'toko'
        }},
        {$unwind: '$toko'},
        {$addFields: {
            toko: '$toko.name'
        }},
        {$sort: {total: -1}},
        {$group: {
            _id: '$createdAt',
            toko: {$push: {createdAt: '$createdAt', toko: '$toko', count: '$count', total: '$total'}}
        }},
        {$unwind: '$toko'},
        {$sort: {_id: 1}},
        {$group: {
            _id: '$toko.toko',
            toko: {$push: {createdAt: '$toko.createdAt', toko: '$toko.toko', count: '$toko.count', total: '$toko.total'}}
        }}
    ])
    .then(async (result) => {
        const workbook = new excel.Workbook()
        let worksheet = workbook.addWorksheet('toko')
        worksheet.mergeCells('A1:A2')
        worksheet.mergeCells('B1:C1')
        worksheet.mergeCells('D1:E1')
        worksheet.mergeCells('F1:G1')
        worksheet.mergeCells('H1:I1')
        worksheet.mergeCells('J1:K1')
        worksheet.mergeCells('L1:M1')
        worksheet.getCell('A1').value = 'TOKO'
        worksheet.getCell('B1').value = 'Januari'
        worksheet.getCell('D1').value = 'Februari'
        worksheet.getCell('F1').value = 'Maret'
        worksheet.getCell('H1').value = 'April'
        worksheet.getCell('J1').value = 'Mei'
        worksheet.getCell('L1').value = 'Juni'
        worksheet.getColumn(1).width = 45
        worksheet.getRow(2).values = ['', 'trx', 'omset', 'trx', 'omset', 'trx', 'omset', 'trx', 'omset', 'trx', 'omset', 'trx', 'omset']
        let row = 2
        for(let i = 0; i < result.length; i ++) {
            row += 1
            const el = result[i]
            worksheet.getRow(row).values = [el._id]
            for(let a = 0; a < 7; a++) {
                for(let l = 0; l < el.toko.length; l++) {
                    const val = el.toko[l]
                    if(val.createdAt == '2024-01') {
                       worksheet.getRow(row).getCell('B').value = val.count
                       worksheet.getRow(row).getCell('C').value = val.total
                    }
                    if(val.createdAt == '2024-02') {
                       worksheet.getRow(row).getCell('D').value = val.count
                       worksheet.getRow(row).getCell('E').value = val.total
                    }
                    if(val.createdAt == '2024-03') {
                       worksheet.getRow(row).getCell('F').value = val.count
                       worksheet.getRow(row).getCell('G').value = val.total
                    }
                    if(val.createdAt == '2024-04') {
                       worksheet.getRow(row).getCell('H').value = val.count
                       worksheet.getRow(row).getCell('I').value = val.total
                    }
                    if(val.createdAt == '2024-05') {
                       worksheet.getRow(row).getCell('J').value = val.count
                       worksheet.getRow(row).getCell('K').value = val.total
                    }
                    if(val.createdAt == '2024-06') {
                       worksheet.getRow(row).getCell('L').value = val.count
                       worksheet.getRow(row).getCell('M').value = val.total
                    }
                }
            }
        }
        
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + "products.xlsx"
        );
        await workbook.xlsx.write(res);
        res.status(200).end();
    })
}

exports.getOnline = (req, res) => {
    onlineModel.aggregate([
        {$match: {createdAt: {$gte: starDate, $lt: endDate}}},
        {$lookup: {
            from: 'customers',
            localField: 'customerId',
            foreignField: '_id',
            as: 'customer'
        }},
        {$unwind: '$customer'},
        {$project: {
            createdAt: 1,
            grandTotal: 1,
            marketId: '$customer.marketplaceId'
        }},
        {$lookup: {
            from: 'marketplaces',
            localField: 'marketId',
            foreignField: '_id',
            as: 'market'
        }},
        {$unwind: '$market'},
        {$addFields: {
            market: '$market.name'
        }},
        {$group: {
            _id: {market: '$market', createdAt: {$dateToString: {date: '$createdAt', format: '%Y-%m'}}},
            createdAt: {$first: {$dateToString: {date: '$createdAt', format: '%Y-%m'}}},
            market: {$first: '$market'},
            count: {$sum: 1},
            total: {$sum: '$grandTotal'}
        }},
        {$group: {
            _id: '$createdAt',
            market: {$push: {createdAt: '$createdAt', market: '$market', count: '$count', total: '$total'}}
        }},
        {$unwind: '$market'},
        {$sort: {_id: 1}},
        {$group: {
            _id: '$market.market',
            market: {$push: {createdAt: '$market.createdAt', market: '$market.market', count: '$market.count', total: '$market.total'}}
        }}
    ])
    .then(async (result) => {
        const workbook = new excel.Workbook()
        let worksheet = workbook.addWorksheet('toko')
        worksheet.mergeCells('A1:A2')
        worksheet.mergeCells('B1:C1')
        worksheet.mergeCells('D1:E1')
        worksheet.mergeCells('F1:G1')
        worksheet.mergeCells('H1:I1')
        worksheet.mergeCells('J1:K1')
        worksheet.mergeCells('L1:M1')
        worksheet.getCell('A1').value = 'TOKO'
        worksheet.getCell('B1').value = 'Januari'
        worksheet.getCell('D1').value = 'Februari'
        worksheet.getCell('F1').value = 'Maret'
        worksheet.getCell('H1').value = 'April'
        worksheet.getCell('J1').value = 'Mei'
        worksheet.getCell('L1').value = 'Juni'
        worksheet.getColumn(1).width = 45
        worksheet.getRow(2).values = ['', 'trx', 'omset', 'trx', 'omset', 'trx', 'omset', 'trx', 'omset', 'trx', 'omset', 'trx', 'omset']
        let row = 2
        for(let i = 0; i < result.length; i ++) {
            row += 1
            const el = result[i]
            worksheet.getRow(row).values = [el._id]
            for(let a = 0; a < 7; a++) {
                for(let l = 0; l < el.market.length; l++) {
                    const val = el.market[l]
                    if(val.createdAt == '2024-01') {
                       worksheet.getRow(row).getCell('B').value = val.count
                       worksheet.getRow(row).getCell('C').value = val.total
                    }
                    if(val.createdAt == '2024-02') {
                       worksheet.getRow(row).getCell('D').value = val.count
                       worksheet.getRow(row).getCell('E').value = val.total
                    }
                    if(val.createdAt == '2024-03') {
                       worksheet.getRow(row).getCell('F').value = val.count
                       worksheet.getRow(row).getCell('G').value = val.total
                    }
                    if(val.createdAt == '2024-04') {
                       worksheet.getRow(row).getCell('H').value = val.count
                       worksheet.getRow(row).getCell('I').value = val.total
                    }
                    if(val.createdAt == '2024-05') {
                       worksheet.getRow(row).getCell('J').value = val.count
                       worksheet.getRow(row).getCell('K').value = val.total
                    }
                    if(val.createdAt == '2024-06') {
                       worksheet.getRow(row).getCell('L').value = val.count
                       worksheet.getRow(row).getCell('M').value = val.total
                    }
                }
            }
        }
        
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + "products.xlsx"
        );
        await workbook.xlsx.write(res);
        res.status(200).end();
    })
}

exports.getMitra = (req, res) => {
    mitraModel.aggregate([
        {$match:  {$and: [{createdAt: {$gte: starDate, $lt: endDate}}, {status: 'LUNAS'}]}},
        {$project: {
            createdAt: 1,
            total: 1
        }},
        {$group: {
            _id: {$dateToString: {date: '$createdAt', format: '%Y-%m'}},
            count: {$sum: 1},
            total: {$sum: '$total'}
        }},
        {$sort: {_id: 1}}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}

exports.getAttlog = (req, res) => {
    attlogModel.aggregate([
        {$match: {$and: [{scanDate: {$gte: starDate, $lt: endDate}}, {information: {$ne: 'Libur'}}]}},
        {$group: {
            _id: {$dateToString: {date: '$scanDate', format: '%Y-%m'}},
            scanDate: {$first: '$scanDate'},
            information: {$push: '$information'},
            total: {$sum: 1}
        }},
        {$unwind: '$information'},
        {$group: {
            _id: {desc: '$information', createdAt: {$dateToString: {date: '$scanDate', format: '%Y-%m'}}},
            createdAt: {$first: {$dateToString: {date: '$scanDate', format: '%Y-%m'}}},
            desc: {$first: '$information'},
            total: {$first: '$total'},
            count: {$sum: 1}
        }},
        {$project: {
            createdAt: 1,
            desc: 1,
            count: {$divide: [{$multiply: ['$count', 100]}, '$total']} 
        }},
        {$addFields: {
            count: {$round: ['$count', 2]}
        }},
        {$sort: {desc: 1}},
        {$group: {
            _id: '$createdAt',
            attlog: {$push: {createdAt: '$createdAt', desc: '$desc', count: '$count'}}
        }},
        {$sort: {_id: 1}},
        {$unwind: '$attlog'},
        {$group: {
            _id: '$attlog.desc',
            attlog: {$push: {createdAt: '$attlog.createdAt', desc: '$attlog.desc', count: '$attlog.count'}}
        }}
    ])
    .then(async(result) => {
        const workbook = new excel.Workbook()
        const worksheet = workbook.addWorksheet('absensi')
        worksheet.getCell('A1').value = 'KETERANGA'
        worksheet.getCell('B1').value = 'Jauari'
        worksheet.getCell('C1').value = 'Februar'
        worksheet.getCell('D1').value = 'Maret'
        worksheet.getCell('E1').value = 'April'
        worksheet.getCell('F1').value = 'Mei'
        worksheet.getCell('G1').value = 'Juni'
        let row = 1
        for(let i = 0; i < result.length; i ++) {
            row += 1
            const el = result[i]
            worksheet.getRow(row).values = [el._id]
            for(let a = 0; a < 7; a++) {
                for(let l = 0; l < el.attlog.length; l++) {
                    const val = el.attlog[l]
                    if(val.createdAt == '2024-01') {
                       worksheet.getRow(row).getCell('B').value = val.count
                    }
                    if(val.createdAt == '2024-02') {
                       worksheet.getRow(row).getCell('C').value = val.count
                    }
                    if(val.createdAt == '2024-03') {
                       worksheet.getRow(row).getCell('D').value = val.count
                    }
                    if(val.createdAt == '2024-04') {
                       worksheet.getRow(row).getCell('E').value = val.count
                    }
                    if(val.createdAt == '2024-05') {
                       worksheet.getRow(row).getCell('F').value = val.count
                    }
                    if(val.createdAt == '2024-06') {
                       worksheet.getRow(row).getCell('G').value = val.count
                    }
                }
            }
        }

        res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + "products.xlsx"
        );
        await workbook.xlsx.write(res);
        res.status(200).end();

    })
}

exports.getEmployee = (req, res) => {
    function calcDate(date1, date2) {
        /*
        * calcDate() : Calculates the difference between two dates
        * @date1 : "First Date in the format MM-DD-YYYY"
        * @date2 : "Second Date in the format MM-DD-YYYY"
        * return : Array
        */
    
        //new date instance
        const dt_date1 = new Date(date1);
        const dt_date2 = new Date(date2);
    
        //Get the Timestamp
        const date1_time_stamp = dt_date1.getTime();
        const date2_time_stamp = dt_date2.getTime();
    
        let calc;
    
        //Check which timestamp is greater
        if (date1_time_stamp > date2_time_stamp) {
            calc = new Date(date1_time_stamp - date2_time_stamp);
        } else {
            calc = new Date(date2_time_stamp - date1_time_stamp);
        }
        //Retrieve the date, month and year
        const calcFormatTmp = calc.getDate() + '-' + (calc.getMonth() + 1) + '-' + calc.getFullYear();
        //Convert to an array and store
        const calcFormat = calcFormatTmp.split("-");
        //Subtract each member of our array from the default date
        const days_passed = Number(Math.abs(calcFormat[0]) - 1);
        const months_passed = Number(Math.abs(calcFormat[1]) - 1);
        const years_passed = Number(Math.abs(calcFormat[2]) - 1970);
    
        //Set up custom text
        const yrsTxt = ["tahun", "tahun"];
        const mnthsTxt = ["bulan", "bulan"];
        const daysTxt = ["hari", "hari"];
    
        //Convert to days and sum together
        const total_days = (years_passed * 365) + (months_passed * 30.417) + days_passed;
        const total_secs = total_days * 24 * 60 * 60;
        const total_mins = total_days * 24 * 60;
        const total_hours = total_days * 24;
        const total_weeks = ( total_days >= 7 ) ? total_days / 7 : 0;
    
        //display result with custom text
        const result = ((years_passed == 1) ? years_passed + ' ' + yrsTxt[0] + ' ' : (years_passed > 1) ?
            years_passed + ' ' + yrsTxt[1] + ' ' : '') +
            ((months_passed == 1) ? months_passed + ' ' + mnthsTxt[0] + ' ' : (months_passed > 1) ?
                months_passed + ' ' + mnthsTxt[1] + ' ' : '') +
            ((days_passed == 1) ? days_passed + ' ' + daysTxt[0] : (days_passed > 1) ?
                days_passed + ' ' + daysTxt[1] : '');
    
        //return the result
        // return {
        //     "total_days": Math.round(total_days),
        //     "total_weeks": Math.round(total_weeks),
        //     "total_hours" : Math.round(total_hours),
        //     "total_minutes" : Math.round(total_mins),
        //     "total_seconds": Math.round(total_secs),
        //     "result": result.trim()
        // }
        return result.trim()
    
    }
    
    employeeModel.aggregate([
        {$match: {$and: [{createdAt: {$lt: endDate}}, {isActive: true}, {isAdmin: {$ne: true}}]}},
        {$project: {
            name: 1,
            shopId: '$employmentData.shopId',
            posisi: '$employmentData.posisiPekerjaan',
            status: '$employmentData.statusPekerjaan',
            bergabung: '$employmentData.tanggalBergabung',
            gaji: '$payroll.gajiPokok',
            masaKerja: ''
        }},
        {$lookup: {
            from: 'shops',
            localField: 'shopId',
            foreignField: '_id',
            as: 'toko'
        }},
        {$unwind: '$toko'},
        {$addFields: {
            toko: '$toko.name'
        }}
    ])
    .then(async (result) => {
        const date = new Date('2024-07-1')
        result.forEach(el => {
            el.masaKerja = calcDate(el.bergabung, date)
        })
        const workbook = new excel.Workbook()
        const worksheet = workbook.addWorksheet('Karyawan')
        worksheet.columns = [
            {key: 'name', width: 25},
            {key: 'toko', width: 15},
            {key: 'posisi', width: 15},
            {key: 'status', width: 15},
            {key: 'gaji', width: 15},
            {key: 'masaKerja', width: 35}
        ]
        worksheet.getRow(1).values = ['Nama', 'TOKO', 'Posisi', 'Status', 'Gaji Pokok', 'Masa Kerja']
        worksheet.addRows(result)
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + "products.xlsx"
        );
        await workbook.xlsx.write(res);
        res.status(200).end();
        // res.status(200).json(result)
    })
}

exports.getBarangMasuk = (req, res) => {
    receiptModel.aggregate([
        {$match: {createdAt: {$gte: starDate, $lt: endDate}}},
        {$unwind: '$items'},
        {$group: {
            _id: {supplierId: '$supplierId', createdAt: {$dateToString: {date: '$createdAt', format: '%Y-%m'}}},
            createdAt: {$first: {$dateToString: {date: '$createdAt', format: '%Y-%m'}}},
            supplierId: {$first: '$supplierId'},
            count: {$sum: '$items.qty'}
        }},
        {$lookup: {
            from: 'suppliers',
            localField: 'supplierId',
            foreignField: '_id',
            as: 'supplier'
        }},
        {$unwind: '$supplier'},
        {$addFields: {
            supplier: '$supplier.name'
        }},
        {$group: {
            _id: '$createdAt',
            supplier: {$push: {createdAt: '$createdAt', type: '$type', supplierId: '$supplierId', supplier: '$supplier', count: '$count'}}
        }},
        {$sort: {_id: 1}},
        {$unwind: '$supplier'},
        {$group: {
            _id: '$supplier.supplierId',
            name: {$first: '$supplier.supplier'},
            supplier: {$push: {createdAt: '$supplier.createdAt', type: '$supplier.type', supplier: '$supplier.supplier', count: '$supplier.count'}}
        }}
    ])
    .then(async (result) => {
        res.status(200).json(result)
        const workbook = new excel.Workbook()
        const worksheet = workbook.addWorksheet('supplier')
        worksheet.getCell('A1').value = 'SUPPLIER'
        worksheet.getCell('B1').value = 'Jauari'
        worksheet.getCell('C1').value = 'Februar'
        worksheet.getCell('D1').value = 'Maret'
        worksheet.getCell('E1').value = 'April'
        worksheet.getCell('F1').value = 'Mei'
        worksheet.getCell('G1').value = 'Juni'
        let row = 1
        for(let i = 0; i < result.length; i ++) {
            row += 1
            const el = result[i]
            worksheet.getRow(row).values = [el.name]
            for(let a = 0; a < 7; a++) {
                for(let l = 0; l < el.supplier.length; l++) {
                    const val = el.supplier[l]
                    if(val.createdAt == '2024-01') {
                       worksheet.getRow(row).getCell('B').value = val.count
                    }
                    if(val.createdAt == '2024-02') {
                       worksheet.getRow(row).getCell('C').value = val.count
                    }
                    if(val.createdAt == '2024-03') {
                       worksheet.getRow(row).getCell('D').value = val.count
                    }
                    if(val.createdAt == '2024-04') {
                       worksheet.getRow(row).getCell('E').value = val.count
                    }
                    if(val.createdAt == '2024-05') {
                       worksheet.getRow(row).getCell('F').value = val.count
                    }
                    if(val.createdAt == '2024-06') {
                       worksheet.getRow(row).getCell('G').value = val.count
                    }
                }
            }
        }

        res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + "products.xlsx"
        );
        await workbook.xlsx.write(res);
        res.status(200).end();
    })
}

exports.getPermintaan = (req, res) => {
    purchaseModel.aggregate([
        {$match: {createdAt: {$gte: starDate, $lt: endDate}}},
        {$unwind: '$items'},
        {$group: {
            _id: {supplierId: '$supplierId', createdAt: {$dateToString: {date: '$createdAt', format: '%Y-%m'}}},
            createdAt: {$first: {$dateToString: {date: '$createdAt', format: '%Y-%m'}}},
            supplierId: {$first: '$supplierId'},
            count: {$sum: '$items.qty'}
        }},
        {$lookup: {
            from: 'suppliers',
            localField: 'supplierId',
            foreignField: '_id',
            as: 'supplier'
        }},
        {$unwind: '$supplier'},
        {$addFields: {
            supplier: '$supplier.name'
        }},
        {$group: {
            _id: '$createdAt',
            supplier: {$push: {createdAt: '$createdAt', type: '$type', supplierId: '$supplierId', supplier: '$supplier', count: '$count'}}
        }},
        {$sort: {_id: 1}},
        {$unwind: '$supplier'},
        {$group: {
            _id: '$supplier.supplierId',
            name: {$first: '$supplier.supplier'},
            supplier: {$push: {createdAt: '$supplier.createdAt', type: '$supplier.type', supplier: '$supplier.supplier', count: '$supplier.count'}}
        }}
    ])
    .then(async (result) => {
        res.status(200).json(result)
    })
}

exports.getProductNotSales = (req, res) => {
    salesModel.aggregate([
        {$match: {createdAt: {$gte: starDate, $lt: endDate}}},
        {$unwind: '$items'},
        {$group: {
            _id: '$items.productId'
        }},
        {$unionWith: {coll: 'onlines', pipeline: [{$match: {createdAt: {$gte: starDate, $lt: endDate }}}, {$unwind: '$items'}, {$group: {_id: '$items.productId'}}]}},
        {$unionWith: {coll: 'products', pipeline: [{$project: {_id: 1}}]}},
        {$group: {
            _id: '$_id',
            count: {$sum: 1}
        }},
        {$match: {count: {$lte: 1}}},
        {$lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'products'
        }},
        {$unwind: '$products'},
        {$match: {$and: [{'products.stock': {$gte: 1}}, {'products.createdAt': {$lt: endDate}}]}},
        {$project: {
            sku: '$products.sku',
            name: '$products.name',
            stock: '$products.stock',
            price: '$products.price',
            total: {$multiply: ['$products.price', '$products.stock']},
            created: {$dateToString: {date: '$products.createdAt', format: '%Y-%m-%d'}},
            update: {$dateToString: {date: '$products.updatedAt', format: '%Y-%m-%d'}}
        }},
        {$sort: {stock: -1}}
    ])
    .then(async (result) => {
        // res.status(200).json(result)
        const workbook = new excel.Workbook()
        const worksheet = workbook.addWorksheet("laporan barang")
        worksheet.columns = [
            {key: 'sku', width: 10},
            {key: 'name', width: 35},
            {key: 'stock', width: 10},
            {key: 'price', width: 15},
            {key: 'total', width: 10},
            {key: 'created', width: 15},
            {key: 'update', width: 15}
        ]
        worksheet.getRow(1).values = [ 'SKU', 'NAMA BARANG', 'STOK', 'HARGA JUAL', 'TOTAL', 'DIBUAT', 'AKTIFITAS']
        worksheet.addRows(result)

        res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + "products.xlsx"
        );
        await workbook.xlsx.write(res);
        res.status(200).end();
    })
}

