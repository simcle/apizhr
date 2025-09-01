const mongoose = require('mongoose');
const InventoryModel = require('../models/inventory');
const ProductModel = require('../models/products');

exports.getStock = (req, res) => {
    const productId = mongoose.Types.ObjectId(req.params.productId)
    InventoryModel.aggregate([
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
        }}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}

exports.getStockBarang = (req, res) => {
    const search = req.query.search
    var queryString = '\"' + search.split(' ').join('\" \"') + '\"';
    ProductModel.aggregate([
        {$match: {$text: {$search: queryString}}},
        {$project: {
            _id: 1,
            sku: 1,
            name: 1,
            score: {$meta: 'textScore'}
        }},
        {$sort: {score: -1}},
        {$lookup: {
            from: 'inventories',
            localField: '_id',
            foreignField: 'productId',
            as: 'inventory'
        }},
        {$project: {
            _id: 0,
            name: 1,
            sku: 1,
            inventory: 1,
            score: 1
        }},
        {$unwind: '$inventory'},
        {$replaceRoot: {newRoot: {$mergeObjects: ['$$ROOT', '$inventory']}}},
        {$project: {
            _id: 1,
            name: 1,
            sku: 1,
            shopId: 1,
            productId: 1,
            qty: 1,
            score: 1
        }},
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
        {$limit: 10}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}

exports.getStockBarangOnline = (req, res) => {
    const search = req.query.search
    var queryString = '\"' + search.split(' ').join('\" \"') + '\"';
    ProductModel.aggregate([
        {$match: {$text: {$search: queryString}}},
        {$project: {
            _id: 1,
            sku: 1,
            name: 1,
            score: {$meta: 'textScore'}
        }},
        {$sort: {score: -1}},
        {$lookup: {
            from: 'inventories',
            localField: '_id',
            foreignField: 'productId',
            as: 'inventory'
        }},
        {$project: {
            _id: 0,
            name: 1,
            sku: 1,
            inventory: 1
        }},
        {$unwind: '$inventory'},
        {$replaceRoot: {newRoot: {$mergeObjects: ['$$ROOT', '$inventory']}}},
        {$project: {
            _id: 1,
            name: 1,
            sku: 1,
            shopId: 1,
            productId: 1,
            qty: 1
        }},
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
        {$limit: 20}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}

exports.getStockBarangMobile = (req, res) => {
    
    const search = req.query.search
    var queryString = '\"' + search.split(' ').join('\" \"') + '\"';
    ProductModel.aggregate([
        { $match: { $text: { $search: queryString } } },
        // {$limit: 20},
        { $project: { 
            _id: 1,
            sku: 1,
            name: 1,
            score: { $meta: 'textScore' } 
        }},
        
        // Lookup Inventory dari 'inventories'
        { $lookup: { 
            from: 'inventories', 
            localField: '_id', 
            foreignField: 'productId', 
            as: 'inventory' 
        }},
        {$unwind: {
            path: '$inventory',
            preserveNullAndEmptyArrays: true
        }},
        // Lookup Shop untuk setiap inventory
        { $lookup: { 
            from: 'shops', 
            localField: 'inventory.shopId', 
            foreignField: '_id', 
            as: 'inventory.shop' 
        }},
        {$unwind: {
            path: '$inventory.shop',
            preserveNullAndEmptyArrays: true
        }},
        {$addFields: {
            'inventory.shop': '$inventory.shop.name',
        }},
        {$group: {
            _id: '$_id',
            sku: { $first: '$sku' },
            name: { $first: '$name' },
            inventory: { $push: '$inventory' },
            score: {$first: '$score'}
        }},
        // Lookup Mitra Inventory dari 'mitrainventories'
        { $lookup: { 
            from: 'mitrainventories', 
            localField: '_id', 
            foreignField: 'productId', 
            as: 'mitrainventory' 
        }},
        {$unwind: {
            path: '$mitrainventory',
            preserveNullAndEmptyArrays: true
        }},
        // Lookup Mitra dari 'mitras'
        { $lookup: { 
            from: 'mitras', 
            localField: 'mitrainventory.mitraId', 
            foreignField: '_id', 
            as: 'mitrainventory.shop' 
        }},
        {$unwind: {
            path: '$mitrainventory.shop',
            preserveNullAndEmptyArrays: true
        }},
        {$addFields: {
            'mitrainventory.shop': '$mitrainventory.shop.name'
        }},
        {$group: {
            _id: '$_id',
            sku: { $first: '$sku' },
            name: { $first: '$name' },
            inventory: { $first: '$inventory' },
            mitrainventory: { $push: '$mitrainventory' },
            score: { $first: '$score'}
        }},
        // Gabungkan inventory dan mitrainventory ke dalam satu array 'shop'
        {
            $addFields: {
                shop: { 
                    $concatArrays: [
                        { $ifNull: ["$inventory", []] }, 
                        { $ifNull: ["$mitrainventory", []] }
                    ] 
                }
            }
        },
        {$unwind: '$shop'},
        {$match: {shop: {$ne: {}}}},

        // Sort berdasarkan inventory qty tertinggi
        
        { $sort: { 'shop.qty': -1 } },
    
        // Grouping berdasarkan _id agar data tidak duplikat
        { $group: {
            _id: '$_id',
            sku: { $first: '$sku' },
            name: { $first: '$name' },
            shop: { $push: '$shop' },
            total: {$sum: '$shop.qty'},
            score: { $first: '$score' }
        }},
        { $sort: {score: -1, total: -1, }},
        // { $limit: 20 }
    ])
    .then(result => {
        res.status(200).json(result);
    })
    .catch(error => {
        res.status(500).json({ error: error.message });
    });

}