const mongoose = require('mongoose')

const StoreOperationalCash = require('../models/StoreOperationalCash')
const StoreOperationalCashTransaction = require('../models/StoreOperationalCashTransaction')
const PengeluaranModel = require('../models/pengeluaran')

const moment = require('moment')

const generateTransactionNumber = async () => {
    const now = new Date()
    
        const dd = String(now.getDate()).padStart(2, '0')
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const yy = String(now.getFullYear()).slice(-2)
    
        const startOfDay = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0, 0, 0, 0
        )
    
        const endOfDay = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23, 59, 59, 999
        )
        const last = await StoreOperationalCashTransaction
        .findOne({
            transactionNumber: {
                $regex: `ZHR/CASH/${yy}/`
            },
            createdAt: {
                $gte: startOfDay,
                $lte: endOfDay
            }
        })
        .sort({
            createdAt: -1
        })
        .select('transactionNumber')
    
        let running = 1
        if (last) {
            const arr = last.transactionNumber.split('/')
            running = Number(arr[arr.length - 1]) + 1
        }
        return `${dd}${mm}/ZHR/CASH/${yy}/${running}`
}

const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id)
}


exports.addFunds = async (req, res) => {
    const session = await mongoose.startSession()
    try {
        const { shopId } = req.params

        const {
            amount,
            description = 'Penambahan dana kas operasional',
            referenceType = 'MANUAL',
            referenceId = null,
            receipt = {},
            transactionDate = new Date()
        } = req.body

        // =====================================================
        // VALIDASI SHOP
        // =====================================================

        if (
            !shopId ||
            !mongoose.Types.ObjectId.isValid(shopId)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Shop ID tidak valid'
            })
        }

        // =====================================================
        // VALIDASI NOMINAL
        // =====================================================

        const parsedAmount = Number(amount)

        if (
            !Number.isFinite(parsedAmount) ||
            parsedAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: 'Nominal penambahan dana harus lebih dari 0'
            })
        }

        // Opsional apabila sistem hanya menggunakan rupiah bulat
        if (!Number.isInteger(parsedAmount)) {
            return res.status(400).json({
                success: false,
                message: 'Nominal penambahan dana harus berupa angka bulat'
            })
        }

        // =====================================================
        // VALIDASI KETERANGAN
        // =====================================================

        if (
            !description ||
            !String(description).trim()
        ) {
            return res.status(400).json({
                success: false,
                message: 'Keterangan penambahan dana wajib diisi'
            })
        }

        // =====================================================
        // VALIDASI REFERENCE TYPE
        // =====================================================

        const allowedReferenceTypes = [
            'FINANCE_TRANSFER',
            'MANUAL',
            'OTHER'
        ]

        if (!allowedReferenceTypes.includes(referenceType)) {
            return res.status(400).json({
                success: false,
                message: 'Reference type tidak valid'
            })
        }

        // =====================================================
        // VALIDASI REFERENCE ID
        // =====================================================

        if (
            referenceId &&
            !mongoose.Types.ObjectId.isValid(referenceId)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Reference ID tidak valid'
            })
        }

        // =====================================================
        // VALIDASI TANGGAL TRANSAKSI
        // =====================================================

        const parsedTransactionDate = new Date(transactionDate)

        if (Number.isNaN(parsedTransactionDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Tanggal transaksi tidak valid'
            })
        }

        // =====================================================
        // VALIDASI USER
        // =====================================================

        if (!req.user || !req.user._id) {
            return res.status(401).json({
                success: false,
                message: 'User tidak terautentikasi'
            })
        }

        // =====================================================
        // MULAI DATABASE TRANSACTION
        // =====================================================

        session.startTransaction()

        const now = new Date()

        /*
         * Cari kas berdasarkan shopId.
         *
         * Jika belum tersedia:
         * - Buat otomatis
         * - Saldo awal dianggap 0
         *
         * Jika sudah tersedia:
         * - Tambahkan saldo menggunakan $inc
         *
         * Penggunaan $inc membuat perubahan saldo lebih aman
         * ketika ada lebih dari satu request pada waktu berdekatan.
         */

        const cash = await StoreOperationalCash.findOneAndUpdate(
            {
                shopId: new mongoose.Types.ObjectId(shopId),

                /*
                 * Kas yang sudah ada hanya boleh ditambah
                 * jika statusnya ACTIVE.
                 *
                 * Kondisi status tidak ada diperlukan agar proses
                 * upsert dapat membuat dokumen baru.
                 */
                $or: [
                    { status: 'ACTIVE' },
                    { status: { $exists: false } }
                ]
            },
            {
                $inc: {
                    balance: parsedAmount
                },

                $set: {
                    lastTransactionAt: parsedTransactionDate,
                    updatedBy: req.user._id
                },

                $setOnInsert: {
                    shopId: new mongoose.Types.ObjectId(shopId),
                    status: 'ACTIVE',
                    notes: '',
                    createdBy: req.user._id
                }
            },
            {
                new: true,
                upsert: true,
                session,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        )

        if (!cash) {
            await session.abortTransaction()

            return res.status(400).json({
                success: false,
                message: 'Dana gagal ditambahkan ke kas operasional'
            })
        }

        /*
         * Karena findOneAndUpdate mengembalikan saldo terbaru,
         * saldo sebelumnya dapat dihitung dari:
         *
         * balanceBefore = balanceAfter - nominal masuk
         */

        const balanceAfter = cash.balance
        const balanceBefore = balanceAfter - parsedAmount

        // =====================================================
        // BUAT TRANSAKSI KAS MASUK
        // =====================================================

        const [transaction] =
            await StoreOperationalCashTransaction.create(
                [
                    {
                        transactionNumber:
                           await generateTransactionNumber(),

                        cashId: cash._id,
                        shopId: cash.shopId,

                        transactionDate: parsedTransactionDate,

                        transactionType: 'IN',
                        transactionCategory:
                            balanceBefore === 0
                                ? 'INITIAL_BALANCE'
                                : 'FUND_ADDITION',

                        amount: parsedAmount,

                        balanceBefore,
                        balanceAfter,

                        description: String(description).trim(),

                        referenceType,

                        referenceId: referenceId
                            ? new mongoose.Types.ObjectId(referenceId)
                            : null,

                        receipt: {
                            url: receipt?.url || '',
                            fileName: receipt?.fileName || ''
                        },

                        status: 'POSTED',

                        createdBy: req.user._id
                    }
                ],
                {
                    session
                }
            )

        // =====================================================
        // COMMIT
        // =====================================================

        await session.commitTransaction()

        return res.status(201).json({
            success: true,
            message: 'Dana kas operasional berhasil ditambahkan',

            data: {
                cash: {
                    _id: cash._id,
                    shopId: cash.shopId,
                    balance: cash.balance,
                    status: cash.status,
                    lastTransactionAt: cash.lastTransactionAt
                },

                transaction
            }
        })
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction()
        }

        /*
         * Duplicate shopId bisa terjadi jika dua request pertama
         * membuat kas untuk toko yang sama secara bersamaan.
         */
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message:
                    'Terjadi transaksi bersamaan. Silakan ulangi penambahan dana.'
            })
        }

        console.error('ADD STORE OPERATIONAL CASH ERROR:', error)

        return res.status(500).json({
            success: false,
            message: 'Gagal menambahkan dana kas operasional',
            error:
                process.env.NODE_ENV === 'development'
                    ? error.message
                    : undefined
        })
    } finally {
        await session.endSession()
    }
}

