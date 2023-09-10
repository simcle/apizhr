const mongoose = require('mongoose');
const OnlineModel = require('../models/online');
const ShippingModel = require('../models/shipping');
const BankModel = require('../models/banks');
const InventoryModel = require('../models/inventory');
const updateStock = require('../modules/updateStock');
const stockCard = require('../modules/stockCard');

exports.getDashboard = (req, res) => {
    const date = new Date();
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const sevenDay = new Date()
    const day = sevenDay.getDate() - 6
    sevenDay.setDate(day)
    sevenDay.setHours(0, 0, 0, 0)
    const user = OnlineModel.aggregate([
        {$match: {createdAt: {$gte: today}}},
        {$lookup: {
            from: 'users',
            foreignField: '_id',
            localField: 'userId',
            as: 'user'
        }},
        {$unwind: '$user'},
        {$addFields: {
            user: '$user.name'
        }},
        {$group: {
            _id: '$userId',
            user: {$first: '$user'},
            total: {$sum: '$grandTotal'}
        }}
    ])
    const markets = OnlineModel.aggregate([
        {$match: {createdAt: {$gte: sevenDay}}},
        {$lookup: {
            from: 'customers',
            foreignField: '_id',
            localField: 'customerId',
            as: 'customer'
        }},
        {$unwind: '$customer'},
        {$addFields: {
            marketId: '$customer.marketplaceId'
        }},
        {$lookup: {
            from: 'marketplaces',
            foreignField: '_id',
            localField: 'marketId',
            as: 'markets'
        }},
        {$unwind: '$markets'},
        {$addFields: {
            markets: '$markets.name',
            logo: '$markets.logo'
        }},
        {$group: {
            _id: {shopId: '$marketId', tanggal: {$dateToString: {format: "%Y-%m-%d", date: '$createdAt'}}},
            tanggal: {$first: {$dateToString: {format: "%Y-%m-%d", date: '$createdAt'}}},
            market: {$first: '$markets'},
            logo: {$first: '$logo'},
            total: {$sum: '$grandTotal'}
        }},
        {$sort: {'_id.tanggal': 1}},
        {$group: {
            _id: '$_id.shopId',
            market: {$first: '$market'},
            logo: {$first: '$logo'},
            total: {$sum: '$total'},
            data: {$push: {tanggal: '$tanggal', total: '$total'}}
        }},
        {$sort: {total: -1}}
    ])
    Promise.all([
        user,
        markets
    ])
    .then(result => {
        res.status(200).json({
            user: result[0],
            markets: result[1]
        })
    })
}


