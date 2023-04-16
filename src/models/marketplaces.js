const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MarketplaceSchema = new Schema({
    name: {type: String},
    link: {type: String},
    status: {type: Boolean, default: true},
    logo: {type: String}
}, {
    timeseries: true
});

module.exports = mongoose.model('Marketplace', MarketplaceSchema);