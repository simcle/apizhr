const Shops = require('../models/shops');

exports.getShop = (req, res) => {
    const shopId = req.user.shopId
    Shops.findById(shopId)
    .then(shops => {
        res.status(200).json(shops)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}