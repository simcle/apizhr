const Brands = require('../models/brands');
const Categories = require('../models/categories');
const Products = require('../models/products');
const mongoose = require('mongoose');
const sharp = require('sharp');
const fs = require('fs');

exports.getProductBySku = (req, res) => {
    const shopId = req.user.shopId
    const sku = req.query.sku
    Products.aggregate([
        {$match: {$and: [{sku: {$exists: true}}, {sku: sku}]}},
        {$lookup: {
            from: 'inventories',
            localField: '_id',
            foreignField: 'productId',
            pipeline: [
                {$match: {shopId: shopId}}
            ],
            as: 'inventories'
        }},
        {$unwind: {
            path: '$inventories',
            preserveNullAndEmptyArrays: true
        }},
        {$addFields: {
            onHand: '$inventories.qty'
        }},
        {$project: {
            name: 1,
            sku: 1,
            purchase: 1,
            nettPrice: 1,
            price: 1,
            onHand: 1
        }}
    ])
    .then(product => {
        res.status(200).json(product[0])
    })

}

exports.getFilter = (req, res) => {
    const products = Products.aggregate([
        {$match: {sku: {$exists: true}}},
        {$group: {
            _id: null,
            allProducts: {$sum: 1},
            active: {$sum: {$cond: [{$eq: ['$isActive',true]}, 1, 0]}},
            inactive: {$sum: {$cond: [{$eq: ['$isActive',false]}, 1, 0]}},
        }},
        {$project: {
            _id: 0
        }}
    ])
    const categories = Categories.find()
    const brands = Brands.find()
    Promise.all([
        categories,
        brands,
        products
    ])
    .then(result => {
        res.status(200).json({
            categories: result[0],
            brands: result[1],
            products: result[2][0]
        })
    })
}


