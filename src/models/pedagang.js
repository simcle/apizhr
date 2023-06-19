const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PedagangSchema = new Schema({
    name: {type: String},
    userId: {type: Schema.Types.ObjectId}
}, {
    timestamps: true
})

module.exports = mongoose.model('Pedagang', PedagangSchema);