exports.getSales = (req, res) => {
    const search = req.query.search
    const filter = req.query.filter
    const filterShipping = req.query.filterShipping
    const userId = mongoose.Types.ObjectId(req.user._id)
    const date = new Date();
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    let query = {}
    let shipCount = {}
    switch (filter) {
        case 'Semua': 
        query = {customerName: {$regex: '.*'+search, $options: 'i'}}
        break;
        case 'Saya': 
        query = {$and: [{customerName: {$regex: '.*'+search, $options: 'i'}}, {userId: userId}, {createdAt: {$gte: today}}]}
        shipCount = {$and: [{userId: userId}, {createdAt: {$gte: today}}]}
        break;
        case 'Hari ini': 
        query = {$and: [{customerName: {$regex: '.*'+search, $options: 'i'}}, {createdAt: {$gte: today}}]}
        shipCount = {createdAt: {$gte: today}}
        break;
        case 'Belum diprint': 
        query = {$and: [{customerName: {$regex: '.*'+search, $options: 'i'}}, {isPrinted: false}]}
        shipCount = {isPrinted: false}
        break;
        case 'Siap dikirim': 
        query = {$and: [{customerName: {$regex: '.*'+search, $options: 'i'}}, {resi: null}, {isPrinted: true}]}
        shipCount = {$and: [{resi: null}, {isPrinted: true}]}
        break;
    }
    if(filterShipping) {
        const shippingId = mongoose.Types.ObjectId(filterShipping)
        if(filter == 'Semua') {
            query = {$and: [{customerName: {$regex: '.*'+search, $options: 'i'}}, {shippingId: shippingId}]}
        }
        if(filter == 'Saya') {
            query = {$and: [{customerName: {$regex: '.*'+search, $options: 'i'}}, {userId: userId}, {createdAt: {$gte: today}}, {shippingId: shippingId}]}
        }
        if(filter == 'Hari ini') {
            query = {$and: [{customerName: {$regex: '.*'+search, $options: 'i'}}, {createdAt: {$gte: today}}, {shippingId: shippingId}]}
        }
        if(filter == 'Belum diprint') {
            query = {$and: [{customerName: {$regex: '.*'+search, $options: 'i'}}, {isPrinted: false}, {shippingId: shippingId}]}
        }
        if(filter == 'Siap dikirim') {
            query = {$and: [{customerName: {$regex: '.*'+search, $options: 'i'}}, {resi: null}, {isPrinted: true}, {shippingId: shippingId}]}
        }
    }
    const currentPage = req.query.page || 1
    const perPage = req.query.perPage || 20
    const stats = OnlineModel.aggregate([
        {$group: {
            _id: null,
            today: {$sum: {$cond: [{$gte: ['$createdAt', today]}, 1, 0]}},
            printed: {$sum: {$cond: [{$eq: ['$isPrinted', false]}, 1, 0]}},
            ship: {$sum: {$cond: [{$and: [{$eq: ['$resi', null]}, {$eq: ['$isPrinted', true]}]}, 1, 0]}},
            me: {$sum: {$cond: [{$and: [{$eq: ['$userId', userId]}, {$gte: ['$createdAt', today]}]}, 1, 0]}},
        }}
    ])
    const ship = OnlineModel.aggregate([
        {$match: shipCount},
        {$group: {
            _id: '$shippingId',
            name: {$first: '$shippingName'},
            count: {$sum: 1}
        }},
        {$sort: {count: 1}}
    ])
    const totalItems = OnlineModel.aggregate([
        {$lookup: {
            from: 'customers',
            foreignField: '_id',
            localField: 'customerId',
            as: 'customer'
        }},
        {$unwind: '$customer'},
        {$addFields: {
            customerName: '$customer.name'
        }},
        {$match: query},
        {$count: 'count'}
    ])
    const sales = OnlineModel.aggregate([
        {$lookup: {
            from: 'banks',
            foreignField: '_id',
            localField: 'bankId',
            as: 'bank'
        }},
        {$unwind: '$bank'},
        {$lookup: {
            from: 'customers',
            foreignField: '_id',
            localField: 'dropshipperId',
            as: 'dropshipper'
        }},
        {$unwind: {
            path: '$dropshipper',
            preserveNullAndEmptyArrays: true
        }},
        {$lookup: {
            from: 'customers',
            foreignField: '_id',
            localField: 'customerId',
            as: 'customer'
        }},
        {$unwind: '$customer'},
        {$lookup: {
            from: 'marketplaces',
            foreignField: '_id',
            localField: 'customer.marketplaceId',
            as: 'marketplace'
        }},
        {$unwind: '$marketplace'},
        {$lookup: {
            from: 'users',
            foreignField: '_id',
            localField: 'userId',
            as: 'user'
        }},
        {$unwind: '$user'},
        {$lookup: {
            from: 'shippings',
            foreignField: '_id',
            localField: 'shippingId',
            as: 'shippingLogo',
        }},
        {$unwind: '$shippingLogo'},
        {$addFields: {
            customerName: {$cond: [{$ifNull: ['$dropshipper.name', false]}, '$dropshipper.name', '$customer.name']},
            marketplace: '$marketplace.name',
            marketplaceLogo: '$marketplace.logo',
            bank: '$bank.icon',
            user: '$user.name',
            shippingLogo: '$shippingLogo.logo'
        }},
        {$match: query},
        {$sort: {createdAt: -1}},
        {$skip: (currentPage-1) * perPage},
        {$limit: perPage},
    ])
    Promise.all([
        stats,
        ship,
        totalItems,
        sales,
    ])
    .then(result => {
        let count = 0
        if(result[2].length > 0) {
            count = result[2][0].count
        }
        const last_page = Math.ceil(count / perPage)
        res.status (200).json({
            stats: result[0][0],
            ships: result[1],
            sales: result[3],
            pages: {
                current_page: currentPage,
                last_page: last_page
            }
        })
    })
    .catch(err => [
        res.status(400).send(err)
    ])
}


