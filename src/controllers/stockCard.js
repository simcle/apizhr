const mongoose = require('mongoose');
const StockOpnameModel = require('../models/stockopname');
const SalesModel = require('../models/sales');
const NgolesModel = require('../models/ngoles');
const ResellerModel = require('../models/reseller');
const TransferModel = require('../models/transfer');
const ReceiptsModel = require('../models/receipts');
const StockCardModle = require('../models/stockCard');
const ReturnModel = require('../models/returns');

exports.getStockCard = (req, res) => {
    const productId = mongoose.Types.ObjectId(req.params.productId)
    const currentPage = req.query.page || 1;
    const perPage = req.query.perPage || 20;
    let totalItems;
    StockCardModle.aggregate([
        {$match: {productId: productId}},
        {$count: 'count'}
    ])
    .then(result => {
        if(result.length > 0) {
            totalItems = result[0].count
        } else {
            totalItems = 0
        }
        return StockCardModle.aggregate([
            {$match: {productId: productId}},
            {$lookup: {
                from: 'shops',
                localField: 'shopId',
                foreignField: '_id',
                as: 'shop'
            }},
            {$unwind: '$shop'},
            {$addFields: {
                shop: '$shop.name'
            }},
            {$sort: {createdAt: -1}},
            {$skip: (currentPage -1) * perPage},
            {$limit: perPage},
        ])
    })
    
    .then(async (result) => {
        const last_page = Math.ceil(totalItems / perPage)
        let stockCard = result
        for (let i = 0; i < result.length; i++) {
            const el = result[i].documentName
            const documentId = result[i].documentId
            let doc;
            if(el == 'Ngoles' || el == 'Ngoles edit qty' || el == 'Ngoles canceled')  {
                doc = await NgolesModel.findById(documentId)
                stockCard[i].document = doc.ngolesNo
            }
            if(el == 'Stock Opname') {
                doc = await StockOpnameModel.findById(documentId)
                stockCard[i].document = doc.stockOpnameNumber
            }
            if(el == 'Penjualan' || el == 'Edit penjualan' || 'Update penjualan') {
                doc = await SalesModel.findById(documentId)
                if(doc) {
                    stockCard[i].document = doc.salesNo
                }
            }
            if(el  == 'Reseller' || el == 'Reseller edit') {
                doc = await ResellerModel.findById(documentId)
                stockCard[i].document = doc.resellerNo
            }
            if(el == 'Transfer' || el == 'Receive') {
                doc = await TransferModel.findById(documentId)
                if(doc) {
                    stockCard[i].document = doc.transferNo
                }
            }
            if(el == 'Receipts') {
                doc = await ReceiptsModel.findById(documentId)
                if(doc) {
                    stockCard[i].document = doc.receiptsNo
                }
            }
            if(el == 'Retur') {
                doc = await ReturnModel.findById(documentId)
                if(doc) {
                    stockCard[i].document = doc.returnNo
                }
            }
        }
        res.status(200).json({
            stockCards: stockCard,
            pages: {
                current_page: currentPage,
                last_page: last_page,
                totalItems: totalItems 
            },
        })
    })
}