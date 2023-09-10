const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const Marketplaces = require('../models/marketplaces');

exports.getMarketplace = (req, res) => {
    Marketplaces.find()
    .then(result => {
        res.status(200).json(result);
    })
}

exports.postMarketplace = async (req, res) => {
    let fileName = '';
    if(req.file) {
        const {filename: image} = req.file
        const filePath = `./public/img/marketplaces/${req.file.filename}`
        await sharp(req.file.path)
        .resize({height: 80})
        .toFile(filePath);
        fs.unlinkSync(req.file.path)
        fileName = `public/img/marketplaces/${req.file.filename}`;
    } else {
        fileName = ''
    }

    const marketplace = new Marketplaces({
        name: req.body.name,
        link: req.body.link,
        logo: fileName
    })
    marketplace.save()
    .then(result => {
        res.status(200).json(result)
    })
}

exports.putMarketplace = async (req, res) => {
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
    Marketplaces.findById(req.body._id)
    .then(market => {
        market.name = req.body.name
        market.link = req.body.link
        if(fileName) {
            if(market.logo) {
                removeImage(market.logo)
            }
            market.logo = fileName
        }
        return market.save()
    })
    .then(result => {
        res.status(200).json(result)
    })
}

exports.putStatus = (req, res) => {
    const marketId = req.params.marketId
    Marketplaces.findById(marketId)
    .then(market => {
        market.status = req.body.status
        return market.save()
    })
    .then(result => {
        res.status(200).json(result)
    })
}

const removeImage = (filePath) => {
    filePath = path.join(__dirname, '../..', filePath);
    fs.unlink(filePath, err => {
       if(err) return;
    })
}