exports.createSale = (req, res) => {
    const shipping = ShippingModel.find().lean()
    const bank = BankModel.find()
    Promise.all([
        shipping,
        bank
    ])
    .then (result => {
        const shipping = result[0].map(obj => {
            obj.id = obj._id
            obj.text = obj.name
            return obj
        })
        res.status(200).json({
            shipping: shipping,
            banks: result[1]
        })
    })
}

exports.editSale = (req, res) => {
    const onlineId = mongoose.Types.ObjectId(req.params.onlineId)
    const shipping = ShippingModel.find().lean()
    const bank = BankModel.find()
    const sale = OnlineModel.aggregate([
        {$match: {_id: onlineId}},
        {$lookup: {
            from: 'customers',
            foreignField: '_id',
            localField: 'customerId',
            as: 'customer'
        }},
        {$unwind: '$customer'}
    ])
    Promise.all([
        shipping,
        bank,
        sale
    ])
    .then (result => {
        const shipping = result[0].map(obj => {
            obj.id = obj._id
            obj.text = obj.name
            return obj
        })
        res.status(200).json({
            shipping: shipping,
            banks: result[1],
            sale: result[2][0]
        })
    })
},

exports.editDropship = (req, res) => {
    const onlineId = mongoose.Types.ObjectId(req.params.onlineId)
    const shipping = ShippingModel.find().lean()
    const bank = BankModel.find()
    const sale = OnlineModel.aggregate([
        {$match: {_id: onlineId}},
        {$lookup: {
            from: 'customers',
            foreignField: '_id',
            localField: 'dropshipperId',
            as: 'dropship'
        }},
        {$unwind: '$dropship'},
        {$lookup: {
            from: 'customers',
            foreignField: '_id',
            localField: 'customerId',
            as: 'customer'
        }},
        {$unwind: '$customer'}
    ])
    Promise.all([
        shipping,
        bank,
        sale
    ])
    .then (result => {
        const shipping = result[0].map(obj => {
            obj.id = obj._id
            obj.text = obj.name
            return obj
        })
        res.status(200).json({
            shipping: shipping,
            banks: result[1],
            sale: result[2][0]
        })
    })
},

exports.insertSales = async (req, res) => {
    const {body} = req
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
    let sales = await OnlineModel.findOne({createdAt: {$gte: today}}).sort({createdAt: -1})
    let salesNo;
    if(sales) {
        const no = sales.onlineNo.substring(16)
        const newNo = parseInt(no)+1
        salesNo = `${dd}${mm}/ZHR/OLN/${yy}/${newNo}`
    } else {
        salesNo = `${dd}${mm}/ZHR/OLN/${yy}/1`
    }
    sales = new OnlineModel({
        onlineNo: salesNo,
        customerId: body.customerId,
        items: body.items,
        shippingId: body.shippingId,
        shippingName: body.shippingName,
        service: body.service,
        bookingCode: body.bookingCode,
        shipmentCost: body.shipmentCost,
        grandTotal: body.grandTotal,
        bankId: body.bankId,
        userId: userId
    })
    sales.save()
    .then(async (result) => {
        const sales = await OnlineModel.aggregate([
            {$match: {_id: result._id}},
            {$lookup: {
                from: 'customers',
                foreignField: '_id',
                localField: 'customerId',
                as: 'customer'
            }},
            {$unwind: '$customer'},
            {$lookup: {
                from: 'users',
                foreignField: '_id',
                localField: 'userId',
                as: 'user',
            }},
            {$unwind: '$user'},
            {$lookup: {
                from: 'shippings',
                foreignField: '_id',
                localField: 'shippingId',
                as: 'shipping'
            }},
            {$unwind: '$shipping'},
            {$addFields: {
                user: '$user.name',
                shippingName: '$shipping.name',
                shippingLogo: '$shipping.logo'
            }},
           {$unset:'shipping'}

        ])
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
            await stockCard('out', shopId, item.productId, documentId, 'Online', item.qty, balance.stock)
        }
        res.status(200).json(sales[0])
    })
}

