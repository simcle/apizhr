const Brands = require('../models/brands');
const Categories = require('../models/categories');
const Products = require('../models/products');
const mongoose = require('mongoose');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path')


function generateVariantCombinations(attributes = []) {

    if(!Array.isArray(attributes) || !attributes.length) {
        return []
    }

    const validAttributes = attributes
        .filter(attr => attr?.attrName && Array.isArray(attr.attrValues))
        .map(attr => ({
            name: attr.attrName,
            values: attr.attrValues
                .map(item => item?.value)
                .filter(value => value !== undefined && value !== null && value !== '')
        }))
        .filter(attr => attr.values.length)

    if(!validAttributes.length) {
        return []
    }

    let combinations = [{}]

    for(const attr of validAttributes) {

        combinations = combinations.flatMap(combination =>
            attr.values.map(value => ({
                ...combination,
                [attr.name]: value
            }))
        )
    }

    return combinations
}

exports.searchItems = (req, res) => {
    let search = req.query.search
    var queryString = '\"' + search.split(' ').join('\" \"') + '\"';
    Products.find({$and: [{sku: {$exists: true}}, {isActive: true} ,{$text: {$search: queryString}}]})
    .limit(20)
    .then(result => {
        res.status(200).json(result)
    })
}

exports.getProductBySku = (req, res) => {
    const shopId = mongoose.Types.ObjectId(req.user.shopId)
    const sku = req.query.sku
    Products.aggregate([
        {$match: {$and: [{sku: {$exists: true}}, {sku: sku}, {isActive: true}]}},
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
            {$sort: {stock: -1}},
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
// exports.editProduct = async (req, res) => {
//     const productId = req.params.productId
//     const brands = Brands.find().lean()
//     const categories = Categories.find().lean()
//     Products.findById(productId)
//     .then(async (result) => {
//         if(result.parentId) {
//             const id = mongoose.Types.ObjectId(result.parentId)
//             const product = Products.aggregate([
//                 {$match: {_id: id}},
//                 {$lookup: {
//                     from: 'products',
//                     foreignField: 'parentId',
//                     localField: '_id',
//                     pipeline: [
//                         {$project: {
//                             _id: 1,
//                             idx: 1,
//                             purchase: 1,
//                             price: 1,
//                             nettPrice: 1
//                         }},
//                         {$sort: {idx: 1}}
//                     ],
//                     as: 'lists'
//                 }},
//             ])

//             Promise.all([
//                 product,
//                 brands,
//                 categories
//             ])
//             .then(result => {
//                 res.status(200).json({
//                     product: result[0][0],
//                      brands: result[1].map(obj => {
//                         obj.id = obj._id,
//                         obj.text = obj.name
//                         return obj
//                     }),
//                     categories: result[2].map(obj => {
//                         obj.id = obj._id,
//                         obj.text = obj.name
//                         return obj
//                     })
//                 })
//             })
//         } else {
//            const product = Products.findById(productId)
//            Promise.all([
//                 product,
//                 brands,
//                 categories
//             ])
//             .then(result => {
//                 res.status(200).json({
//                     product: result[0],
//                     brands: result[1].map(obj => {
//                         obj.id = obj._id,
//                         obj.text = obj.name
//                         return obj
//                     }),
//                     categories: result[2].map(obj => {
//                         obj.id = obj._id,
//                         obj.text = obj.name
//                         return obj
//                     })
//                 })
//             })
//         }
//     })
  
// }

exports.editProduct = async (req, res) => {

    const productId = req.params.productId

    try {
        if(!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                status: false,
                message: 'ID product tidak valid'
            })
        }

        const selectedProduct = await Products.findById(productId).lean()

        if(!selectedProduct) {
            return res.status(404).json({
                status: false,
                message: 'Product tidak ditemukan'
            })
        }

        const masterId = selectedProduct.parentId || selectedProduct._id

        const [product, brands, categories] = await Promise.all([
            Products.findById(masterId).lean(),
            Brands.find().lean(),
            Categories.find().lean()
        ])

        if(!product) {
            return res.status(404).json({
                status: false,
                message: 'Master product tidak ditemukan'
            })
        }

        if(product.isVarian) {

            const children = await Products.find({
                parentId: product._id
            })
                .select('_id sku idx purchase nettPrice price stock isActive imageVarian')
                .sort({idx: 1})
                .lean()

            const combinations = generateVariantCombinations(product.attributes || [])

            product.lists = combinations.map((combination, index) => {

                const child = children.find(item => item.idx === index)

                return {
                    ...combination,
                    _id: child?._id || '',
                    sku: child?.sku || '',
                    idx: index,
                    purchase: child?.purchase ?? '',
                    nettPrice: child?.nettPrice ?? '',
                    price: child?.price ?? '',
                    stock: child?.stock ?? 0,
                    isActive: child?.isActive ?? true,
                    imageVarian: child?.imageVarian || ''
                }
            })
        }

        return res.status(200).json({
            product,
            brands: brands.map(item => ({
                ...item,
                id: item._id,
                text: item.name
            })),
            categories: categories.map(item => ({
                ...item,
                id: item._id,
                text: item.name
            }))
        })

    } catch(error) {

        console.error('editProduct error:', error)

        return res.status(500).json({
            status: false,
            message: 'Terjadi kesalahan saat mengambil data product'
        })
    }
}


// exports.updateProduct = async (req, res) => {
//     const images = req.files.images
//     const imagesList = []
//     const isVarian = req.body.isVarian
//     const userId = req.user._id
//     try {
//         Products.findById(req.params.productId)
//         .then(async (product) => {
//             const oldImage = product.images
//             for (const img of oldImage) {
//                 if(fs.existsSync(`public/img/products/700/${img}`)) {
//                     fs.unlinkSync(`public/img/products/700/${img}`)
//                     fs.unlinkSync(`public/img/products/200/${img}`)
//                 }
//             }
//             if(images) {
//                 for await (const image of images) {
//                     let filePath = `./public/img/products/700/${image.filename}`;
//                     let filePathSmall = `./public/img/products/200/${image.filename}`;
//                     await sharp(image.path)
//                     .resize({height: 700})
//                     .toFile(filePath);
//                     await sharp(image.path)
//                     .resize({height: 200})
//                     .toFile(filePathSmall)
//                     imagesList.push(image.filename)
//                 }
//             }
//             if(isVarian == 'true') {
//                 const attributes = JSON.parse(req.body.attributes)
//                 const imageVarians = req.files.imageVarians
//                 const imagesVarianLists = []
//                 for(let i = 0; i < imageVarians.length; i++) {
//                     const el = imageVarians[i].path
//                     if(el) {
//                         attributes[0].attrValues[i].image = el
//                     } 
//                 }
//                 const varians = JSON.parse(req.body.varians)
//                 product.name= req.body.name,
//                 product.isVarian= true,
//                 product.images= imagesList,
//                 product.categoryId= req.body.categoryId,
//                 product.brandId= req.body.brandId,
//                 product.weight= JSON.parse(req.body.weight),
//                 product.description= req.body.description,
//                 product.attributes= attributes,
//                 product.userUpdated = userId
//                 product.save()
//                 .then(async (result) => {
//                     fs.readdir('public/img/temp', (err, files) => {
//                         for(const file of files) {
//                             fs.unlinkSync(`public/img/temp/${file}`)
//                         }
//                     })
                    
//                     for(let i = 0; i < attributes[0].attrValues.length; i++) {
//                         const el = attributes[0].attrValues[i]
//                         if(imageVarians[i].mimetype !== 'text/html') {
//                             imagesVarianLists.push({value: el.value, path: imageVarians[i].path, filename: imageVarians[i].filename})
//                         } else {
//                             imagesVarianLists.push({value: el.value, path: imageVarians[i].path, filename: ''})
//                         }
//                     }
//                     let key = Object.keys(varians[0]);
//                     key = key[0]
//                     for (let i = 0; i < varians.length; i++) {
//                         const el = varians[i]
//                         const keys = Object.keys(el)
//                         let names = []
//                         for(let key of keys) {
//                             if(key != 'purchase' && key != 'nettPrice' && key != 'price' && key != '_id') {
//                                 names.push(key)
//                                 names.push(el[key])
//                             }
//                         }
//                         let name = names.join(" ")
//                         let productName = req.body.name+' '+name
//                         let image = imagesVarianLists.find(obj => obj.value == el[key])
//                         if(el._id) {
//                             const product = await Products.findById(el._id)
//                             if(fs.existsSync(product.imageVarian)) {
//                                 fs.unlinkSync(product.imageVarian)
//                             }
//                             await Products.findByIdAndUpdate( el._id, {
//                                 name: productName, 
//                                 imageVarian: image.path,
//                                 categoryId: req.body.categoryId,
//                                 brandId: req.body.brandId,
//                                 idx: i,
//                                 purchase: el.purchase, 
//                                 nettPrice: el.nettPrice, 
//                                 price: el.price,
//                                 description: req.body.description,
//                                 weight: JSON.parse(req.body.weight),
//                                 userUpdated: userId
//                             })
//                         } else {
//                             let sku = await generateSku()
//                             const product = new Products({
//                                 name: productName,
//                                 sku: sku,
//                                 idx: i,
//                                 imageVarian: image.path,
//                                 parentId: result._id,
//                                 categoryId: req.body.categoryId,
//                                 brandId: req.body.brandId,
//                                 purchase: el.purchase,
//                                 nettPrice: el.nettPrice,
//                                 price: el.price,
//                                 description: req.body.description,
//                                 weight: JSON.parse(req.body.weight),
//                                 userCreated: userId

//                             })
//                             await product.save()
//                         }
//                     }
//                     res.status(200).json('OK')
//                 })
//             } else {
//                 product.name = req.body.name
//                 product.categoryId = req.body.categoryId
//                 product.brandId = req.body.brandId
//                 product.images = imagesList
//                 product.description = req.body.description
//                 product.purchase = req.body.purchase
//                 product.nettPrice = req.body.nettPrice
//                 product.price = req.body.price
//                 product.weight = JSON.parse(req.body.weight)
//                 product.userUpdated = userId
//                 product.save()
//                 .then(() => {
//                     fs.readdir('public/img/temp', (err, files) => {
//                         for(const file of files) {
//                             fs.unlinkSync(`public/img/temp/${file}`)
//                         }
//                     })
//                     res.status(200).json('OK');
//                 })
//             }
//         })
//     } catch (error) {
//         res.status(400).send(error)
//     }
// }

function parseJSON(value, fallback = null) {
    try {
        return typeof value === 'string' ? JSON.parse(value) : value
    } catch {
        return fallback
    }
}

function normalizeFiles(files) {
    if(!files) return []
    return Array.isArray(files) ? files : [files]
}

function normalizeValue(value) {
    return String(value ?? '').trim().toLowerCase()
}

function generateVariantCombinations(attributes = []) {
    if(!Array.isArray(attributes) || !attributes.length) {
        return []
    }

    const validAttributes = attributes
        .filter(attr => attr?.attrName && Array.isArray(attr.attrValues))
        .map(attr => ({
            name: attr.attrName,
            values: attr.attrValues
                .map(item => item?.value)
                .filter(value => value !== undefined && value !== null && value !== '')
        }))
        .filter(attr => attr.values.length)

    if(!validAttributes.length) {
        return []
    }

    let combinations = [{}]

    for(const attr of validAttributes) {
        combinations = combinations.flatMap(item =>
            attr.values.map(value => ({
                ...item,
                [attr.name]: value
            }))
        )
    }

    return combinations
}

function getVariantKey(item, attributes) {
    return attributes
        .map(attr => {
            const name = normalizeValue(attr.attrName)
            const value = normalizeValue(item?.[attr.attrName])

            return `${name}:${value}`
        })
        .join('|')
}

function getVariantName(item, attributes) {
    return attributes
        .map(attr => {
            const value = item?.[attr.attrName]

            if(value === undefined || value === null || value === '') {
                return ''
            }

            return `${attr.attrName} ${value}`
        })
        .filter(Boolean)
        .join(' ')
}

async function safeUnlink(filePath) {
    try {
        if(filePath && fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath)
        }
    } catch(error) {
        console.error('Gagal menghapus file:', filePath, error.message)
    }
}

