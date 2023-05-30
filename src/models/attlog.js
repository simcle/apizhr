const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AttlogSchema = new Schema({
    userPin: {type: Number},
    scanIn: {type: Date},
    scanOut: {type: Date, default: null},
    scanType: {type: Number},
    scanDate: {type: Date},
    information: {type: String}
}, {
    timestamps: true
})

module.exports = mongoose.model('Attlog', AttlogSchema);
