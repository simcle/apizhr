const PengeluaranModel = require('../models/pengeluaran');


exports.getPengeluaran = (req, res) => {
    const shopId = req.user.shopId
    const date = new Date();
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    console.log(today, date, shopId)

    PengeluaranModel.find({$and: [{shopId: shopId}, {createdAt: {$gte: today}}]}).sort({createdAt: -1})
    .then(result => {
        res.status(200).json(result)
    })
}
exports.insertPengeluaran = (req, res) => {
    const shopId = req.user.shopId
    const userId = req.user._id
    const date = new Date();
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const pengeluaran = new PengeluaranModel({
        shopId: shopId,
        item: req.body.item,
        harga: req.body.harga,
        qty: req.body.qty,
        total: req.body.total,
        userId: userId
    })
    pengeluaran.save()
    .then(() => {
        return PengeluaranModel.find({$and: [{shopId: shopId}, {createdAt: {$gte: today}}]}).sort({createdAt: -1})
    })
    .then(result => {
        res.status(200).json(result)
    })
}
exports.getPengeluaranAdmin = (req, res) => {
    const shopId = '647aa84733581aaca9c7725b'
    const date = new Date();
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    PengeluaranModel.find({$and: [{shopId: shopId}, {createdAt: {$gte: today}}]}).sort({createdAt: -1})
    .then(result => {
        res.status(200).json(result)
    })
}
exports.insertPengeluaranAdmin = (req, res) => {
    const shopId = '647aa84733581aaca9c7725b'
    const userId = req.user._id
    const date = new Date();
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const pengeluaran = new PengeluaranModel({
        shopId: shopId,
        item: req.body.item,
        harga: req.body.harga,
        qty: req.body.qty,
        total: req.body.total,
        userId: userId
    })
    pengeluaran.save()
    .then(() => {
        return PengeluaranModel.find({$and: [{shopId: shopId}, {createdAt: {$gte: today}}]}).sort({createdAt: -1})
    })
    .then(result => {
        res.status(200).json(result)
    })
}
exports.deletePengeluaran = (req, res) => {
    const id = req.params.pengeluaranId
    const shopId = req.user.shopId
    const date = new Date();
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    PengeluaranModel.deleteOne({_id: id})
    .then(() => {
        return PengeluaranModel.find({$and: [{shopId: shopId}, {createdAt: {$gte: today}}]}).sort({createdAt: -1})
    })
    .then(result => {
        res.status(200).json(result)
    })
}