exports.updateProduct = async (req, res) => {

    const productId = req.params.productId
    const userId = req.user?._id || null

    try {
        if(!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                status: false,
                message: 'ID product tidak valid'
            })
        }

        const selectedProduct = await Products.findById(productId)

        if(!selectedProduct) {
            return res.status(404).json({
                status: false,
                message: 'Product tidak ditemukan'
            })
        }

        /*
         * Walaupun frontend sekarang mengirim parentId,
         * tetap kita amankan jika endpoint menerima childId.
         */
        let product = selectedProduct

        if(selectedProduct.parentId) {
            product = await Products.findById(selectedProduct.parentId)

            if(!product) {
                return res.status(404).json({
                    status: false,
                    message: 'Parent product tidak ditemukan'
                })
            }
        }

        const isVarian = String(req.body.isVarian) === 'true'
        const weight = parseJSON(req.body.weight)

        if(!req.body.name?.trim()) {
            return res.status(400).json({
                status: false,
                message: 'Nama product wajib diisi'
            })
        }

        if(!req.body.categoryId) {
            return res.status(400).json({
                status: false,
                message: 'Kategori product wajib diisi'
            })
        }

        if(!req.body.brandId) {
            return res.status(400).json({
                status: false,
                message: 'Brand product wajib diisi'
            })
        }

        if(!weight?.value || !weight?.unit) {
            return res.status(400).json({
                status: false,
                message: 'Berat product wajib diisi'
            })
        }

        /*
         * Untuk sekarang jangan izinkan perubahan:
         *
         * variant → non variant
         * non variant → variant
         *
         * karena berhubungan dengan SKU, stok dan history.
         */
        if(Boolean(product.isVarian) !== isVarian) {
            return res.status(400).json({
                status: false,
                message: 'Tipe product variant/non-variant tidak dapat diubah melalui proses edit'
            })
        }

        const files = req.files || {}
        const mainImages = normalizeFiles(files.images)
        const variantImages = normalizeFiles(files.imageVarians)

        /*
         * ============================================================
         * MAIN PRODUCT IMAGE
         * ============================================================
         */

        const oldMainImages = Array.isArray(product.images)
            ? [...product.images]
            : []

        const newMainImages = []

        for(const image of mainImages) {
            if(!image?.path || !image?.filename) {
                continue
            }

            if(!image.mimetype?.startsWith('image/')) {
                await safeUnlink(image.path)
                continue
            }

            const file700 = `public/img/products/700/${image.filename}`
            const file200 = `public/img/products/200/${image.filename}`

            await sharp(image.path)
                .resize({
                    height: 700,
                    withoutEnlargement: true
                })
                .toFile(file700)

            await sharp(image.path)
                .resize({
                    height: 200,
                    withoutEnlargement: true
                })
                .toFile(file200)

            newMainImages.push(image.filename)

            /*
             * File upload sementara saja yang dihapus.
             */
            if(
                path.resolve(image.path) !== path.resolve(file700) &&
                path.resolve(image.path) !== path.resolve(file200)
            ) {
                await safeUnlink(image.path)
            }
        }

        /*
         * ============================================================
         * PRODUCT VARIANT
         * ============================================================
         */

        if(isVarian) {

            const attributes = parseJSON(req.body.attributes)
            const variants = parseJSON(req.body.varians)

            if(!Array.isArray(attributes) || !attributes.length) {
                return res.status(400).json({
                    status: false,
                    message: 'Attribute variant tidak boleh kosong'
                })
            }

            if(!Array.isArray(variants) || !variants.length) {
                return res.status(400).json({
                    status: false,
                    message: 'List variant tidak boleh kosong'
                })
            }

            /*
             * Validasi attribute.
             */
            const attributeNames = new Set()

            for(const attr of attributes) {
                const attrName = String(attr?.attrName || '').trim()

                if(!attrName) {
                    return res.status(400).json({
                        status: false,
                        message: 'Nama variant tidak boleh kosong'
                    })
                }

                const attrKey = attrName.toLowerCase()

                if(attributeNames.has(attrKey)) {
                    return res.status(400).json({
                        status: false,
                        message: `Variant "${attrName}" digunakan lebih dari satu kali`
                    })
                }

                attributeNames.add(attrKey)

                if(!Array.isArray(attr.attrValues) || !attr.attrValues.length) {
                    return res.status(400).json({
                        status: false,
                        message: `Nilai variant "${attrName}" tidak boleh kosong`
                    })
                }

                const values = new Set()

                for(const item of attr.attrValues) {
                    const value = String(item?.value || '').trim()

                    if(!value) {
                        return res.status(400).json({
                            status: false,
                            message: `Nilai variant "${attrName}" tidak boleh kosong`
                        })
                    }

                    const valueKey = value.toLowerCase()

                    if(values.has(valueKey)) {
                        return res.status(400).json({
                            status: false,
                            message: `Nilai "${value}" pada variant "${attrName}" duplikat`
                        })
                    }

                    values.add(valueKey)
                }
            }

            /*
             * Pastikan jumlah list sama dengan hasil Cartesian Product.
             *
             * Contoh:
             *
             * Warna = 2
             * Size = 3
             *
             * seharusnya 6 child.
             */
            const generatedVariants = generateVariantCombinations(attributes)

            if(generatedVariants.length !== variants.length) {
                return res.status(400).json({
                    status: false,
                    message: 'Jumlah kombinasi variant tidak sesuai dengan attribute product'
                })
            }

            /*
             * Pastikan tidak ada kombinasi duplicate dari frontend.
             */
            const incomingKeys = new Set()

            for(const item of variants) {
                const key = getVariantKey(item, attributes)

                if(incomingKeys.has(key)) {
                    return res.status(400).json({
                        status: false,
                        message: 'Terdapat kombinasi variant yang duplikat'
                    })
                }

                incomingKeys.add(key)

                if(
                    item.purchase === '' ||
                    item.purchase === null ||
                    item.purchase === undefined ||
                    item.nettPrice === '' ||
                    item.nettPrice === null ||
                    item.nettPrice === undefined ||
                    item.price === '' ||
                    item.price === null ||
                    item.price === undefined
                ) {
                    return res.status(400).json({
                        status: false,
                        message: 'Harga variant belum lengkap'
                    })
                }
            }

            /*
             * ========================================================
             * RECONSTRUCT EXISTING CHILD
             * ========================================================
             *
             * Ini penting.
             *
             * Kita menggunakan attributes LAMA dari database sebelum
             * parent attributes diganti.
             */

            const oldAttributes = Array.isArray(product.attributes)
                ? JSON.parse(JSON.stringify(product.attributes))
                : []

            const oldCombinations = generateVariantCombinations(oldAttributes)

            const existingChildren = await Products.find({
                parentId: product._id
            })
                .sort({
                    idx: 1,
                    createdAt: 1
                })

            /*
             * childId → child
             */
            const childById = new Map()

            /*
             * combination → child
             *
             * Digunakan sebagai fallback jika karena bug frontend
             * _id tidak terkirim.
             */
            const childByVariant = new Map()

            for(const child of existingChildren) {
                childById.set(String(child._id), child)

                const combination = oldCombinations[child.idx]

                if(!combination) {
                    continue
                }

                const key = getVariantKey(combination, oldAttributes)

                /*
                 * Kalau database sudah punya duplicate existing,
                 * jangan overwrite canonical child.
                 */
                if(!childByVariant.has(key)) {
                    childByVariant.set(key, child)
                }
            }

            /*
             * ========================================================
             * VARIANT IMAGE
             * ========================================================
             */

            const oldVisualAttribute = oldAttributes[0]
            const newVisualAttribute = attributes[0]

            const oldImageMap = new Map()

            if(oldVisualAttribute?.attrValues) {
                for(const item of oldVisualAttribute.attrValues) {
                    oldImageMap.set(
                        normalizeValue(item.value),
                        item.image || ''
                    )
                }
            }

            const variantImageMap = new Map()

            if(newVisualAttribute?.attrValues) {
                for(let i = 0; i < newVisualAttribute.attrValues.length; i++) {
                    const attrValue = newVisualAttribute.attrValues[i]
                    const file = variantImages[i]

                    let imagePath = oldImageMap.get(
                        normalizeValue(attrValue.value)
                    ) || ''

                    /*
                     * Hanya file IMAGE yang boleh menjadi image variant.
                     *
                     * text/html tidak akan masuk database lagi.
                     */
                    if(file?.path) {
                        if(file.mimetype?.startsWith('image/')) {
                            imagePath = file.path
                        } else {
                            await safeUnlink(file.path)
                        }
                    }

                    attrValue.image = imagePath

                    variantImageMap.set(
                        normalizeValue(attrValue.value),
                        imagePath
                    )
                }
            }

            /*
             * ========================================================
             * UPDATE / CREATE CHILD SKU
             * ========================================================
             */

            const usedChildIds = new Set()

            for(let i = 0; i < variants.length; i++) {

                const item = variants[i]

                let child = null

                /*
                 * PRIORITAS 1
                 *
                 * Gunakan _id yang dikirim frontend.
                 */
                if(item._id) {
                    if(!mongoose.Types.ObjectId.isValid(item._id)) {
                        return res.status(400).json({
                            status: false,
                            message: 'ID variant product tidak valid'
                        })
                    }

                    child = childById.get(String(item._id))

                    if(!child) {
                        return res.status(400).json({
                            status: false,
                            message: 'Variant product tidak ditemukan pada parent product ini'
                        })
                    }
                }

                /*
                 * PRIORITAS 2
                 *
                 * Kalau _id hilang karena bug frontend,
                 * coba recovery berdasarkan kombinasi lama.
                 *
                 * Ini yang mencegah child existing dibuat ulang.
                 */
                if(!child) {
                    const key = getVariantKey(item, attributes)

                    /*
                     * Fallback hanya bisa dilakukan ketika struktur
                     * nama attributes lama dan baru sama.
                     */
                    const sameAttributeStructure =
                        oldAttributes.length === attributes.length &&
                        oldAttributes.every((attr, index) =>
                            normalizeValue(attr.attrName) ===
                            normalizeValue(attributes[index]?.attrName)
                        )

                    if(sameAttributeStructure) {
                        child = childByVariant.get(key) || null
                    }
                }

                /*
                 * Satu child tidak boleh digunakan oleh dua combination.
                 */
                if(child && usedChildIds.has(String(child._id))) {
                    return res.status(409).json({
                        status: false,
                        message: 'Satu SKU terdeteksi digunakan oleh lebih dari satu kombinasi variant'
                    })
                }

                const variantName = getVariantName(item, attributes)

                const firstAttributeValue = item[newVisualAttribute.attrName]

                const imageVarian =
                    variantImageMap.get(
                        normalizeValue(firstAttributeValue)
                    ) || ''

                /*
                 * ====================================================
                 * EXISTING CHILD
                 * ====================================================
                 */

                if(child) {
                    child.name = `${req.body.name} ${variantName}`.trim()
                    child.categoryId = req.body.categoryId
                    child.brandId = req.body.brandId
                    child.idx = i
                    child.purchase = Number(item.purchase)
                    child.nettPrice = Number(item.nettPrice)
                    child.price = Number(item.price)
                    child.description = req.body.description
                    child.weight = weight
                    child.imageVarian = imageVarian
                    child.isActive = true
                    child.userUpdated = userId

                    await child.save()

                    usedChildIds.add(String(child._id))

                    continue
                }

                /*
                 * ====================================================
                 * NEW CHILD
                 * ====================================================
                 */

                const sku = await generateSku()

                const newChild = new Products({
                    name: `${req.body.name} ${variantName}`.trim(),
                    sku,
                    parentId: product._id,
                    categoryId: req.body.categoryId,
                    brandId: req.body.brandId,
                    isActive: true,
                    images: [],
                    imageVarian,
                    idx: i,
                    purchase: Number(item.purchase),
                    nettPrice: Number(item.nettPrice),
                    price: Number(item.price),
                    attributes: [],
                    description: req.body.description,
                    weight,
                    userCreated: userId
                })

                await newChild.save()

                usedChildIds.add(String(newChild._id))
            }

            /*
             * ========================================================
             * CHILD YANG TIDAK ADA DI PAYLOAD
             * ========================================================
             *
             * JANGAN DELETE.
             *
             * Karena mungkin sudah mempunyai:
             * - stock
             * - sales
             * - receipts
             * - transfer
             * - stock opname
             *
             * Kita nonaktifkan saja.
             */

            for(const child of existingChildren) {
                if(usedChildIds.has(String(child._id))) {
                    continue
                }

                if(child.isActive !== false) {
                    child.isActive = false
                    child.userUpdated = userId

                    await child.save()
                }
            }

            /*
             * ========================================================
             * UPDATE PARENT
             * ========================================================
             *
             * Dilakukan SETELAH seluruh validation selesai.
             */

            product.name = req.body.name
            product.isVarian = true
            product.categoryId = req.body.categoryId
            product.brandId = req.body.brandId
            product.description = req.body.description
            product.weight = weight
            product.attributes = attributes
            product.userUpdated = userId

            /*
             * Karena ProductEdit existing memang selalu upload ulang
             * image yang masih dipertahankan.
             */
            product.images = newMainImages

            await product.save()

            /*
             * ========================================================
             * CLEANUP MAIN IMAGE LAMA
             * ========================================================
             */

            for(const image of oldMainImages) {
                if(newMainImages.includes(image)) {
                    continue
                }

                await safeUnlink(`public/img/products/700/${image}`)
                await safeUnlink(`public/img/products/200/${image}`)
            }

            /*
             * ========================================================
             * CLEANUP VARIANT IMAGE LAMA
             * ========================================================
             */

            const usedVariantImages = new Set(
                attributes[0]?.attrValues
                    ?.map(item => item.image)
                    .filter(Boolean) || []
            )

            const oldVariantImages = new Set(
                oldAttributes[0]?.attrValues
                    ?.map(item => item.image)
                    .filter(Boolean) || []
            )

            for(const image of oldVariantImages) {
                if(!usedVariantImages.has(image)) {
                    await safeUnlink(image)
                }
            }

            return res.status(200).json({
                status: true,
                message: 'Product berhasil diperbarui'
            })
        }

        /*
         * ============================================================
         * NON VARIANT PRODUCT
         * ============================================================
         */

        if(
            req.body.purchase === '' ||
            req.body.purchase === undefined ||
            req.body.nettPrice === '' ||
            req.body.nettPrice === undefined ||
            req.body.price === '' ||
            req.body.price === undefined
        ) {
            return res.status(400).json({
                status: false,
                message: 'Harga product belum lengkap'
            })
        }

        product.name = req.body.name
        product.categoryId = req.body.categoryId
        product.brandId = req.body.brandId
        product.description = req.body.description
        product.purchase = Number(req.body.purchase)
        product.nettPrice = Number(req.body.nettPrice)
        product.price = Number(req.body.price)
        product.weight = weight
        product.images = newMainImages
        product.userUpdated = userId

        await product.save()

        for(const image of oldMainImages) {
            if(newMainImages.includes(image)) {
                continue
            }

            await safeUnlink(`public/img/products/700/${image}`)
            await safeUnlink(`public/img/products/200/${image}`)
        }

        return res.status(200).json({
            status: true,
            message: 'Product berhasil diperbarui'
        })

    } catch(error) {
        console.error('updateProduct error:', error)

        return res.status(500).json({
            status: false,
            message: 'Terjadi kesalahan saat memperbarui product'
        })
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
                return `000${i}`
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

exports.printBarcode = (req, res) => {
    const sku = req.query.sku
    Products.aggregate([
        {$match: {$and: [{sku: {$exists: true}}, {sku: sku}]}},
        {$lookup: {
            from: 'products',
            foreignField: '_id',
            localField: 'parentId',
            as: 'parent'
        }},
        {$unwind: {
            path: '$parent',
            preserveNullAndEmptyArrays: true
        }},
        {$addFields: {
            parent: '$parent.name'
        }}
    ])
    .then(result => {
        res.status(200).json(result[0])
    })
}
