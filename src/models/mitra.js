const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MitraSchema = new Schema({
    name: {type: String},
    description: {type: String}
}, {
    timestamps: true
})

module.exports = mongoose.model('Mitras', MitraSchema);