const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const UserModel = require('../models/users')
const ShopModel = require('../models/shops')
const jwt = require('jsonwebtoken')
const sendEmail = require('../config/mailer')
const fingerspot = require('../controllers/fingerspot')

exports.getAllemployee = (req, res) => {
    UserModel.aggregate([
        {
            $match: {
                isAdmin: {
                    $ne: true
                }
            }
        },
        {
            $lookup: {
                from: 'shops',
                localField: 'employmentData.shopId',
                foreignField: '_id',
                as: 'shops'
            }
        },
        {
            $unwind: {
                path: '$shops',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $addFields: {
                shop: '$shops.name'
            }
        }
    ])
    .then(result => {
        res.status(200).json(result)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

exports.getDetailEmployee = (req, res) => {
    const id = new mongoose.Types.ObjectId(req.params.id)

    UserModel.aggregate([
        {
            $match: {
                _id: id
            }
        },
        {
            $lookup: {
                from: 'shops',
                foreignField: '_id',
                localField: 'employmentData.shopId',
                as: 'shops'
            }
        },
        {
            $unwind: {
                path: '$shops',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $addFields: {
                shop: '$shops.name',
                job: '$employmentData.posisiPekerjaan'
            }
        }
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
        {
            $match: {
                $and: [
                    {
                        isActive: true
                    },
                    {
                        isAuth: false
                    }
                ]
            }
        },
        {
            $lookup: {
                from: 'shops',
                localField: 'employmentData.shopId',
                foreignField: '_id',
                as: 'shops'
            }
        },
        {
            $unwind: {
                path: '$shops',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $addFields: {
                shop: '$shops.name',
                job: '$employmentData.posisiPekerjaan'
            }
        },
        {
            $project: {
                name: 1,
                email: 1,
                shop: 1,
                job: 1,
                role: 1,
                isAuth: 1,
                isActive: 1
            }
        }
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
        for (let i = 0; i < employees.length; i++) {
            const el = employees[i]
            const id = el._id
            const name = el.name
            const email = el.email

            const token = jwt.sign(
                {
                    id: id
                },
                process.env.ACCESS_TOKEN_SECRET,
                {
                    expiresIn: '1h'
                }
            )

            const templateEmail = {
                from: '"ZHR LEATHER" <admin@zhrleather.com>',
                to: email,
                subject: 'Invite User',
                html: `
                    <p>Dear ${name}</p>
                    <p>Anda menerima undangan dari Admin ZHR LEATHER untuk menjadi user. Untuk menerima undangan ini silahkan klik link dibawah ini</p>
                    <p>${process.env.CLIENT_URL}/resetPassword/${token}</p>
                `
            }

            await sendEmail(templateEmail)
        }

        res.status(200).json('OK')
    } catch (error) {
        res.status(400).send(error)
    }
}

exports.activateAccess = async (req, res) => {
    try {
        const id = req.params.id
        const role = req.body.role

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                status: false,
                message: 'ID employee tidak valid'
            })
        }

        if (!role) {
            return res.status(400).json({
                status: false,
                message: 'Role wajib dipilih'
            })
        }

        const user = await UserModel.findById(id)

        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'Employee tidak ditemukan'
            })
        }

        if (!user.isActive) {
            return res.status(400).json({
                status: false,
                message: 'Employee sudah tidak aktif'
            })
        }

        if (user.isAuth) {
            return res.status(400).json({
                status: false,
                message: 'Employee sudah memiliki akses sistem'
            })
        }

        let allowedRoles = []

        if (req.user.role === 'admin') {
            allowedRoles = [
                'admin',
                'supervisor',
                'online',
                'gudang',
                'kasir',
                'pramuniaga'
            ]
        }

        if (req.user.role === 'supervisor') {
            allowedRoles = [
                'supervisor',
                'kasir',
                'pramuniaga'
            ]
        }

        if (!allowedRoles.includes(role)) {
            return res.status(403).json({
                status: false,
                message: 'Anda tidak dapat memberikan role tersebut'
            })
        }

        const defaultPassword = '123456'

        if (!defaultPassword) {
            return res.status(500).json({
                status: false,
                message: 'DEFAULT_USER_PASSWORD belum dikonfigurasi'
            })
        }

        const hashPassword = await bcrypt.hash(defaultPassword, 10)

        user.password = hashPassword
        user.role = role
        user.isAuth = true
        user.refreshToken = null

        await user.save()

        return res.status(200).json({
            status: true,
            message: 'Akses employee berhasil diaktifkan',
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isAuth: user.isAuth,
                isActive: user.isActive,
                shopId: user.employmentData?.shopId || null
            }
        })
    } catch (error) {
        console.error('activateAccess:', error)

        return res.status(500).json({
            status: false,
            message: 'Gagal mengaktifkan akses employee'
        })
    }
}

exports.createEmployee = (req, res) => {
    ShopModel.find()
        .lean()
        .then(result => {
            const shops = result.map(obj => {
                obj.id = obj._id
                obj.text = obj.name

                return obj
            })

            res.status(200).json(shops)
        })
        .catch(err => {
            res.status(400).send(err)
        })
}

exports.insertEmployee = async (req, res) => {
    const { pin } = await UserModel.findOne().sort({
        createdAt: -1
    })

    let fingerPin

    if (pin) {
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
        .then(result => {
            fingerspot.setUserInfo(result)
                .then(() => {
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
        .then(result => {
            fingerspot.setUserInfo(result)
                .then(() => {
                    res.status(200).json(result)
                })
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
            user.isActive = false
            user.isAuth = false
            user.password = ''
            user.refreshToken = null
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
            user.employmentData.tanggalKeluar = null

            return user.save()
        })
        .then(user => {
            res.status(200).json(user)
        })
        .catch(err => {
            res.status(400).send(err)
        })
}

exports.employeeTransfer = async (req, res) => {
    const id = req.body._id
    const shopId = req.body.shopTo

    await UserModel.updateOne(
        {
            _id: id
        },
        {
            'employmentData.shopId': shopId
        }
    )

    res.status(200).json('OK')
}