exports.getCashByShop = async (req, res) => {
    try {
        const { shopId } = req.params

        if (!isValidObjectId(shopId)) {
            return res.status(400).json({
                success: false,
                message: 'Shop tidak valid'
            })
        }

        const cash = await StoreOperationalCash
            .findOne({ shopId })
            .populate('shopId', 'name code')
            .populate('createdBy', 'name')
            .populate('updatedBy', 'name')
            .lean()

        if (!cash) {
            return res.status(404).json({
                success: false,
                message: 'Kas operasional toko belum tersedia'
            })
        }

        return res.json({
            success: true,
            data: cash
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

exports.getTransactions = async (req, res) => {
    try {
        const { shopId } = req.params

        if (!isValidObjectId(shopId)) {
            return res.status(400).json({
                success: false,
                message: 'Shop tidak valid'
            })
        }

        const page = Math.max(
            Number(req.query.page) || 1,
            1
        )

        const limit = Math.min(
            Math.max(Number(req.query.limit) || 20, 1),
            100
        )

        const skip = (page - 1) * limit

        const {
            startDate,
            endDate,
            transactionType,
            transactionCategory,
            status = 'POSTED',
            search
        } = req.query

        const filter = {
            shopId
        }

        if (status) {
            filter.status = status
        }

        if (transactionType) {
            filter.transactionType = transactionType
        }

        if (transactionCategory) {
            filter.transactionCategory = transactionCategory
        }

        if (startDate || endDate) {
            filter.transactionDate = {}

            if (startDate) {
                const start = new Date(startDate)

                if (Number.isNaN(start.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: 'Tanggal awal tidak valid'
                    })
                }

                start.setHours(0, 0, 0, 0)

                filter.transactionDate.$gte = start
            }

            if (endDate) {
                const end = new Date(endDate)

                if (Number.isNaN(end.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: 'Tanggal akhir tidak valid'
                    })
                }

                end.setHours(23, 59, 59, 999)

                filter.transactionDate.$lte = end
            }
        }

        if (search) {
            filter.$or = [
                {
                    transactionNumber: {
                        $regex: search,
                        $options: 'i'
                    }
                },
                {
                    description: {
                        $regex: search,
                        $options: 'i'
                    }
                }
            ]
        }

        const [transactions, total] = await Promise.all([
            StoreOperationalCashTransaction
                .find(filter)
                .populate('createdBy', 'name')
                .populate('cancelledBy', 'name')
                .sort({
                    transactionDate: -1,
                    createdAt: -1
                })
                .skip(skip)
                .limit(limit)
                .lean(),

            StoreOperationalCashTransaction.countDocuments(filter)
        ])

        return res.json({
            success: true,
            data: transactions,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

exports.getSummary = async (req, res) => {
    try {
        const { shopId } = req.params
        const { date } = req.query

        if (!isValidObjectId(shopId)) {
            return res.status(400).json({
                success: false,
                message: 'Shop tidak valid'
            })
        }

        const selectedDate = date
            ? new Date(date)
            : new Date()

        if (Number.isNaN(selectedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Tanggal tidak valid'
            })
        }

        const start = new Date(selectedDate)
        start.setHours(0, 0, 0, 0)

        const end = new Date(selectedDate)
        end.setHours(23, 59, 59, 999)

        const cash = await StoreOperationalCash
            .findOne({ shopId })
            .lean()

        if (!cash) {
            return res.status(404).json({
                success: false,
                message: 'Kas operasional toko belum tersedia'
            })
        }

        const summary =
            await StoreOperationalCashTransaction.aggregate([
                {
                    $match: {
                        shopId: new mongoose.Types.ObjectId(shopId),

                        status: 'POSTED',

                        transactionDate: {
                            $gte: start,
                            $lte: end
                        }
                    }
                },
                {
                    $group: {
                        _id: null,

                        totalIn: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$transactionType',
                                            'IN'
                                        ]
                                    },
                                    '$amount',
                                    0
                                ]
                            }
                        },

                        totalOut: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$transactionType',
                                            'OUT'
                                        ]
                                    },
                                    '$amount',
                                    0
                                ]
                            }
                        },

                        storeExpense: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$transactionCategory',
                                            'STORE_EXPENSE'
                                        ]
                                    },
                                    '$amount',
                                    0
                                ]
                            }
                        },

                        ownerPersonal: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$transactionCategory',
                                            'OWNER_PERSONAL'
                                        ]
                                    },
                                    '$amount',
                                    0
                                ]
                            }
                        },

                        totalTransactions: {
                            $sum: 1
                        }
                    }
                }
            ])

        const result = summary[0] || {
            totalIn: 0,
            totalOut: 0,
            storeExpense: 0,
            ownerPersonal: 0,
            totalTransactions: 0
        }

        return res.json({
            success: true,
            data: {
                date: selectedDate,
                currentBalance: cash.balance,

                totalIn: result.totalIn,
                totalOut: result.totalOut,

                storeExpense: result.storeExpense,
                ownerPersonal: result.ownerPersonal,

                totalTransactions: result.totalTransactions,

                lastTransactionAt: cash.lastTransactionAt
            }
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

exports.getReport = async (req, res) => {
    try {
        const { start, end } = req.query

        const startDate = moment(start)
            .startOf('day')
            .toDate()

        const endDate = moment(end)
            .endOf('day')
            .toDate()

        const cashes = await StoreOperationalCash.aggregate([
            {
                $match: {
                    status: 'ACTIVE'
                }
            },
            {
                $group: {
                    _id: null,
                    totalCash: {
                        $sum: '$balance'
                    }
                }
            }
        ])

        const totalCash = cashes.length > 0
            ? cashes[0].totalCash
            : 0

        const transactions = await StoreOperationalCashTransaction.aggregate([
            {
                $match: {
                    transactionType: 'OUT',

                    transactionCategory: {
                        $in: [
                            'STORE_EXPENSE',
                            'OWNER_PERSONAL',
                            'ASONGAN_PURCHASE',
                            'MATERIAL_EXPENSE'
                        ]
                    },

                    status: 'POSTED',

                    transactionDate: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            {
                $group: {
                    _id: null,

                    storeExpense: {
                        $sum: {
                            $cond: [
                                { $eq: ['$transactionCategory', 'STORE_EXPENSE'] },
                                '$amount',
                                0
                            ]
                        }
                    },

                    ownerPersonal: {
                        $sum: {
                            $cond: [
                                { $eq: ['$transactionCategory', 'OWNER_PERSONAL'] },
                                '$amount',
                                0
                            ]
                        }
                    },

                    asonganPurchase: {
                        $sum: {
                            $cond: [
                                { $eq: ['$transactionCategory', 'ASONGAN_PURCHASE'] },
                                '$amount',
                                0
                            ]
                        }
                    },
                    materialExpense: {
                        $sum: {
                            $cond: [
                                { $eq: ['$transactionCategory', 'MATERIAL_EXPENSE'] },
                                '$amount',
                                0
                            ]
                        }
                    },

                    totalTransactions: {
                        $sum: 1
                    },

                    totalAmount: {
                        $sum: '$amount'
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    storeExpense: 1,
                    ownerPersonal: 1,
                    asonganPurchase: 1,
                    materialExpense: 1,
                    totalTransactions: 1,
                    totalAmount: 1
                }
            }
        ])

        const summary = transactions[0] || {
            storeExpense: 0,
            ownerPersonal: 0,
            asonganPurchase: 0,
            totalTransactions: 0,
            totalAmount: 0
        }
      

       const pengeluaran = await PengeluaranModel.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            {
                $lookup: {
                    from: 'storeexpensecategories',
                    localField: 'categoryId',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            {
                $unwind: '$category'
            },
            {
                $group: {
                    _id: {
                        _id: '$category._id',
                        name: '$category.name'
                    },

                    totalAmount: {
                        $sum: '$total'
                    },

                    totalTransactions: {
                        $sum: 1
                    }
                }
            },
            {
                $sort: {
                    totalAmount: -1
                }
            }
        ])
        
        return res.status(200).json({totalCash, summary, pengeluaran})
    } catch (error) {
        console.error('GET REPORT ERROR:', error)

        return res.status(500).json({
            message: 'Gagal mengambil laporan pengeluaran'
        })
    }
}


exports.getPengeluaranByRange = async (req, res) => {
    try {
        
        const { start, end } = req.query

        if (!start || !end) {
            return res.status(400).json({
                success: false,
                message: 'Tanggal start dan end wajib diisi'
            })
        }

        const startDate = new Date(start)
        startDate.setHours(0, 0, 0, 0)

        const endDate = new Date(end)
        endDate.setHours(23, 59, 59, 999)

        const pengeluaran = await PengeluaranModel
            .find({
                createdAt: {
                    $gte: startDate,
                    $lte: endDate
                }
            })
            .sort({ createdAt: -1 })
            .populate('categoryId', 'name')
            .lean()

        return res.status(200).json({
            success: true,
            startDate,
            endDate,
            total: pengeluaran.length,
            pengeluaran
        })

    } catch (error) {
        console.error('getPengeluaranByRange:', error)

        return res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server',
            error: error.message
        })
    }
}