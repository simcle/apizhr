const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BankSchema = new Schema({
    name: {type: String},
    accountNumber: {type: String},
    accountName: {type: String},
    kcp: {type: String},
    icon: {type: String}
}, {
    timestamps: true
});

module.exports = mongoose.model('Bank', BankSchema);