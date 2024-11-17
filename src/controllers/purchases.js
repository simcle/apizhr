const SupplierModel = require('../models/supplier');
const ProductModel = require('../models/products');
const PurchaseModel = require('../models/purchases');
const ReceiptModel = require('../models/receipts');

const mongoose = require('mongoose')
const excel = require('exceljs');
const moment = require('moment');
const supplier = require('../models/supplier');

exports.getSuppliers = (req, res) => {
    const search = req.query.search
    SupplierModel.find({name: {$regex: '.*'+search+'.*', $options: 'i'}}).sort({name: 1}).limit(5)
    .then(result => {
        res.status(200).json(result)
    })
}

exports.getProduct = (req, res) => {
    const sku = req.query.sku
    ProductModel.findOne({sku: sku})
    .then(result => {
        res.status(200).json(result)
    })
}

exports.getPurchases = (req, res) => {
    const search = req.query.search
    const status = req.query.status
    const currentPage = req.query.page || 1
    const perPage = req.query.perPage || 20
    let totalItems;
    let query;
    if(search) {
        query = {$or: [{purchaseNo: search}, {'supplier.name': {$regex: '.*'+search+'.*', $options: 'i'}}, {remarks: {$regex: '.*'+search+'.*', $options: 'i'}}]}
    } else {
        query = {}
    }
    PurchaseModel.aggregate([
        {$match: {status: status}},
        {$sort: {createdAt: -1}},
        {$lookup: {
            from: 'suppliers',
            foreignField: '_id',
            localField: 'supplierId',
            as: 'supplier'
        }},
        {$match: query},
        {$skip: (currentPage -1) * perPage},
        {$limit: perPage},
        {$unwind: '$supplier'},
        {$addFields: {
            supplier: '$supplier.name',
            total: {$sum: '$items.qty'}
        }},
        {$project: {
            _id: 1,
            supplierId: 1,
            purchaseNo: 1,
            invoiceDate: 1,
            status: 1, 
            createdAt: 1,
            remarks: 1,
            items: 1,
            supplier: 1,
            total: 1
        }},
    ])
    .then(result => {
        const last_page = Math.ceil(totalItems / perPage)
        res.status(200).json({
            data: result,
            pages: {
                current_page: currentPage,
                last_page: last_page,
            }
        })
    })
}

exports.getPurchaseDetail = (req, res) => {
    const purchaseId = mongoose.Types.ObjectId(req.params.purchaseId)
    PurchaseModel.aggregate([
        {$match: {_id: purchaseId}},
        {$lookup: {
            from: 'suppliers',
            foreignField: '_id',
            localField: 'supplierId',
            as: 'supplier'
        }},
        {$unwind: '$supplier'},
        {$addFields: {
            supplier: '$supplier.name'
        }}
    ])
    .then(result => {
        res.status(200).json(result[0])
    })
}

exports.insertPurchase = async (req, res) => {
    const items = req.body.items
    const supplierId = req.body.supplierId
    const remarks = req.body.remarks
    const invoiceDate = req.body.invoiceDate
    const images = req.body.images
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
    let purchase = await PurchaseModel.findOne({createdAt: {$gte: today}}).sort({createdAt: -1})
    let purchaseNo;
    if(purchase) {
        const no = purchase.purchaseNo.substring(16)
        const newNo = parseInt(no)+1
        purchaseNo = `${dd}${mm}/ZHR/PRC/${yy}/${newNo}`
    } else {
        purchaseNo = `${dd}${mm}/ZHR/PRC/${yy}/1`
    }
    
    purchase = new PurchaseModel({
        purchaseNo: purchaseNo,
        supplierId: supplierId,
        invoiceDate: invoiceDate,
        items: items,
        remarks: remarks,
        status: 'RFQ',
        images: images
    })
    purchase.save()
    .then(async () => {
        for(let i = 0; i < items.length; i++) {
            const productId = mongoose.Types.ObjectId(items[i].productId)
            await ProductModel.updateOne({_id: productId}, {flow: 'Purchase', sourceFlow: purchaseNo})
        }
        res.status(200).json('OK')
    })
}

exports.insertItem = (req, res) => {
    const purchaseId = req.params.purchaseId
    const item = req.body
    PurchaseModel.findById(purchaseId)
    .then(async (result) => {
        const purchaseNo = result.purchaseNo
        result.items.push(item)
        await ProductModel.updateOne({_id: item.productId}, {flow: 'Purchase', sourceFlow: purchaseNo})
        return result.save()
    })
    .then(result => {
        res.status(200).json(result)
    })
}

exports.deleteItem = (req, res) => {
    const purchaseId = req.params.purchaseId
    
    const item = req.body
    PurchaseModel.findById(purchaseId)
    .then(async (result) => {
        result.items.pull(item._id)
        await ProductModel.updateOne({_id: item.productId}, {flow: '', sourceFlow: ''})
        return result.save()
    })
    .then(result => {
        res.status(200).json(result)
    })
}

exports.updatePurchase = (req, res) => {
    const purchaseId = req.params.purchaseId
    const status = req.body.status
    PurchaseModel.findById(purchaseId)
    .then(result => {
        if(status) {
            result.supplierId = req.body.supplierId
            result.status = status
            result.remarks = req.body.remarks
            result.invoiceDate = req.body.invoiceDate
            result.images = req.body.images
        }
        return result.save()
    })
    .then(() => {
        res.status(200).json('OK')
    })
}

exports.deletePurchase = (req, res) => {
    const purchaseId = req.params.purchaseId
    console.log(purchaseId)
    PurchaseModel.deleteOne({_id: purchaseId})
    .then(() => {
        res.status(200).json('OK')
    })
}

exports.downloadPurchase = async (req, res) => {
    const supplierId = mongoose.Types.ObjectId('65b5cd6ea0fd4820be25dc16')
    PurchaseModel.aggregate([
        {$match: {$and: [{supplierId: supplierId}, {status: 'RFQ SENT'}]}},
        {$unwind: '$items'},
        {$project: {
            items: 1
        }},
        {$addFields: {
            sku: '$items.sku',
            name: '$items.name',
            qty: '$items.qty'
        }},
        {$unset: 'items'}
    ])
    .then(async (result) => {
        let workbook = new excel.Workbook()
        let worksheet = workbook.addWorksheet('Laporan')
        worksheet.columns = [
            {key: 'sku', width: 10},
            {key: 'name', width: 45},
            {key: 'qty',  width: 10},
        ]
        console.log(result)
        worksheet.getRow(1).values = ['PERMINTAAN BARANG', ``]
        worksheet.getRow(3).values = ['SKU', 'ITEM', 'QTY']
        worksheet.addRows(result)
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + "tutorials.xlsx"
        );
        await workbook.xlsx.write(res);
        res.status(200).end();
    })
}

exports.getReport = (req, res) => {
    const date = moment().subtract(6, 'day').toDate()
    PurchaseModel.aggregate([
        {$match: {createdAt: {$gte: date}}},
        {$project: {
            items: 1,
            supplierId: 1
        }},
        {$unwind: '$items'},
        {$group: {
            _id: '$supplierId',
            purchase: {$sum: '$purchase'},
            purchase: {$sum: '$items.qty'},
        }},
        {$lookup: {
            from: 'suppliers',
            foreignField: '_id',
            localField: '_id',
            as: 'supplier'
        }},
        {$unwind: '$supplier'},
        {$addFields: {
            supplier: '$supplier.name'
        }},
    ])
    .then(result => {
        console.log(result)
        res.status(200).json(result)
    })
}