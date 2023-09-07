const CustomerModel = require('../models/customer');

exports.getAllCustomer = (req, res) => {
    const search = req.query.search;
    const currentPage = req.query.page || 1;
    const perPage = req.query.perPage || 10;
    let totalItems;
    CustomerModel.find({name: {$regex: ',*'+search, $options: 'i'}})
    .countDocuments()
    .then(count => {
        totalItems = count
        return CustomerModel.aggregate([
            {$match: {name: {$regex: '.*'+search, $options: 'i'}}},
            {$lookup: {
                from: 'marketplaces',
                foreignField: '_id',
                localField: 'marketplaceId',
                as: 'marketplace'
            }},
            {$unwind: '$marketplace'},
            {$addFields: {
                marketplace: '$marketplace.name',
                marketplaceLogo: '$marketplace.logo'
            }},
            {$sort: {createdAt: -1}},
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
        })
    })
    .catch(err => {
        res.status(400).send(err);
    });
}

exports.searchCustomer = (req, res) => {
    const search = req.query.search
    CustomerModel.find({$and: [{name: {$regex: '.*'+search+'.*', $options: 'i'}}, {type: 'Retail'}]})
    .limit(10)
    .sort({name: 1})
    .then(result => {
        res.status(200).json(result)
    })
},
exports.searchDropshipper = (req, res) => {
    const search = req.query.search
    CustomerModel.find({$and: [{name: {$regex: '.*'+search+'.*', $options: 'i'}}, {type: 'Dropship'}]})
    .limit(10)
    .sort({name: 1})
    .then(result => {
        res.status(200).json(result)
    })
}

exports.insertCustomer = (req, res) => {
    const customer = new CustomerModel({
        name: req.body.name,
        marketplaceId: req.body.marketplaceId,
        mobile: req.body.mobile,
        address: req.body.address,
        subdistrictId: req.body.subdistrictId,
        subdistrictName: req.body.subdistrictName,
        cityId: req.body.cityId,
        cityName: req.body.cityName,
        provinceId: req.body.provinceId,
        provinceName: req.body.provinceName,
        zip: req.body.zip,
        userId: req.user._id
    })
    customer.save()
    .then(result => {
        res.status(200).json(result)
    })
}

exports.updateCustomer = (req, res) => {
    CustomerModel.findById(req.body._id)
    .then(customer => {
        customer.name = req.body.name
        customer.marketplaceId = req.body.marketplaceId
        customer.mobile = req.body.mobile
        customer.address = req.body.address
        customer.subdistrictId = req.body.subdistrictId
        customer.subdistrictName = req.body.subdistrictName
        customer.cityId = req.body.cityId
        customer.cityName = req.body.cityName
        customer.provinceId = req.body.provinceId
        customer.provinceName = req.body.provinceName
        customer.zip = req.body.zip
        customer.userId = req.user._id
        return customer.save()
    })
    .then (() => {
        res.status(200).json('OK')
    })
}

exports.insertDropshipper = (req, res) => {
    let customers = {
        dropship: '',
        customer: ''
    };
    const dropship = new CustomerModel({
        name: req.body.dropshipperName,
        mobile: req.body.dropshipperMobile,
        marketplaceId: req.body.marketplaceId,
        type: 'Dropship'
    })
    dropship.save()
    .then(result => {
        customers.dropship = result
        const customer = new CustomerModel({
            name: req.body.name,
            marketplaceId: req.body.marketplaceId,
            mobile: req.body.mobile,
            address: req.body.address,
            subdistrictId: req.body.subdistrictId,
            subdistrictName: req.body.subdistrictName,
            cityId: req.body.cityId,
            cityName: req.body.cityName,
            provinceId: req.body.provinceId,
            provinceName: req.body.provinceName,
            zip: req.body.zip,
            userId: req.user._id
        })
        return customer.save()
    })
    .then(result => {
        customers.customer = result
        res.status(200).json(customers)
    })
}