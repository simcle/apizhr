const {validationResult, Result} = require('express-validator');

const Company = require('../models/company');

exports.uploadCompanyLogo = (req, res) => {
    res.status(201).json({img: req.file.path});
}
exports.getCompany = (req, res) => {
    Company.findOne()
    .then(result => {
        res.status(200).json(result)
    })
}
exports.postCompnay = (req, res) => {
    const errors = validationResult(req)
    if(!errors.isEmpty()) return res.status(400).send(errors);

    Company.findOne()
    .then(result => {
        if(!result) {
            const company = new Company({
                name: req.body.name,
                tagline: req.body.tagline,
                description: req.body.description,
                phone: req.body.phone,
                fax: req.body.fax,
                email: req.body.email,
                website: req.body.website,
                companyAddress: req.body.companyAddress,
                shippingAddress: req.body.shippingAddress,
                billingAddress: req.body.billingAddress
            });
            return company.save()
        } else {
            result.name = req.body.name;
            result.tagline = req.body.tagline;
            result.description = req.body.description;
            result.phone = req.body.phone;
            result.fax = req.body.fax;
            result.email = req.body.email;
            result.website = req.body.website;
            result.companyAddress = req.body.companyAddress;
            result.shippingAddress = req.body.shippingAddress;
            result.billingAddress = req.body.billingAddress;
            return result.save()
        }
    })
    .then(result => {
        res.status(200).json(result);
    })
    
}