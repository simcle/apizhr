const mongoose = require('mongoose');
const ReturnModel = require('../models/returns');
const InventoryModel = require('../models/inventory');
const updateStock = require('../modules/updateStock');
const stockCard = require('../modules/stockCard');

exports.getAllReturn = (req, res) => {
    const currentPage = req.query.page || 1
    const perPage = req.query.perPage || 20
    let totalItems;
    const shopId = mongoose.Types.ObjectId(req.user.shopId)
    ReturnModel.aggregate([
        {$match: {shopId: shopId}},
        {$count: 'count'}
    ])
    .then(count => {
        if(count.length > 0) {
            totalItems = count[0].count
        } else {
            totalItems = 0
        }
        return ReturnModel.find({shopId: shopId})
        .skip((currentPage-1) * perPage)
        .limit(perPage)
        .sort({createdAt: -1})
    })
    .then(result => {
        const last_page = Math.ceil(totalItems / perPage)
        res.status(200).json({
            data: result,
            count: totalItems,
            pages: {
                current_page: currentPage,
                last_page: last_page
            }
        }) 
    })

}


exports.insertReturn = async (req, res) => {
    const shopId = req.user.shopId
    const userId = req.user._id
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
    let salesReturn = await ReturnModel.findOne({createdAt: {$gte: today}}).sort({createdAt: -1})
    let returnNo;
    if(salesReturn) {
        const no = salesReturn.returnNo.substring(16)
        const newNo = parseInt(no)+1
        returnNo = `${dd}${mm}/ZHR/RET/${yy}/${newNo}`
    } else {
        returnNo = `${dd}${mm}/ZHR/RET/${yy}/1`
    }
    salesReturn = new ReturnModel({
        returnNo: returnNo,
        shopId: shopId,
        reason: req.body.alasan,
        itemRetur: req.body.itemRetur,
        itemPengganti: req.body.itemPengganti,
        selisih: req.body.selisih,
        userId: userId
    })
    salesReturn.save()
    .then(async (result) => {
        let documentId = result._id
        const itemReturId = result.itemRetur.productId
        const itemPenggantiId = result.itemPengganti.productId
        // ITEM RETURN
        let inventory = await InventoryModel.findOne({$and: [{shopId: shopId}, {productId: itemReturId}]})
        if(inventory) {
            inventory.qty = inventory.qty + 1
            await inventory.save()
        } else {
            await InventoryModel.create({shopId: shopId, productId: itemReturId, qty: 0})
        }
        let balance = await updateStock(itemReturId)
        await stockCard('in', shopId, itemReturId, documentId, 'Retur', 1, balance.stock)

        // ITEM PENGGANTI
        inventory = await InventoryModel.findOne({$and: [{shopId: shopId}, {productId: itemPenggantiId}]})
        if(inventory) {
            inventory.qty = inventory.qty - 1
            await inventory.save()
        } else {
            await InventoryModel.create({shopId: shopId, productId: itemPenggantiId, qty: 0})
        }
        balance = await updateStock(itemPenggantiId)
        await stockCard('out', shopId, itemPenggantiId, documentId, 'Retur', 1, balance.stock)

        res.status(200).json('OK');
    })
}