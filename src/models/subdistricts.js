const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SubdistrictSchema = new Schema({
    _id: {type: Number},
    city_id: {tyep: Number},
    name: {type: String}
});

module.exports = mongoose.model('Subdistrict', SubdistrictSchema);