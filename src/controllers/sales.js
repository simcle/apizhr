const mongoose = require('mongoose');
const SalesModel = require('../models/sales');
const DraftSalesModel = require('../models/draftSales');
const OnlineModel = require('../models/online');
const productModel = require('../models/products');
const InventoryModel = require('../models/inventory');
const updateStock = require('../modules/updateStock');
const stockCard = require('../modules/stockCard');
const OutletModel = require('../models/shops');
const excel = require('exceljs');

exports.getOutlet = (req, res) => {
    OutletModel.find().lean()
    .then(result => {
        const outlet = result.map(obj => {
            obj.id = obj._id,
            obj.text = obj.name
            return obj
        })
        res.status(200).json(outlet)
    })
}

exports.getReport = (req, res) => {
    const date = new Date();
    let day = date.getDate() - 29
    date.setDate(day)
    date.setHours(0, 0, 0, 0)
    const shopId = mongoose.Types.ObjectId(req.query.shopId);
    SalesModel.aggregate([
        {$match: {$and: [{createdAt: {$gte: date}}, {shopId: shopId}]}},
        {$unwind: '$items'},
        {$group: {
            _id: '$items.productId',
            sku: {$first: '$items.sku'},
            name: {$first: '$items.name'},
            sales: {$sum: '$items.qty'},
            total: {$sum: '$items.subTotal'}
        }},
        {$sort: {sales: -1}},
        {$limit: 100},
        {$lookup: {
            from: 'inventories',
            let: {'itemId': '$_id'},
            pipeline: [
                {$match: {
                    $expr: {$and: [
                        {$eq: ['$$itemId', '$productId']},
                        {$eq: ['$shopId', shopId]}
                    ]}
                }}
            ],
            as: 'stock'
        }},
        {$unwind: '$stock'},
        {$addFields: {
            stock: '$stock.qty'
        }},
        {$match: {stock: {$lte: 0}}}
    ])
    .then(result => {
        res.status(200).json(result)
    })

    // productModel.aggregate([
    //     {$sort: {stock: -1}},
    //     {$limit: 200},
    //     {$project: {
    //         sku: 1,
    //         name: 1,
    //         stock: 1
    //     }},
    //     {$lookup: {
    //         from: 'sales',
    //         let: {'itemId': '$_id'},
    //         pipeline: [
    //             {$unwind: '$items'},
    //             {$match: {
    //                 $expr: {$eq: ['$$itemId', '$items.productId']}
    //             }},
    //             {$group: {
    //                 _id: '$items.productId',
    //                 qty: {$sum: '$items.qty'},
    //                 total: {$sum: '$items.subTotal'}
    //             }}
    //         ],
    //         as: 'sales'
    //     }},
    //     {$unwind: '$sales'},
    //     {$addFields: {
    //         sold: '$sales.qty',
    //         tota: '$sales.total' 
    //     }},
    //     {$unset: 'sales'}
    // ])
    // .then (async(result) => {
    //    console.log(result)
    //     let workbook = new excel.Workbook()
    //     let worksheet = workbook.addWorksheet('Laporan')
    //     worksheet.columns = [
    //         {key: 'sku', width: 25},
    //         {key: 'name', width: 75},
    //         {key: 'stock',  width: 25},
    //         {key: 'sold',  width: 25},
    //         {key: 'tota',  width: 25},
    //     ]
    //     worksheet.getRow(1).values = ['STATISTICS PENJUALAN', ``]
    //     worksheet.getRow(3).values = ['SKU', 'ITEM','STOCK']
    //     worksheet.addRows(result)
    //     res.setHeader(
    //         "Content-Type",
    //         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    //     );
    //     res.setHeader(
    //         "Content-Disposition",
    //         "attachment; filename=" + "tutorials.xlsx"
    //     );
    //     await workbook.xlsx.write(res);
    //     res.status(200).end();
    // })

    // const shopId = mongoose.Types.ObjectId('647aa84733581aaca9c7725b')
    // InventoryModel.aggregate([
    //     {$match: {shopId: shopId}},
    //     {$lookup: {
    //         from: 'products',
    //         foreignField: '_id',
    //         localField: 'productId',
    //         as: 'product'
    //     }},
    //     {$unwind: '$product'},
    //     {$addFields: {
    //         sku: '$product.sku',
    //         name: '$product.name'
    //     }},
    //     {$unset: 'product'},
    //     {$sort: {qty: 1}}
    // ])
    // .then(async(result) => {
    //     console.log(result)
    //     let workbook = new excel.Workbook()
    //     let worksheet = workbook.addWorksheet('Laporan')
    //     worksheet.columns = [
    //         {key: 'sku', width: 25},
    //         {key: 'name', width: 75},
    //         {key: 'qty',  width: 25},
    //     ]
    //     worksheet.getRow(1).values = ['STATISTICS PENJUALAN', ``]
    //     worksheet.getRow(3).values = ['SKU', 'ITEM','STOCK']
    //     worksheet.addRows(result)
    //     res.setHeader(
    //         "Content-Type",
    //         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    //     );
    //     res.setHeader(
    //         "Content-Disposition",
    //         "attachment; filename=" + "tutorials.xlsx"
    //     );
    //     await workbook.xlsx.write(res);
    //     res.status(200).end();
    // })
    // const categoryId = mongoose.Types.ObjectId('6477e92c474ed497218eddc6')
    // SalesModel.aggregate([
    //     {$unwind: '$items'},
    //     {$group: {
    //         _id: '$items.productId',
    //         sku: {$first: '$items.sku'},
    //         name: {$first: '$items.name'},
    //         qty: {$sum: '$items.qty'}
    //     }},
    //     {$lookup: {
    //         from: 'products',
    //         localField: '_id',
    //         foreignField: '_id',
    //         as: 'category'
    //     }},
    //     {$unwind: '$category'},
    //     {$addFields: {
    //         category: '$category.categoryId'
    //     }},
    //     {$match: {category: categoryId}},
    //     {$sort: {qty: -1}}
    // ])
    // .then(async (result) => {
    //     let workbook = new excel.Workbook()
    //     let worksheet = workbook.addWorksheet('Laporan')
    //     worksheet.columns = [
    //         {key: 'sku', width: 25},
    //         {key: 'name', width: 75},
    //         {key: 'qty',  width: 25},
    //     ]
    //     worksheet.getRow(1).values = ['STATISTICS PENJUALAN', ``]
    //     worksheet.getRow(3).values = ['SKU', 'ITEM', 'SOLD']
    //     worksheet.addRows(result)
    //     res.setHeader(
    //         "Content-Type",
    //         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    //     );
    //     res.setHeader(
    //         "Content-Disposition",
    //         "attachment; filename=" + "tutorials.xlsx"
    //     );
    //     await workbook.xlsx.write(res);
    //     res.status(200).end();
    // })
}
exports.getChart = (req, res) => {
    const productId = mongoose.Types.ObjectId(req.query.productId)
    const shopId = mongoose.Types.ObjectId(req.query.shopId)
    const sales = SalesModel.aggregate([
        {$unwind: '$items'},
        {$match: {$and: [{shopId: shopId}, {'items.productId': productId}]}},
        {$addFields: {
            qty: '$items.qty'
        }},
        {$project: {
            createdAt: 1,
            qty: 1
        }},
        {$group: {
            _id: {$dateToString: {format: "%Y-%m-%d", date: '$createdAt'}},
            qty: {$sum: '$qty'}
        }},
        {$sort: {_id: 1}}
    ])
    const invnentory = InventoryModel.aggregate([
        {$match: {productId: productId}},
        {$lookup: {
            from: 'shops',
            foreignField: '_id',
            localField: 'shopId',
            as: 'shop'
        }},
        {$unwind: '$shop'},
        {$addFields: {
            shop: '$shop.name'
        }}
    ])
    Promise.all([
        sales,
        invnentory
    ])
    .then(result  => {
        res.status(200).json({
            sales: result[0],
            inventory: result[1]
        })
    })
}
exports.getBestSales = (req, res) => {
    const shopId = mongoose.Types.ObjectId(req.user.shopId)
    const date = new Date();
    day = date.getDate() - 6
    date.setDate(day)
    date.setHours(0, 0, 0, 0)
    SalesModel.aggregate([
        {$match: {$and: [{shopId: shopId}, {createdAt: {$gte: date}}]}},
        {$unwind: '$items'},
        {$group: {
            _id: '$items.productId',
            qty: {$sum: '$items.qty'},
            sku: {$first: '$items.sku'},
            name: {$first: '$items.name'}
        }},
        {$sort: {qty: -1}},
        {$limit: 50},
        {$lookup: {
            from:'inventories',
            let: {'itemId': '$_id'},
            pipeline: [
                {$match: {
                    $expr: {
                        $and: [
                            {$eq: ['$productId', '$$itemId']},
                            {$eq: ['$shopId', shopId]}
                        ]
                    }
                }}
            ],
            as: 'stock'
        }},
        {$unwind: '$stock'},
        {$addFields: {
            stock: '$stock.qty'
        }},
    ])
    .then(result => {
        res.status(200).json(result)
    })
}
exports.getSales = (req, res) => {
    const currentPage = req.query.page || 1
    const perPage = req.query.perPage || 20
    let totalItems;
    let grandTotal;
    const shopId = mongoose.Types.ObjectId(req.user.shopId)
    const date = new Date();
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    SalesModel.aggregate([
        {$match: {$and:[{'shopId': shopId},{'createdAt': {$gte: today}}]}},
        {$sort: {createdAt: -1}},
        {$group: {
            _id: null,
            count: {$sum: 1},
            total: {$sum: '$grandTotal'}
        }}
    ])
    .then(count => {
        if(count.length > 0) {
            totalItems = count[0].count
            grandTotal = count[0].total
        } else {
            totalItems = 0
            grandTotal = 0
        }
        return SalesModel.find({$and:[{shopId: shopId},{createdAt: {$gte: today}}]})
        .skip((currentPage-1) * perPage)
        .limit(perPage)
        .sort({createdAt: -1})
    })
    .then(result => {
        const last_page = Math.ceil(totalItems / perPage)
        res.status(200).json({
            data: result,
            grandTotal: grandTotal,
            count: totalItems,
            pages: {
                current_page: currentPage,
                last_page: last_page
            }
        }) 
    })   
}

