const ProductsModel = require('../models/products');

exports.getStatistics = (req, res) => {
    console.log('hallo')
    const items = ProductsModel.aggregate([
        {$lookup: {
            from: 'sales',
            localField: '_id',
            foreignField: 'items.productId',

            as: 'sales'
        }},
        {$unwind: '$sales'}
    ])

    Promise.all([
        items
    ])
    .then(result => {
        return res.status(200).json(result)
    })

}