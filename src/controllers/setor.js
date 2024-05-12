const SetorModel = require('../models/setor');
const SalesModel = require('../models/sales');
const PengeluaranModel = require('../models/pengeluaran');

exports.getSetor = (req, res) => {
    const date = new Date()
    const today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const totalTunai = SalesModel.aggregate([
        {$match: {$and: [{createdAt: {$gte: today}}, {paymentMethod: 'TUNAI'}]}},
        {$group: {
            _id: null,
            total: {$sum: '$grandTotal'}
        }}
    ])

    const totalPengeluaran = PengeluaranModel.aggregate([
        {$match: {createdAt: {$gte: today}}},
        {$group: {
            _id: null,
            total: {$sum: '$total'}
        }}
    ])

    Promise.all([
        totalTunai,
        totalPengeluaran
    ])
    .then(result => {
        console.log(result)
    })
}