const receiptModel = require('../models/receipts')
const supplierModel = require('../models/supplier')

exports.getLaporan = (req, res) => {
    const start = new Date('2024-10-1')
    const end = new Date('2024-10-31')
    
    receiptModel.aggregate([
        {$match: {$and: [{createdAt: {$gte: start, $lt: end}}]}},
        {$unwind: '$items'}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}