const AttlogsModel = require('../models/attlog');

exports.getPayroll = (req, res) => {
    let day = new Date()
    day.setDate(day.getDate() - 6)
    day.setHours(0,0,0,0)
    AttlogsModel.aggregate([
        {$match: {$and:[{scanDate: {$gte: day}}, {scanIn: {$ne: null}}]}},
        {$lookup: {
            from: 'users',
            foreignField: 'pin',
            localField: 'userPin',
            as: 'user'
        }},
        {$unwind: '$user'},
        {$addFields: {
            pin: '$user.pin',
            nik: '$user.employmentData.barcode',
            user: '$user.name',
            posisi: '$user.employmentData.posisiPekerjaan',
            status: '$user.employmentData.statusPekerjaan',
            gaji: '$user.payroll.gajiPokok',
            bonus: '$user.payroll.bonusSales'
        }},
        {$group: {
            _id: '$userPin',
            name: {$first: '$user'},
            nik: {$first: '$nik'},
            gaji: {$first: '$gaji'},
            posisi: {$first: '$posisi'},
            status: {$first: '$status'},
            bonus: {$first: '$bonus'},
            attendences: {$push: '$scanIn'}
        }},
        {$sort: {_id: 1}}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}