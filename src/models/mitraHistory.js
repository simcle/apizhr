const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MitraHistories = new Schema({
    documentNo: {type: String},
    type: {type: String},
    mitraId: {type: mongoose.Types.ObjectId},
    shopId: {type: mongoose.Types.ObjectId},
    items: {type: Array},
    grandTotal: {type: Number},
    userId: {type: mongoose.Types.ObjectId}
}, {
    timestamps: true
})

module.exports = mongoose.model('MitraHistories', MitraHistories);