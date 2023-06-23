const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SupplierSchema = new Schema({
    name: {type: String},
    userId: {type: Schema.Types.ObjectId}
}, {
    timestamps: true
});

module.exports = mongoose.model('Supplier', SupplierSchema);