exports.getDetailSales = (req, res) => {
    const salesId = req.params.salesId
    SalesModel.findById(salesId)
    .then(result => {
        res.status(200).json(result)
    })
    .catch(err => {
       res.status(400).send(err)
    })
}

exports.insertDraft = async (req, res) => {
    const shopId = req.user.shopId
    const draftId = req.body.draftId
    let no;
    let draftNo = await DraftSalesModel.findOne({shopId: shopId}).sort({createdAt: -1})
    if(draftNo) {
        no = parseInt(draftNo.no) + 1
    } else {
        no = 1
    }
    if(!draftId) {
        const draft = new DraftSalesModel({
            no: no,
            shopId: shopId,
            items: req.body.items,
            grandTotal: req.body.grandTotal
        })
        draft.save()
        .then(() => {
            DraftSalesModel.find({shopId: shopId})
            .then(result => {
                res.status(200).json(result)
            })
        })
    } else {
        DraftSalesModel.updateOne({_id: draftId}, {$set: {
            items: req.body.items,
            grandTotal: req.body.grandTotal
        }})
        .then(() => {
            DraftSalesModel.find({shopId: shopId})
            .then(result => {
                res.status(200).json(result)
            })
        })
    }
}
exports.getDraft = (req, res) => {
    const shopId = req.user.shopId
    DraftSalesModel.find({shopId: shopId})
    .then(result => {
        res.status(200).json(result)
    })
}
exports.deleteDraft = (req, res) => {
    const shopId = req.user.shopId
    const id = req.params.id
    DraftSalesModel.deleteOne({_id: id})
    .then(() => {
        return DraftSalesModel.find({shopId: shopId})
    })
    .then(result => {
        res.status(200).json(result)
    })
}

