const ReceiptModel = require('../models/receipts')
const SupplierModel = require('../models/supplier')
const SalesModel = require('../models/sales')
const mongoose = require('mongoose')
const excel = require('exceljs')

exports.getSupplierData = async (req, res) => {
    const data = await SupplierModel.find()
    res.status(200).json(data)
}

exports.getSupplier = async (req, res) => {
    const supplierId = new mongoose.Types.ObjectId('64992b174a5ea7413b1e075d')
    const date = new Date()
    const day = date.getDate() - 29
    date.setDate(day)
    date.setHours(0, 0, 0, 0)
    const supplier = await ReceiptModel.aggregate([
        {$match: {supplierId: supplierId}},
        {$unwind: '$items'},
        {$addFields: {
            sku: '$items.sku'
        }},
        {$group: {
            _id: '$sku',
            supplierId: {$first: '$supplierId'}
        }},
        {$group: {
            _id: '$supplierId',
            sku: {$push: '$_id'}
        }},
        {$lookup: {
            from: 'suppliers',
            localField: '_id',
            foreignField: '_id',
            as: 'supplier'
        }},
        {$unwind: '$supplier'},
        {$addFields: {
            supplier: '$supplier.name'
        }},
        {$project: {
            sku: 1,
            supplier: 1
        }},
        {$lookup: {
            from: 'products',
            localField: 'sku',
            foreignField: 'sku',
            as: 'products'
        }},
        {$unset: 'sku'}
    ])
    const data = []
    let count = 0
    for(let i = 0; i < supplier.length; i++) {
        const el = supplier[i]
        data.push({supplier: el.supplier, products: []})
        for(let p = 0; p < el.products.length; p++) {
            const product = el.products[p]
            console.time('query')
            const sales = await SalesModel.aggregate([
                {$unwind: '$items'},
                {$unionWith: {coll: 'onlines', pipeline: [{$match: {$and: [{createdAt: {$gte: date}}, {'items.sku': product.sku}]}}, {$unwind: '$items'}]}},
                {$match: {$and: [{createdAt: {$gte: date}}, {'items.sku': product.sku}]}},
                {$group: {
                    _id: '$items.productId',
                    qty: {$sum: '$items.qty'}
                }}
            ])
            count++
            console.timeEnd('query')
            console.log(count)
            let sold
            if(sales.length > 0) {
                sold = sales[0].qty
            } else {
                sold = 0
            }
            let totalHargaJual 
            if(product.stock > 0) {
                totalHargaJual = product.price * product.stock
            } else {
                totalHargaJual = 0
            }
            let totalPenjualan = product.price * sold
            
            data[i].products.push({sku: product.sku, name: product.name, price: product.price, purchase: product.purchase, stock: product.stock, unitCost: totalHargaJual, sales: sold, omzet: totalPenjualan})
        }
    }
    const supplierName = data[0].supplier
    const rows = data[0].products.length;
    const workbook = new excel.Workbook()
    const worksheet = workbook.addWorksheet('laporan')
    worksheet.columns = [
        {key: 'sku', width: 10},
        {key: 'name', width: 50},
        {key: 'price', width: 13},
        {key: 'purchase', width: 13},
        {key: 'stock', width: 10},
        {key: 'unitCost', width: 13},
        {key: 'sales', width: 10},
        {key: 'omzet', width: 13}
    ]
    worksheet.getRow(1).values = [supplierName]
    worksheet.getRow(2).values = ['SKU', 'NAMA PRODUK', 'HARGA JUAL', 'HARGA BELI', 'STOK', 'TOTAL HARGA', 'TERJUAL', 'TOTAL OMSET']
    worksheet.addRows(data[0].products)
    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
        "Content-Disposition",
        "attachment; filename=" +supplierName+".xlsx"
    );
    await workbook.xlsx.write(res);
    res.status(200).end();
}