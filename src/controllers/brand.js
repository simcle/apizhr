const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const Brand = require('../models/brands');

exports.getBrands = (req, res) => {
    const search = req.query.search
    const currentPage = req.query.page || 1
    const perPage = req.query.perPage || 20
    let totalItems;
    Brand.find({name: {$regex: '.*'+search+'.*', $options: 'i'}})
    .countDocuments()
    .then(count => {
        totalItems = count
        return Brand.find({name: {$regex: '^.*'+search+'.*', $options: 'i'}})
        .skip((currentPage -1) * perPage)
        .limit(perPage)
        .sort({createdAt: 'desc'})
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
    })
}

exports.postBrand = async (req, res) => {
    let fileName = '';
    if(req.file) {
        const {filename: image} = req.file
        const filePath = `./public/img/brands/${req.file.filename}`
        await sharp(req.file.path)
        .resize({height: 80})
        .toFile(filePath);
        fs.unlinkSync(req.file.path)
        fileName = `public/img/brands/${req.file.filename}`;
    } else {
        fileName = ''
    }
    const brand = new Brand({
        name: req.body.name,
        description: req.body.description,
        logo: fileName
    })
    brand.save()
    .then(result => {
        res.status(200).json(result);
    })
    .catch(err => {
        res.status(400).send(err);
    });
};

exports.putBrand = async (req, res) => {
    let fileName = '';
    if(req.file) {
        const {filename: image} = req.file
        const filePath = `./public/img/brands/${req.file.filename}`
        await sharp(req.file.path)
        .resize({height: 80})
        .toFile(filePath);
        fs.unlinkSync(req.file.path)
        fileName = `public/img/brands/${req.file.filename}`;
    } else {
        fileName = ''
    }
    Brand.findById(req.params.brandId)
    .then(brand => {
        brand.name = req.body.name
        brand.description = req.body.description
        if(fileName) {
            if(brand.logo) {
                removeImage(brand.logo)
            }
            brand.logo = fileName
        }
        return brand.save() 
    })
    .then(result => {
        res.status(200).json(result);
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

const removeImage = (filePath) => {
    filePath = path.join(__dirname, '../..', filePath);
    fs.unlink(filePath, err => {
       if(err) return;
    })
}