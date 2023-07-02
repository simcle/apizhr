const ProvincesModel = require('../models/provinces');
const CitiesModel = require('../models/cities');
const SubdistrictModel = require('../models/subdistricts');

exports.getSubdistricts = (req, res) => {
    const search = req.query.search
    SubdistrictModel.aggregate([
        {$match: {name: {$regex: '.*'+search+'.*', $options: 'i'}}},
        {$lookup: {
            from: 'cities',
            foreignField: '_id',
            localField: 'city_id',
            as: 'city',
        }},
        {$unwind: '$city'},
        {$addFields: {
            cityName: '$city.name',
            province_id: '$city.province_id'
        }},
        {$lookup: {
            from: 'provinces',
            foreignField: '_id',
            localField: 'province_id',
            as: 'province'
        }},
        {$unwind: '$province'},
        {$addFields: {
            provinceName: '$province.name',
        }},
        {$unset: 'city'},
        {$unset: 'province'},
        {$sort: {name: 1}}
    ])
    .then (result => {
        res.status(200).json(result)
    })
}