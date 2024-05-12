const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SetorSchema = new Schema({
    name: {type: String},
    tottal: {type: Number}
}, {
    timestamps: true
})

module.exports = mongoose.model('Setor', SetorSchema);