exports.insertSales = async (req, res) => {
    const shopId = req.user.shopId
    const userId = req.user._id
    const draftId = req.body.draftId
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
    let sales = await SalesModel.findOne({createdAt: {$gte: today}}).sort({createdAt: -1})
    let salesNo;
    if(sales) {
        const no = sales.salesNo.substring(16)
        const newNo = parseInt(no)+1
        salesNo = `${dd}${mm}/ZHR/POS/${yy}/${newNo}`
    } else {
        salesNo = `${dd}${mm}/ZHR/POS/${yy}/1`
    }
    sales = new SalesModel({
        salesNo: salesNo,
        shopId: shopId,
        items: req.body.items,
        grandTotal: req.body.grandTotal,
        paymentMethod: req.body.paymentMethod,
        bankId: req.body.bankId,
        cash: req.body.cash,
        transfer: req.body.transfer,
        debit: req.body.debit,
        bayar: req.body.bayar,
        kembali: req.body.kembali,
        userId: userId
    })
    sales.save()
    .then( async (result) => {
        if(draftId) {
            await DraftSalesModel.deleteOne({_id: draftId})
        }
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
            await stockCard('out', shopId, item.productId, documentId, 'Penjualan', item.qty, balance.stock)
        }
        res.status(200).json(result)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

exports.updateSales = async (req, res) => {
    const salesId = req.body._id
    const original = req.body.originalItems
    const shopId = req.user.shopId
    for(let i = 0; i < original.length; i++) {
        const item = original[i]
        const inventory = await InventoryModel.findOne({$and: [{shopId: shopId}, {productId: item.productId}]})
        inventory.qty += item.qty
        await inventory.save()
        const balance = await updateStock(mongoose.Types.ObjectId(item.productId))
        await stockCard('in', shopId, item.productId, salesId, 'Edit penjualan', item.qty, balance.stock)
    }
    SalesModel.findById(salesId)
    .then(sale => {
        sale.items = req.body.items
        sale.grandTotal = req.body.grandTotal
        sale.paymentMethod = req.body.paymentMethod
        sale.bankId = req.body.bankId
        sale.cash = req.body.cash
        sale.transfer = req.body.transfer
        sale.debit = req.body.debit
        sale.bayar = req.body.bayar
        sale.kembali = req.body.kembali
        return sale.save()
    })
    .then( async (result) => {
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
            await stockCard('out', shopId, item.productId, documentId, 'Update penjualan', item.qty, balance.stock)
        }
        res.status(200).json(result)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}