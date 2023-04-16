const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BrandSchema = new Schema({
    name: {type: String, unique: true, lowercase: true},
    description: {type: String},
    logo: {type: String}
},{
    timestamps: true
});

module.exports = mongoose.model('Brand', BrandSchema);