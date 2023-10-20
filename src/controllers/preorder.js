const mongoose = require('mongoose');
const PreoderModel = require('../models/preorder');

exports.getMenunggu = (req, res) => {
    const supplierId = mongoose.Types.ObjectId(req.params.id)
    const stats = PreoderModel.aggregate([
        {$match: {supplierId: supplierId}},
        {$unwind: '$items'},
        {$group: {
            _id: '$supplierId',
            menunggu: {$sum: {$cond: [{$eq: ['$items.status', 'Menunggu']}, 1, 0]}},
            terima: {$sum: {$cond: [{$eq: ['$items.status', 'Terima']}, 1, 0]}},
            tolak: {$sum: {$cond: [{$eq: ['$items.status', 'Tolak']}, 1, 0]}},
            selesai: {$sum: {$cond: [{$eq: ['$items.status', 'Selesai']}, 1, 0]}},
        }},
    ])
    const menunggu = PreoderModel.aggregate([
        {$unwind: '$items'},
        {$addFields: {
            itemId: '$items._id',
            productId: '$items.productId',
            name: '$items.name',
            sku: '$items.sku',
            qty: '$items.qty',
            status: '$items.status',
        }},
        {$unset: 'items'},
        {$match: {$and: [{supplierId: supplierId}, {status: 'Menunggu'}]}},
        {$lookup: {
            from: 'products',
            foreignField: '_id',
            localField: 'productId',
            as: 'image'
        }},
        {$unwind: '$image'},
        {$addFields: {
            image: '$image.imageVarian'
        }},
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
        {$sort: {createdAt: -1}},
    ])
    Promise.all([
        stats,
        menunggu
    ])
    .then(result => {
        const stats = result[0][0]
        const menunggu = result[1]
        res.status(200).json({
            stats: stats,
            data: menunggu
        })
    })
}

exports.getPreorder = (req, res) => {
    const currentPage = req.query.page || 1
    const perPage = req.query.perPage || 20
    let totalItems;
    const search = req.query.search
    PreoderModel.aggregate([
        {$lookup: {
            from: 'customers',
            foreignField: '_id',
            localField: 'customerId',
            as: 'customer'
        }},
        {$unwind: '$customer'},
        {$addFields: {
            customer: '$customer.name'
        }},
        {$match: {customer: {$regex: '.*'+search, $options: 'i'}}},
        {$count: 'count'}
    ])
    .then(count => {
        if(count.length > 0) {
            totalItems = count[0].count
        } else {
            totalItems = 0
        }
        return PreoderModel.aggregate([
            {$unwind: '$items'},
            {$group: {
                _id: '$_id',
                customerId: {$first: '$customerId'},
                supplierId: {$first: '$supplierId'},
                userId: {$first: '$userId'},
                items: {$push: '$items'},
                menunggu: {$sum: {$cond: [{$eq: ['$items.status', 'Menunggu']}, 1, 0]}},
                terima: {$sum: {$cond: [{$eq: ['$items.status', 'Terima']}, 1, 0]}},
                tolak: {$sum: {$cond: [{$eq: ['$items.status', 'Tolak']}, 1, 0]}},
                selesai: {$sum: {$cond: [{$eq: ['$items.status', 'Selesai']}, 1, 0]}},
                createdAt: {$first: '$createdAt'}
            }},
            {$lookup: {
                from: 'customers',
                foreignField: '_id',
                localField: 'customerId',
                as: 'customer'
            }},
            {$unwind: '$customer'},
            {$lookup: {
                from: 'suppliers',
                foreignField: '_id',
                localField: 'supplierId',
                as: 'supplier'
            }},
            {$unwind: '$supplier'},
            {$lookup: {
                from: 'users',
                foreignField: '_id',
                localField: 'userId',
                as: 'user'
            }},
            {$unwind: '$user'},
            {$addFields: {
                customer: '$customer.name',
                user: '$user.name',
                supplier: '$supplier.name'
            }},
            {$sort: {createdAt: -1}},
            {$match: {customer: {$regex: '.*'+search, $options: 'i'}}},
            {$skip: (currentPage-1) * perPage},
            {$limit: perPage},
        ])
    })
    .then(result => {
        const last_page = Math.ceil(totalItems / perPage)
        res.status(200).json({
            data: result,
            pages: {
                current_page: currentPage,
                last_page: last_page
            }
        });
    })
}
exports.insertPreorder = (req, res) => {
    const preorder = new PreoderModel({
        customerId: req.body.customerId,
        supplierId: req.body.supplierId,
        items: req.body.items,
        userId: req.user._id
    })
    preorder.save()
    .then(result => {
        res.status(200).json(result)
    })
}

