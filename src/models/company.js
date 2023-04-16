const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CompanySchema = new Schema({
    name: {type: String, required: true},
    tagline: {type: String},
    description: {type: String},
    phone: {type: String},
    fax: {type: String},
    email: {type: String},
    website: {type: String},
    companyAddress: {type: Object},
    shippingAddress: {type: Object},
    billingAddress: {type: Object},
});

module.exports = mongoose.model('Company', CompanySchema);