exports.getAllProducts = (req, res) => {
    const search = req.query.search
    const currentPage = req.query.page || 1
    const perPage = req.query.perPage || 20
    const brands = req.query.brands
    const categories = req.query.categories
    let brandIds;
    let categoryIds;
    if(brands) { 
        const brandObjectId = [];
        for(let i = 0; i < brands.length; i++) {
            brandObjectId.push(mongoose.Types.ObjectId(brands[i]))
        }
        brandIds = {brandId: {$in: brandObjectId}}
    } else {
        brandIds = {}
    }
    if(categories) {
        const categoryObjectId = [];
        for (let i = 0; i < categories.length; i++) {
            categoryObjectId.push(mongoose.Types.ObjectId(categories[i]))
        }
        categoryIds = {categoryId: {$in: categoryObjectId}}
    } else {
        categoryIds = {}
    }
    const boolStatus = []
    for(let i = 0; i < req.query.status.length; i++) {
        const el = req.query.status[i]
        if(el == 'true') {
            boolStatus.push(true)
        } else {
            boolStatus.push(false)
        }
    }
    const status = {isActive: {$in: boolStatus}}
    let totalItems;
    Products.find({$and: [{sku: {$exists: true}}, {$or: [{name: {$regex: '.*'+search+'.*', $options: 'i'}}, {sku: {$regex: '.*'+search+'.*', $options: 'i'}}]}, brandIds, categoryIds, status]})
    .countDocuments()
    .then(count => {
        totalItems = count
        return Products.aggregate([
            {$match: {$and: [{sku: {$exists: true}}, {$or: [{name: {$regex: '.*'+search+'.*', $options: 'i'}}, {sku: {$regex: '.*'+search+'.*', $options: 'i'}}]}, brandIds, categoryIds, status]}},
            {$lookup: {
                from: 'categories',
                localField: 'categoryId',
                foreignField: '_id',
                as: 'categories'
            }},
            {$unwind: {
                path: '$categories',
                preserveNullAndEmptyArrays: true
            }},
            {$lookup: {
                from: 'brands',
                localField: 'brandId',
                foreignField: '_id',
                as: 'brands'
            }},
            {$unwind: {
                path: '$brands',
                preserveNullAndEmptyArrays: true
            }},
            {$addFields: {
                category: '$categories.name',
                brand: '$brands.name'
            }},
            {$project: {
                name: 1,
                brand: 1,
                brandId: 1,
                categoryId: 1,
                category: 1,
                sku: 1,
                price: 1,
                stock: 1,
                isActive: 1,
                createdAt: 1
            }},
            {$sort: {createdAt: -1}},
            {$skip: (currentPage -1) * perPage},
            {$limit: perPage},
        ])
    })
    .then(result => {
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
    .catch(err => {
        console.log(err);
    })
}

// PRODUCT DETAIL
exports.getDetail = (req, res) => {
    const productId = mongoose.Types.ObjectId(req.params.productId)
    const ProductOverview = Products.aggregate([
        {$match: {_id: productId}},
        {$lookup: {
            from: 'brands',
            localField: 'brandId',
            foreignField: '_id',
            as: 'brands'
        }},
        {$unwind: {
            path: '$brands',
            preserveNullAndEmptyArrays: true
        }},
        {$lookup: {
            from: 'categories',
            localField: 'categoryId',
            foreignField: '_id',
            as: 'categories'
        }},
        {$unwind: {
            path: '$categories',
            preserveNullAndEmptyArrays: true
        }},
        {$addFields: {
            'brand': '$brands.name',
            'category': '$categories.name'
        }},
        {$unset: 'brands'},
        {$unset: 'categories'},

       
    ])

    Promise.all([
        ProductOverview
    ])
    .then(result => {
        res.status(200).json({
            overview: result[0][0]
        })
    })
}

// POST NEW PRODUCT
exports.postProduct = async (req, res) => {
    const isVarian = req.body.isVarian
    const images = req.files.images
    const imagesList = []
    const userId = req.user._id
    if(images) {
        for await (const image of images) {
            let filePath = `./public/img/products/700/${image.filename}`;
            let filePathSmall = `./public/img/products/200/${image.filename}`;
            await sharp(image.path)
            .resize({height: 700})
            .toFile(filePath);
            await sharp(image.path)
            .resize({height: 200})
            .toFile(filePathSmall)
            imagesList.push(image.filename)
        }
    }
    const imagesVarianLists = []
    if(isVarian == 'true') {
        const attributes = JSON.parse(req.body.attributes)
        const imageVarians = req.files.imageVarians
        for(let i = 0; i < imageVarians.length; i++) {
            const el = imageVarians[i].path
            if(el) {
                attributes[0].attrValues[i].image = el
            } 
        }
        const varians = JSON.parse(req.body.varians)
        const product = new Products({
            name: req.body.name,
            isVarian: true,
            images: imagesList,
            categoryId: req.body.categoryId,
            brandId: req.body.brandId,
            weight: JSON.parse(req.body.weight),
            description: req.body.description,
            attributes: attributes,
            userCreated: userId
        })
        product.save()
        .then(async (result) => {
            fs.readdir('public/img/temp', (err, files) => {
                for(const file of files) {
                    fs.unlinkSync(`public/img/temp/${file}`)
                }
            })
            
            for(let i = 0; i < attributes[0].attrValues.length; i++) {
                const el = attributes[0].attrValues[i]
                if(imageVarians[i].mimetype !== 'text/html') {
                    imagesVarianLists.push({value: el.value, path: imageVarians[i].path, filename: imageVarians[i].filename})
                } else {
                    imagesVarianLists.push({value: el.value, path: imageVarians[i].path, filename: ''})
                }
            }
            let key = Object.keys(varians[0]);
            key = key[0]
            for(let i = 0; i < varians.length; i++) {
                const el = varians[i]
                const keys = Object.keys(el)
                let names = []
                for(let key of keys) {
                    if(key != 'purchase' && key != 'nettPrice' && key != 'price') {
                        names.push(key)
                        names.push(el[key])
                    }
                }
                let name = names.join(" ")
                let productName = req.body.name+' '+name
                let image = imagesVarianLists.find(obj => obj.value == el[key])
                let sku = await generateSku()
                const product = new Products({
                    name: productName,
                    sku: sku,
                    imageVarian: image.path,
                    parentId: result._id,
                    idx: i,
                    categoryId: req.body.categoryId,
                    brandId: req.body.brandId,
                    purchase: el.purchase,
                    nettPrice: el.nettPrice,
                    price: el.price,
                    description: req.body.description,
                    weight: JSON.parse(req.body.weight),
                    userCreated: userId

                })
                await product.save()
            }
            res.status(200).json('OK')
        })

    } else {
        let sku = await generateSku()
        const product = new Products({
            name: req.body.name,
            sku: sku,
            categoryId: req.body.categoryId,
            brandId: req.body.brandId,
            images: imagesList,
            description: req.body.description,
            purchase: req.body.purchase,
            nettPrice: req.body.purchase,
            price: req.body.price,
            weight: JSON.parse(req.body.weight),
            userCreated: userId
        })
        product.save()
        .then(() => {
            fs.readdir('public/img/temp', (err, files) => {
                for(const file of files) {
                    fs.unlinkSync(`public/img/temp/${file}`)
                }
            })
            res.status(200).json('OK');
        })
    }
}


// CREATE PRODUCT
exports.createProduct = (req, res) => {
    const brands = Brands.find().lean()
    const categories = Categories.find().lean()
    Promise.all([
        brands,
        categories
    ])
    .then(result => {
        res.status(200).json({
            brands: result[0].map(obj => {
                obj.id = obj._id,
                obj.text = obj.name
                return obj
            }),
            categories: result[1].map(obj => {
                obj.id = obj._id,
                obj.text = obj.name
                return obj
            })
        })
    })
}

// EDIT PRODUCT
exports.editProduct = async (req, res) => {
    const productId = req.params.productId
    const brands = Brands.find().lean()
    const categories = Categories.find().lean()
    Products.findById(productId)
    .then(async (result) => {
        if(result.parentId) {
            const id = mongoose.Types.ObjectId(result.parentId)
            const product = Products.aggregate([
                {$match: {_id: id}},
                {$lookup: {
                    from: 'products',
                    foreignField: 'parentId',
                    localField: '_id',
                    pipeline: [
                        {$project: {
                            _id: 1,
                            idx: 1,
                            purchase: 1,
                            price: 1,
                            nettPrice: 1
                        }},
                        {$sort: {idx: 1}}
                    ],
                    as: 'lists'
                }},
            ])

            Promise.all([
                product,
                brands,
                categories
            ])
            .then(result => {
                res.status(200).json({
                    product: result[0][0],
                     brands: result[1].map(obj => {
                        obj.id = obj._id,
                        obj.text = obj.name
                        return obj
                    }),
                    categories: result[2].map(obj => {
                        obj.id = obj._id,
                        obj.text = obj.name
                        return obj
                    })
                })
            })
        } else {
           const product = Products.findById(productId)
           Promise.all([
                product,
                brands,
                categories
            ])
            .then(result => {
                res.status(200).json({
                    product: result[0],
                    brands: result[1].map(obj => {
                        obj.id = obj._id,
                        obj.text = obj.name
                        return obj
                    }),
                    categories: result[2].map(obj => {
                        obj.id = obj._id,
                        obj.text = obj.name
                        return obj
                    })
                })
            })
        }
    })
  
}

exports.updateProduct = async (req, res) => {
    const images = req.files.images
    const imagesList = []
    const isVarian = req.body.isVarian
    const userId = req.user._id
    try {
        Products.findById(req.params.productId)
        .then(async (product) => {
            const oldImage = product.images
            for (const img of oldImage) {
                if(fs.existsSync(`public/img/products/700/${img}`)) {
                    fs.unlinkSync(`public/img/products/700/${img}`)
                    fs.unlinkSync(`public/img/products/200/${img}`)
                }
            }
            if(images) {
                for await (const image of images) {
                    let filePath = `./public/img/products/700/${image.filename}`;
                    let filePathSmall = `./public/img/products/200/${image.filename}`;
                    await sharp(image.path)
                    .resize({height: 700})
                    .toFile(filePath);
                    await sharp(image.path)
                    .resize({height: 200})
                    .toFile(filePathSmall)
                    imagesList.push(image.filename)
                }
            }
            if(isVarian == 'true') {
                const attributes = JSON.parse(req.body.attributes)
                const imageVarians = req.files.imageVarians
                const imagesVarianLists = []
                for(let i = 0; i < imageVarians.length; i++) {
                    const el = imageVarians[i].path
                    if(el) {
                        attributes[0].attrValues[i].image = el
                    } 
                }
                const varians = JSON.parse(req.body.varians)
                product.name= req.body.name,
                product.isVarian= true,
                product.images= imagesList,
                product.categoryId= req.body.categoryId,
                product.brandId= req.body.brandId,
                product.weight= JSON.parse(req.body.weight),
                product.description= req.body.description,
                product.attributes= attributes,
                product.userUpdated = userId
                product.save()
                .then(async (result) => {
                    fs.readdir('public/img/temp', (err, files) => {
                        for(const file of files) {
                            fs.unlinkSync(`public/img/temp/${file}`)
                        }
                    })
                    
                    for(let i = 0; i < attributes[0].attrValues.length; i++) {
                        const el = attributes[0].attrValues[i]
                        if(imageVarians[i].mimetype !== 'text/html') {
                            imagesVarianLists.push({value: el.value, path: imageVarians[i].path, filename: imageVarians[i].filename})
                        } else {
                            imagesVarianLists.push({value: el.value, path: imageVarians[i].path, filename: ''})
                        }
                    }
                    let key = Object.keys(varians[0]);
                    key = key[0]
                    for (let i = 0; i < varians.length; i++) {
                        const el = varians[i]
                        const keys = Object.keys(el)
                        let names = []
                        for(let key of keys) {
                            if(key != 'purchase' && key != 'nettPrice' && key != 'price' && key != '_id') {
                                names.push(key)
                                names.push(el[key])
                            }
                        }
                        let name = names.join(" ")
                        let productName = req.body.name+' '+name
                        let image = imagesVarianLists.find(obj => obj.value == el[key])
                        if(el._id) {
                            const product = await Products.findById(el._id)
                            if(fs.existsSync(product.imageVarian)) {
                                fs.unlinkSync(product.imageVarian)
                            }
                            await Products.findByIdAndUpdate( el._id, {
                                name: productName, 
                                imageVarian: image.path,
                                categoryId: req.body.categoryId,
                                brandId: req.body.brandId,
                                idx: i,
                                purchase: el.purchase, 
                                nettPrice: el.nettPrice, 
                                price: el.price,
                                description: req.body.description,
                                weight: JSON.parse(req.body.weight),
                                userUpdated: userId
                            })
                        } else {
                            let sku = await generateSku()
                            const product = new Products({
                                name: productName,
                                sku: sku,
                                idx: i,
                                imageVarian: image.path,
                                parentId: result._id,
                                categoryId: req.body.categoryId,
                                brandId: req.body.brandId,
                                purchase: el.purchase,
                                nettPrice: el.nettPrice,
                                price: el.price,
                                description: req.body.description,
                                weight: JSON.parse(req.body.weight),
                                userCreated: userId

                            })
                            await product.save()
                        }
                    }
                    res.status(200).json('OK')
                })
            } else {
                product.name = req.body.name
                product.categoryId = req.body.categoryId
                product.brandId = req.body.brandId
                product.images = imagesList
                product.description = req.body.description
                product.purchase = req.body.purchase
                product.nettPrice = req.body.purchase
                product.price = req.body.price
                product.weight = JSON.parse(req.body.weight)
                product.userUpdated = userId
                product.save()
                .then(() => {
                    fs.readdir('public/img/temp', (err, files) => {
                        for(const file of files) {
                            fs.unlinkSync(`public/img/temp/${file}`)
                        }
                    })
                    res.status(200).json('OK');
                })
            }
        })
    } catch (error) {
        res.status(400).send(error)
    }
}

exports.putIsActive = async (req, res) => {
    const productId = req.params.productId
    Products.findByIdAndUpdate(productId, {isActive: req.body.isActive})
    .then(() => {
        res.status(200).json('OK')
    })
}

async function generateSku () {
    let product =  await Products.findOne({sku: {$exists: true}}).sort({createdAt: -1})
    let sku;
    if(product) {
        let no = parseInt(product.sku)
        no++
        no = checkKode(no)
        function checkKode (i) {
            if(i < 10) {
                return `0000${i}`
            }
            if(i < 100) {
                return `900${i}`
            }
            if(i < 1000) {
                return `00${i}`
            } 
            if(i < 10000) {
                return `0${i}`
            } 
            if( i >= 10000) {
                return i
            }
        }
        sku = no
    } else {
        sku = `00001`
    }
    return sku
}