exports.updateSale = (req, res) => {
    const shopId = req.user.shopId
    const userId = req.user._id
    const {body} = req
    const onlineId = req.params.onlineId
    OnlineModel.findById(onlineId)
    .then(async (result) => {
        let documentId = result._id
        const items = result.items
        for(let i = 0; i < items.length; i ++) {
            const item = items[i]
            const inventory = await InventoryModel.findOne({$and: [{shopId: shopId}, {productId: item.productId}]})
            if(inventory) {
                inventory.qty = inventory.qty + item.qty
                await inventory.save()
            }
            const balance = await updateStock(item.productId)
            await stockCard('in', shopId, item.productId, documentId, 'Online Edit', item.qty, balance.stock)
        }
        result.customerId = body.customerId,
        result.items = body.items,
        result.shippingId = body.shippingId,
        result.shippingName = body.shippingName,
        result.service = body.service,
        result.bookingCode = body.bookingCode,
        result.shipmentCost = body.shipmentCost,
        result.grandTotal = body.grandTotal,
        result.bankId = body.bankId,
        result.userId = userId
        return result.save()
    })
    .then (async (result) => {
        const sales = await OnlineModel.aggregate([
            {$match: {_id: result._id}},
            {$lookup: {
                from: 'customers',
                foreignField: '_id',
                localField: 'customerId',
                as: 'customer'
            }},
            {$unwind: '$customer'},
            {$lookup: {
                from: 'users',
                foreignField: '_id',
                localField: 'userId',
                as: 'user',
            }},
            {$unwind: '$user'},
            {$lookup: {
                from: 'shippings',
                foreignField: '_id',
                localField: 'shippingId',
                as: 'shipping'
            }},
            {$unwind: '$shipping'},
            {$addFields: {
                user: '$user.name',
                shippingName: '$shipping.name',
                shippingLogo: '$shipping.logo'
            }},
           {$unset:'shipping'}

        ])
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
            await stockCard('out', shopId, item.productId, documentId, 'Online', item.qty, balance.stock)
        }
        res.status(200).json(sales[0])
    })
}

exports.insertDropship = async (req, res) => {
    const {body} = req
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
    let sales = await OnlineModel.findOne({createdAt: {$gte: today}}).sort({createdAt: -1})
    let salesNo;
    if(sales) {
        const no = sales.onlineNo.substring(16)
        const newNo = parseInt(no)+1
        salesNo = `${dd}${mm}/ZHR/OLN/${yy}/${newNo}`
    } else {
        salesNo = `${dd}${mm}/ZHR/OLN/${yy}/1`
    }
    sales = new OnlineModel({
        onlineNo: salesNo,
        dropshipperId: body.dropshipperId,
        customerId: body.customerId,
        items: body.items,
        shippingId: body.shippingId,
        shippingName: body.shippingName,
        service: body.service,
        bookingCode: body.bookingCode,
        shipmentCost: body.shipmentCost,
        grandTotal: body.grandTotal,
        type: 'Dropship',
        bankId: body.bankId,
        userId: userId
    })
    sales.save()
    .then(async (result) => {
        const sales = await OnlineModel.aggregate([
            {$match: {_id: result._id}},
            {$lookup: {
                from: 'customers',
                foreignField: '_id',
                localField: 'dropshipperId',
                as: 'dropshipper'
            }},
            {$unwind: '$dropshipper'},
            {$lookup: {
                from: 'customers',
                foreignField: '_id',
                localField: 'customerId',
                as: 'customer'
            }},
            {$unwind: '$customer'},
            {$lookup: {
                from: 'users',
                foreignField: '_id',
                localField: 'userId',
                as: 'user',
            }},
            {$unwind: '$user'},
            {$lookup: {
                from: 'shippings',
                foreignField: '_id',
                localField: 'shippingId',
                as: 'shipping'
            }},
            {$unwind: '$shipping'},
            {$addFields: {
                user: '$user.name',
                shippingName: '$shipping.name',
                shippingLogo: '$shipping.logo'
            }},
           {$unset:'shipping'}

        ])
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
            await stockCard('out', shopId, item.productId, documentId, 'Online', item.qty, balance.stock)
        }
        res.status(200).json(sales[0])
    })
}