exports.putTerima = async (req, res) => {
    const id = mongoose.Types.ObjectId(req.body._id);
    const itemId = mongoose.Types.ObjectId(req.body.itemId);
    await PreoderModel.updateOne({_id:id, 'items._id': itemId },
        {$set: {'items.$.status': 'Terima'}}
    )
    res.status(200).json('OK');
}
exports.putSelesai = async (req, res) => {
    const id = mongoose.Types.ObjectId(req.body._id);
    const itemId = mongoose.Types.ObjectId(req.body.itemId);
    await PreoderModel.updateOne({_id: id, 'items._id': itemId}, 
        {$set: {'items.$.status' : 'Selesai'}}
    )
    res.status(200).json('OK')
}
exports.putTolak = async (req, res) => {
    const id = mongoose.Types.ObjectId(req.body._id);
    const itemId = mongoose.Types.ObjectId(req.body.itemId);
    const description = req.body.description
    await PreoderModel.updateOne({_id: id, 'items._id': itemId}, 
        {$set: {'items.$.status': 'Tolak', 'items.$.description': description}}
    )
    res.status(200).json('OK');
}

exports.getProses = (req, res) => {
    const supplierId = mongoose.Types.ObjectId(req.params.id)
    const search = req.query.search
    PreoderModel.aggregate([
        {$unwind: '$items'},
        {$addFields: {
            itemId: '$items._id',
            productId: '$items.productId',
            name: '$items.name',
            sku: '$items.sku',
            qty: '$items.qty',
            status: '$items.status',
        }},
        {$unset: 'items'},
        {$match: {$and: [{supplierId: supplierId}, {status: 'Terima'}, {$or: [{name: {$regex: '.*'+search+'.*', $options: 'i'}}, {sku: {$regex: '.*'+search+'.*', $options: 'i'}}]}]}},
        {$lookup: {
            from: 'products',
            foreignField: '_id',
            localField: 'productId',
            as: 'image'
        }},
        {$unwind: '$image'},
        {$addFields: {
            image: '$image.imageVarian'
        }},
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
        {$sort: {updatedAt: -1}},
    ])
    .then(result => {
        res.status(200).json(result)
    })
}

exports.getSelesai = (req, res) => {
    const supplierId = mongoose.Types.ObjectId(req.params.id)
    const search = req.query.search
    PreoderModel.aggregate([
        {$unwind: '$items'},
        {$addFields: {
            itemId: '$items._id',
            productId: '$items.productId',
            name: '$items.name',
            sku: '$items.sku',
            qty: '$items.qty',
            status: '$items.status',
        }},
        {$unset: 'items'},
        {$match: {$and: [{supplierId: supplierId}, {status: 'Selesai'}, {$or: [{name: {$regex: '.*'+search+'.*', $options: 'i'}}, {sku: {$regex: '.*'+search+'.*', $options: 'i'}}]}]}},
        {$lookup: {
            from: 'products',
            foreignField: '_id',
            localField: 'productId',
            as: 'image'
        }},
        {$unwind: '$image'},
        {$addFields: {
            image: '$image.imageVarian'
        }},
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
        {$sort: {updatedAt: -1}},
        {$limit: 30}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}

exports.getTolak = (req, res) => {
    const supplierId = mongoose.Types.ObjectId(req.params.id)
    const search = req.query.search
    PreoderModel.aggregate([
        {$unwind: '$items'},
        {$addFields: {
            itemId: '$items._id',
            productId: '$items.productId',
            name: '$items.name',
            sku: '$items.sku',
            qty: '$items.qty',
            status: '$items.status',
            description: '$items.description'
        }},
        {$unset: 'items'},
        {$match: {$and: [{supplierId: supplierId}, {status: 'Tolak'}, {$or: [{name: {$regex: '.*'+search+'.*', $options: 'i'}}, {sku: {$regex: '.*'+search+'.*', $options: 'i'}}]}]}},
        {$lookup: {
            from: 'products',
            foreignField: '_id',
            localField: 'productId',
            as: 'image'
        }},
        {$unwind: '$image'},
        {$addFields: {
            image: '$image.imageVarian'
        }},
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
        {$sort: {updatedAt: -1}},
        {$limit: 30}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}