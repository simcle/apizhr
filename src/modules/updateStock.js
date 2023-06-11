const Inventory = require('../models/inventory'); 
const Product = require('../models/products')
module.exports = async (id) => {
    const result = await Inventory.aggregate([
        {$match: {productId: id}},
        {$group: {_id: '$productId', qty: {$sum: '$qty'}}}
    ])
    const product = await Product.findById(result[0]._id)
    product.stock = result[0].qty
    return product.save();
}
