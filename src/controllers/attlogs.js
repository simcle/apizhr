const Attlogs = require('../models/attlog');
const Users = require('../models/users')
exports.getAttlogs = (req, res) => {
    const scanDate = req.query.scanDate
    const start = new Date(scanDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(scanDate)
    end.setHours(23, 59, 59, 999)
    Users.aggregate([
        {$match: {$and: [{isAdmin: false}, {isActive: true}]}},
        {$lookup: {
            from : 'shops',
            localField: 'employmentData.shopId',
            foreignField: '_id',
            as: 'shops'
        }},
        {$unwind: {
            path: '$shops',
            preserveNullAndEmptyArrays: true
        }},
        {$lookup: {
            from: 'attlogs',
            localField: 'pin',
            foreignField: 'userPin',
            pipeline: [
                {$match: {
                    scanDate: {$gte: start, $lt: end}
                }}
            ],
            as: 'attlogs'
        }},
        {$unwind: {
            path: '$attlogs',
            preserveNullAndEmptyArrays: true
        }},
        {$addFields: {
            scanIn: '$attlogs.scanIn',
            scanOut: '$attlogs.scanOut',
            scanDate: '$attlogs.scanDate',
            keterangan: '$attlogs.information',
            shop: '$shops.name'
        }},
        {$project: {
            name: 1,
            pin: 1,
            scanIn: 1,
            scanOut: 1,
            scanDate: 1,
            keterangan: 1,
            shop: 1,
        }},
        {$sort: {scanIn: 1}}
    ])
    .then(result => {
        res.status(200).json(result)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

exports.updateAttlog = (req, res) => {
    const scanDate = req.body.scanDate
    const userPin = req.body.pin
    const start = new Date(scanDate)
    const end = new Date(scanDate)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    Attlogs.findOne({$and: [{userPin: userPin}, {scanDate: {$gte: start, $lt: end}}]})
    .then(att => {
        if(att) {
            att.scanIn = req.body.scanIn
            att.scanOut = req.body.scanOut
            att.information = req.body.information
            return att.save()
        } else {
            const attlog = new Attlogs({
                userPin: req.body.pin,
                scanIn: req.body.scanIn,
                scanOut: req.body.scanOut,
                scanDate: scanDate,
                information: req.body.information
            })
            return attlog.save()
        }
    })
    .then (result => {
        res.status(200).json(result)
    })
}

exports.getStats = (req, res) => {
    Attlogs.aggregate([
        {$group: {
            _id: '$userPin',
            tanpaKeterangan: {$sum: {$cond: [{$eq: ['$information','Tanpa keterangan']}, 1, 0]}},
            izin: {$sum: {$cond: [{$eq: ['$information','Izin']}, 1, 0]}},
            sakit: {$sum: {$cond: [{$eq: ['$information','Sakit']}, 1, 0]}},
            libur: {$sum: {$cond: [{$eq: ['$information','Libur']}, 1, 0]}},
            masuk: {$sum: {$cond: [{$eq: ['$information','Masuk']}, 1, 0]}},
        }},
        {
            $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: 'pin',
                as: 'users'
            }
        },
        {$unwind: '$users'},
        {
            $lookup: {
                from: 'shops',
                localField: 'users.employmentData.shopId',
                foreignField: '_id',
                as: 'shops'
            }
        },
        {$unwind: '$shops'},
        {$addFields: {
            name: '$users.name',
            shop: '$shops.name'
        }},
        {$project: {
            name: 1,
            shop: 1,
            tanpaKeterangan: 1,
            izin: 1,
            sakit: 1,
            libur: 1,
            masuk: 1
        }},
        {$sort: {masuk: -1}}
    ])
    .then(result => {
        res.status(200).json(result)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}