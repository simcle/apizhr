const mongoose = require('mongoose');
const UserModel = require('../models/users');
const ShopModel = require('../models/shops');
const jwt = require('jsonwebtoken');
const sendEmail = require('../config/mailer');
const fingerspot = require('../controllers/fingerspot');

exports.getAllemployee = (req, res) => {
    UserModel.aggregate([
        {$match: {isAdmin: {$ne: true}}},
        {$lookup: {
            from: 'shops',
            localField: 'employmentData.shopId',
            foreignField: '_id',
            as: 'shops'
        }},
        {$unwind: {
            path: '$shops',
            preserveNullAndEmptyArrays: true
        }},
        {$addFields: {
            shop: '$shops.name'
        }}
    ])
    .then(result => {
        res.status(200).json(result)
    })
}
exports.getDetailEmployee = (req, res) => {
    const id = mongoose.Types.ObjectId(req.params.id)
    UserModel.aggregate([
        {$match: {_id: id}},
        {$lookup: {
            from: 'shops',
            foreignField: '_id',
            localField: 'employmentData.shopId',
            as: 'shops'
        }},
        {$unwind: {
            path: '$shops',
            preserveNullAndEmptyArrays: true
        }},
        {$addFields: {
            shop: '$shops.name',
            job: '$employmentData.posisiPekerjaan'
        }}
    ])
    .then(result => {
        res.status(200).json(result[0])
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

exports.inviteEmployee = (req, res) => {
    UserModel.aggregate([
        {$match: {
            $and: [{isActive: true}, {isAuth: false}]
            
        }},
        {$lookup: {
            from: 'shops',
            localField: 'employmentData.shopId',
            foreignField: '_id',
            as: 'shops'
        }},
        {$unwind: {
            path: '$shops',
            preserveNullAndEmptyArrays: true
        }},
        {$addFields: {
            shop: '$shops.name',
            job: '$employmentData.posisiPekerjaan',
        }},
        {$project: {
            name: 1,
            email: 1,
            shop: 1,
            job: 1
        }}
    ])
    .then(result => {
        res.status(200).json(result)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

exports.sendInvite = async (req, res) => {
    const employees = req.body.employees
    try {
        for (let i=0; i < employees.length; i++) {
            const el = employees[i]
            const id = el._id
            const name = el.name
            const email = el.email
            const token = jwt.sign({id: id}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})
            const templateEmail = {
                from: '"ZHR LEATHER" <admin@zhrleather.com>',
                    to: email,
                    subject: 'Invite User',
                    html: `
                        <p>Dear ${name}</p>
                        <p>Anda menerima undangan dari Admin ZHR LEATHER untuk menjadi user. Untuk menerima undang ini silahkan klik link dibawah ini</p>
                        <p>${process.env.CLIENT_URL}/resetPassword/${token}</p>
                    `
            }
            await sendEmail(templateEmail);
        }
        res.status(200).json('OK')
    } catch (error) {
        res.status(400).send(error)
    }
}

exports.createEmployee = (req, res) => {
    ShopModel.find().lean()
    .then(result => {
        const shops = result.map(obj => {
            obj.id = obj._id,
            obj.text = obj.name
            return obj
        })
        res.status(200).json(shops)
    })
    .catch(err => {
        res.status(400).send(err);
    })
}

exports.insertEmployee = async (req, res) => {
    const {pin} = await UserModel.findOne().sort({createdAt: -1})
    let fingerPin;
    if(pin) {
        fingerPin = pin + 1
    } else {
        fingerPin = 1
    }
    const body = req.body
    const employee = new UserModel({
        name: body.name,
        email: body.email,
        phone: body.phone,
        personalData: body.personalData,
        employmentData: body.employmentData,
        payroll: body.payroll,
        pin: fingerPin
    })
    employee.save()
    .then((result) => {
        fingerspot.setUserInfo(result)
        .then(()  => {
            res.status(200).json(result)
        })
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

exports.updateEmployee = (req, res) => {
    const id = req.params.id
    UserModel.findById(id)
    .then(emp => {
        emp.name = req.body.name
        emp.email = req.body.email
        emp.phone = req.body.phone
        emp.personalData = req.body.personalData
        emp.employmentData = req.body.employmentData
        emp.payroll = req.body.payroll

        return emp.save()
    })
    .then (result => {
        res.status(200).json(result)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

exports.fingerPrint = (req, res) => {
    const body = req.body
    fingerspot.registerOnline(body)
    .then(() => {
        res.status(200).json('OK')
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

exports.resignEmployee = (req, res) => {
    const id = req.body._id
    UserModel.findById(id)
    .then(user => {
        user.isActive = false,
        user.isAuth = false
        user.password = ''
        user.employmentData.tanggalKeluar = req.body.tanggalKeluar
        return user.save()
    })
    .then(user => {
        res.status(200).json(user)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

exports.activeEmployee = (req, res) => {
    const id = req.body._id
    UserModel.findById(id)
    .then(user => {
        user.isActive = true
        user.employmentData.tangglKeluar = null
        return user.save()
    })
    .then(user => {
        res.status(200).json(user)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}