const Shops = require('../models/shops');


exports.getShopById = (req, res) => {
    const shopId = req.user.shopId
    Shops.findById(shopId)
    .then(result => {
        res.status(200).json(result)
    })
}

exports.getShops = (req, res) => {
    Shops.find()
    .then(result => {
        res.status(200).json(result)
    })
}

exports.postShop = (req, res) => {
    const shop = new Shops({
        name: req.body.name,
        address: req.body.address,
        mobile: req.body.mobile
    })
    shop.save()
    .then(result => {
        res.status(200).json(result)
    })
}

exports.putShop = (req, res) => {
    const shopId = req.body._id
    Shops.findById(shopId)
    .then(shop => {
        shop.name = req.body.name
        shop.address = req.body.address
        shop.mobile = req.body.mobile
        return shop.save()
    })
    .then(() => {
        res.status(200).send('OK')
    })
}