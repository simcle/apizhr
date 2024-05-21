const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SetorSchema = new Schema({
    penerima: {type: String},
    setor: {type: Number}
}, {
    timestamps: true
})

module.exports = mongoose.model('Setor', SetorSchema);
