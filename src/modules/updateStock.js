const Inventory = require('../models/inventory'); 
const Product = require('../models/products')
const Pusher = require('pusher')
const pusher = new Pusher({
    appId: "1691787",
    key: "40ef0cc59cdad1a5f5d8",
    secret: "0a42aee3a055c8e7a15a",
    cluster: "ap1",
    useTLS: true
});

module.exports = async (id) => {
    const result = await Inventory.aggregate([
        {$match: {productId: id}},
        {$group: {_id: '$productId', qty: {$sum: '$qty'}}}
    ])
    const product = await Product.findById(result[0]._id)
    product.stock = result[0].qty
    // if(result[0].qty <= 3) {
    //     pusher.trigger("notif", product, {
    //         message: "Stok akan segera habis"
    //     });
    // }
    return product.save();
}
