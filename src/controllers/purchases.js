const SupplierModel = require('../models/supplier');
const ProductModel = require('../models/products');
const PurchaseModel = require('../models/purchases');
const { default: mongoose } = require('mongoose');

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
    const currentPage = req.query.page || 1
    const perPage = req.query.perPage || 20
    let totalItems;
    let query;
    if(search) {
        query = {$or: [{purchaseNo: search},{supplier: {$regex: '.*'+search+'.*', $options: 'i'}}]}
    } else {
        query = {}
    }
    PurchaseModel.aggregate([
        {$lookup: {
            from: 'suppliers',
            foreignField: '_id',
            localField: 'supplierId',
            as: 'supplier'
        }},
        {$unwind: '$supplier'},
        {$addFields: {
            supplier: '$supplier.name'
        }},
        {$match: query},
        {$count: 'count'}
    ])
    .then(result => {
        if(result.length > 0) {
            totalItems = result[0].count
        } else {
            totalItems = 0
        }
        return PurchaseModel.aggregate([
            {$lookup: {
                from: 'suppliers',
                foreignField: '_id',
                localField: 'supplierId',
                as: 'supplier'
            }},
            {$unwind: '$supplier'},
            {$addFields: {
                supplier: '$supplier.name',
                total: {$sum: '$items.total'}
            }},
            {$match: query},
            {$sort: {createdAt: -1}},
            {$skip: (currentPage -1) * perPage},
            {$limit: perPage},
        ])
    })
    .then (result => {
        const last_page = Math.ceil(totalItems / perPage)
        res.status(200).json({
            data: result,
            pages: {
                current_page: currentPage,
                last_page: last_page,
                totalItems: totalItems
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
        status: 'RFQ'
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
    .then(result => {
       result.items.push(item)
       return result.save()
    })
    .then(result => {
        res.status(200).json(result)
    })
}

exports.deleteItem = (req, res) => {
    const purchaseId = req.params.purchaseId
    const id = req.body._id
    PurchaseModel.findById(purchaseId)
    .then(result => {
        result.items.pull(id)
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
            result.status = status
            result.remarks = req.body.remarks
            result.invoiceDate = req.body.invoiceDate
        }
        return result.save()
    })
    .then(() => {
        res.status(200).json('OK')
    })
}