exports.updateDropship = (req, res) => {
    const shopId = req.user.shopId
    const userId = req.user._id
    const {body} = req
    const onlineId = req.params.onlineId
    OnlineModel.findById(onlineId)
    .then(async (result) => {
        let documentId = result._id
        const items = result.items
        for(let i = 0; i < items.length; i ++) {
            const item = items[i]
            const inventory = await InventoryModel.findOne({$and: [{shopId: shopId}, {productId: item.productId}]})
            if(inventory) {
                inventory.qty = inventory.qty + item.qty
                await inventory.save()
            }
            const balance = await updateStock(item.productId)
            await stockCard('in', shopId, item.productId, documentId, 'Online Edit', item.qty, balance.stock)
        }
        result.dropshipperId = body.dropshipperId,
        result.customerId = body.customerId,
        result.items = body.items,
        result.shippingId = body.shippingId,
        result.shippingName = body.shippingName,
        result.service = body.service,
        result.bookingCode = body.bookingCode,
        result.shipmentCost = body.shipmentCost,
        result.grandTotal = body.grandTotal,
        result.bankId = body.bankId,
        result.userId = userId
        return result.save()
    })
    .then (async (result) => {
        const sales = await OnlineModel.aggregate([
            {$match: {_id: result._id}},
            {$lookup: {
                from: 'customers',
                foreignField: '_id',
                localField: 'customerId',
                as: 'customer'
            }},
            {$unwind: '$customer'},
            {$lookup: {
                from: 'users',
                foreignField: '_id',
                localField: 'userId',
                as: 'user',
            }},
            {$unwind: '$user'},
            {$lookup: {
                from: 'shippings',
                foreignField: '_id',
                localField: 'shippingId',
                as: 'shipping'
            }},
            {$unwind: '$shipping'},
            {$addFields: {
                user: '$user.name',
                shippingName: '$shipping.name',
                shippingLogo: '$shipping.logo'
            }},
           {$unset:'shipping'}

        ])
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
            await stockCard('out', shopId, item.productId, documentId, 'Online', item.qty, balance.stock)
        }
        res.status(200).json(sales[0])
    })
}

exports.updatePrinted = async (req, res) => {
    const id = req.params.onlineId
    await OnlineModel.updateOne({_id: id}, {isPrinted: true})
}

exports.updateResi = async (req, res) => {
    const id = req.params.onlineId
    await OnlineModel.updateOne({_id: id}, {resi: req.body.resi})
    res.status(200).json('OK')
}

exports.getTransfer = (req, res) => {
    const date = new Date()
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    OnlineModel.aggregate([
        {$match: {createdAt: {$gte: today}}},
        {$lookup: {
            from: 'banks',
            foreignField: '_id',
            localField: 'bankId',
            as: 'bank'
        }},
        {$unwind: '$bank'},
        {$addFields: {
            bank: '$bank.name'
        }},
        {$project: {
            _id: 0,
            bank: 1,
            grandTotal: 1
        }}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}

exports.statistics = (req, res) => {
    const sales = OnlineModel.aggregate([
       {$unwind: '$items'},
       {$addFields: {
            productId: '$items.productId',
            sku: '$items.sku',
            name: '$items.name',
            qty: '$items.qty'
       }},
       {$project: {
            productId: 1,
            sku: 1,
            name: 1,
            qty: 1
       }},
       {$group: {
            _id: '$productId',
            sku: {$first: '$sku'},
            name: {$first: '$name'},
            qty: {$sum: '$qty'}
       }},
       {$sort: {qty : -1}},
       {$limit: 20}
    ])

    Promise.all([
        sales
    ])
    .then(result => {
        res.status(200).json({
            sales: result[0]
        })
    })
}