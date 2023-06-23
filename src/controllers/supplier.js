const SupplierModel = require('../models/supplier');

exports.insertSupplier = (req, res) => {
    const supplier = new SupplierModel({
        name: req.body.name,
        userId: req.user._id
    })
    supplier.save()
    .then(result => {
        res.status(200).json(result)
    })
}

exports.getSupplier = (req, res) => {
    const search = req.query.search
    SupplierModel.find({name: {$regex: '.*'+search+'.*', $options: 'i'}})
    .limit(5)
    .then(result => {
        res.status(200).json(result)
    })
}