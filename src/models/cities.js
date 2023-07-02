const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CitySchema = new Schema({
    _id: {type: Number},
    province_id: {type: Number},
    name: {type: String},
    postal_code: {type: Number}
});

module.exports = mongoose.model('City', CitySchema);