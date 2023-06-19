const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PengeluaranSchema = new Schema({
    shopId: {type: mongoose.Types.ObjectId},
    item: {type: String},
    harga: {type: Number},
    qty: {type: Number},
    total: {type: Number},
    userId: {type: mongoose.Types.ObjectId}
}, {
    timestamps: true
})

module.exports = mongoose.model('Pengeluaran', PengeluaranSchema);