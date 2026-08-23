const mongoose = require('mongoose')
const PengeluaranModel = require('../models/pengeluaran');
const StoreExpenseCategory = require('../models/StoreExpenseCategory')
const StoreOperationalCash = require('../models/StoreOperationalCash')
const StoreOperationalCashTransaction = require( '../models/StoreOperationalCashTransaction')

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

exports.getPengeluaran = async (req, res) => {
    const shopId = req.user.shopId
    const date = new Date();
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    const pengeleuaran = await PengeluaranModel
        .find({$and: [{shopId: shopId}, {createdAt: {$gte: today}}]}).sort({createdAt: -1}).populate('categoryId', 'name')
    const cash = await StoreOperationalCash
        .findOne({ shopId })
        .populate('shopId', 'name code')
        .populate('createdBy', 'name')
        .populate('updatedBy', 'name')
        .lean()
    res.status(200).json({
        cash: cash || 0,
        pengeluaran: pengeleuaran
    })
}



exports.insertPengeluaran = async (req, res) => {
    const session = await mongoose.startSession()

    try {
        const shopId = req.user.shopId
        const userId = req.user._id

        const {
            item,
            categoryId,
            harga,
            qty,
            total
        } = req.body

        // =====================================================
        // VALIDASI USER DAN TOKO
        // =====================================================

        if (!shopId || !mongoose.Types.ObjectId.isValid(shopId)) {
            return res.status(400).json({
                success: false,
                message: 'Toko pengguna tidak valid'
            })
        }

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(401).json({
                success: false,
                message: 'User tidak terautentikasi'
            })
        }

        // =====================================================
        // VALIDASI INPUT
        // =====================================================

        if (!item || !String(item).trim()) {
            return res.status(400).json({
                success: false,
                message: 'Nama pengeluaran wajib diisi'
            })
        }

        if (
            !categoryId ||
            !mongoose.Types.ObjectId.isValid(categoryId)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Kategori pengeluaran tidak valid'
            })
        }

        const parsedHarga = Number(harga || 0)
        const parsedQty = Number(qty || 0)
        const parsedTotal = Number(total || 0)

        if (
            !Number.isFinite(parsedTotal) ||
            parsedTotal <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: 'Total pengeluaran harus lebih dari 0'
            })
        }

        if (!Number.isInteger(parsedTotal)) {
            return res.status(400).json({
                success: false,
                message: 'Total pengeluaran harus berupa angka bulat'
            })
        }

        // =====================================================
        // MULAI TRANSACTION
        // =====================================================

        session.startTransaction()

        // =====================================================
        // AMBIL KATEGORI
        // =====================================================

        const category = await StoreExpenseCategory
            .findOne({
                _id: categoryId,
                isActive: true
            })
            .session(session)

        if (!category) {
            await session.abortTransaction()

            return res.status(404).json({
                success: false,
                message:
                    'Kategori pengeluaran tidak ditemukan atau sudah tidak aktif'
            })
        }

        // =====================================================
        // AMBIL KAS OPERASIONAL
        // =====================================================

        const cash = await StoreOperationalCash
            .findOne({
                shopId,
                status: 'ACTIVE'
            })
            .session(session)

        if (!cash) {
            await session.abortTransaction()

            return res.status(404).json({
                success: false,
                message:
                    'Kas operasional toko belum tersedia atau tidak aktif'
            })
        }

        // =====================================================
        // VALIDASI SALDO
        // =====================================================

        if (cash.balance < parsedTotal) {
            await session.abortTransaction()

            return res.status(400).json({
                success: false,
                message: 'Saldo kas operasional tidak mencukupi',

                data: {
                    balance: cash.balance,
                    totalExpense: parsedTotal,
                    shortage: parsedTotal - cash.balance
                }
            })
        }

        // =====================================================
        // SIMPAN PENGELUARAN
        // =====================================================

        const [pengeluaran] = await PengeluaranModel.create(
            [
                {
                    shopId,
                    item: String(item).trim(),
                    categoryId,
                    harga: parsedHarga,
                    qty: parsedQty,
                    total: parsedTotal,
                    userId
                }
            ],
            {
                session
            }
        )

        // =====================================================
        // HITUNG SALDO
        // =====================================================

        const balanceBefore = cash.balance
        const balanceAfter = balanceBefore - parsedTotal
        const transactionDate = new Date()

        cash.balance = balanceAfter
        cash.lastTransactionAt = transactionDate
        cash.updatedBy = userId

        await cash.save({ session })

        // =====================================================
        // TENTUKAN KATEGORI TRANSAKSI KAS
        // =====================================================

        let transactionCategory = 'STORE_EXPENSE'
        
        switch (category.code) {
            case 'STO-012':
                transactionCategory = 'ASONGAN_PURCHASE'
                break
            case 'STO-010':
                transactionCategory = 'OWNER_PERSONAL'
                break
            case 'STO-013':
                transactionCategory = 'MATERIAL_EXPENSE'
                break
            default:
                transactionCategory = 'STORE_EXPENSE'
                break
        }

        // =====================================================
        // BUAT MUTASI KAS
        // =====================================================

        const [cashTransaction] =
            await StoreOperationalCashTransaction.create(
                [
                    {
                        transactionNumber:
                            await generateTransactionNumber(),

                        cashId: cash._id,
                        shopId,

                        transactionDate,

                        transactionType: 'OUT',
                        transactionCategory,

                        amount: parsedTotal,

                        balanceBefore,
                        balanceAfter,

                        description: String(item).trim(),

                        referenceType: 'STORE_EXPENSE',
                        referenceId: pengeluaran._id,

                        status: 'POSTED',

                        createdBy: userId
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

        // =====================================================
        // AMBIL PENGELUARAN HARI INI
        // =====================================================

        const now = new Date()

        const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        )

        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        const result = await PengeluaranModel
            .find({
                shopId,
                createdAt: {
                    $gte: today,
                    $lt: tomorrow
                }
            })
            .populate('categoryId', 'code name')
            .populate('userId', 'name')
            .sort({
                createdAt: -1
            })

        return res.status(201).json({
            success: true,
            message: 'Pengeluaran berhasil disimpan',

            data: {
                pengeluaran,
                cashTransaction,

                cash: {
                    balanceBefore,
                    balanceAfter
                },

                todayExpenses: result
            }
        })
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction()
        }

        console.error('INSERT PENGELUARAN ERROR:', error)

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Nomor transaksi kas sudah digunakan',
                duplicateField: error.keyPattern,
                duplicateValue: error.keyValue
            })
        }

        return res.status(500).json({
            success: false,
            message: 'Gagal menyimpan pengeluaran',
            error:
                process.env.NODE_ENV === 'development'
                    ? error.message
                    : undefined
        })
    } finally {
        await session.endSession()
    }
}


// exports.insertPengeluaran = (req, res) => {
//     const shopId = req.user.shopId
//     const userId = req.user._id
//     const date = new Date();
//     let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
//     const pengeluaran = new PengeluaranModel({
//         shopId: shopId,
//         item: req.body.item,
//         categoryId: req.body.categoryId,
//         harga: req.body.harga,
//         qty: req.body.qty,
//         total: req.body.total,
//         userId: userId
//     })
//     pengeluaran.save()
//     .then(() => {
//         return PengeluaranModel.find({$and: [{shopId: shopId}, {createdAt: {$gte: today}}]}).sort({createdAt: -1})
//     })
//     .then(result => {
//         res.status(200).json(result)
//     })
// }
exports.getPengeluaranAdmin = (req, res) => {
    const shopId = '647aa84733581aaca9c7725b'
    const date = new Date();
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    PengeluaranModel.find({$and: [{shopId: shopId}, {createdAt: {$gte: today}}]}).sort({createdAt: -1})
    .then(result => {
        res.status(200).json(result)
    })
}
exports.insertPengeluaranAdmin = (req, res) => {
    const shopId = '647aa84733581aaca9c7725b'
    const userId = req.user._id
    const date = new Date();
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const pengeluaran = new PengeluaranModel({
        shopId: shopId,
        item: req.body.item,
        harga: req.body.harga,
        qty: req.body.qty,
        total: req.body.total,
        userId: userId
    })
    pengeluaran.save()
    .then(() => {
        return PengeluaranModel.find({$and: [{shopId: shopId}, {createdAt: {$gte: today}}]}).sort({createdAt: -1})
    })
    .then(result => {
        res.status(200).json(result)
    })
}


exports.deletePengeluaran = async (req, res) => {
    const session = await mongoose.startSession()

    try {
        const { pengeluaranId } = req.params

        const shopId = req.user.shopId
        const userId = req.user._id

        const {
            cancellationReason = 'Pengeluaran dihapus'
        } = req.body

        // =====================================================
        // VALIDASI
        // =====================================================

        if (
            !pengeluaranId ||
            !mongoose.Types.ObjectId.isValid(pengeluaranId)
        ) {
            return res.status(400).json({
                success: false,
                message: 'ID pengeluaran tidak valid'
            })
        }

        if (
            !shopId ||
            !mongoose.Types.ObjectId.isValid(shopId)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Toko pengguna tidak valid'
            })
        }

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User tidak terautentikasi'
            })
        }

        if (
            !cancellationReason ||
            !String(cancellationReason).trim()
        ) {
            return res.status(400).json({
                success: false,
                message: 'Alasan penghapusan wajib diisi'
            })
        }

        // =====================================================
        // MULAI TRANSACTION
        // =====================================================

        session.startTransaction()

        // =====================================================
        // CARI PENGELUARAN
        // =====================================================

        const pengeluaran = await PengeluaranModel
            .findOne({
                _id: pengeluaranId,
                shopId
            })
            .session(session)

        if (!pengeluaran) {
            await session.abortTransaction()

            return res.status(404).json({
                success: false,
                message: 'Pengeluaran tidak ditemukan'
            })
        }

        // =====================================================
        // CARI TRANSAKSI KAS TERKAIT
        // =====================================================

        const cashTransaction =
            await StoreOperationalCashTransaction
                .findOne({
                    shopId,
                    referenceType: 'STORE_EXPENSE',
                    referenceId: pengeluaran._id,
                    status: 'POSTED'
                })
                .session(session)

        if (!cashTransaction) {
            await session.abortTransaction()

            return res.status(404).json({
                success: false,
                message:
                    'Transaksi kas untuk pengeluaran ini tidak ditemukan'
            })
        }

        // =====================================================
        // CARI KAS OPERASIONAL
        // =====================================================

        const cash = await StoreOperationalCash
            .findOne({
                _id: cashTransaction.cashId,
                shopId
            })
            .session(session)

        if (!cash) {
            await session.abortTransaction()

            return res.status(404).json({
                success: false,
                message: 'Kas operasional toko tidak ditemukan'
            })
        }

        // =====================================================
        // KEMBALIKAN SALDO
        // =====================================================

        const amount = Number(cashTransaction.amount)

        const balanceBefore = cash.balance
        const balanceAfter = balanceBefore + amount

        const transactionDate = new Date()

        cash.balance = balanceAfter
        cash.lastTransactionAt = transactionDate
        cash.updatedBy = userId

        await cash.save({ session })

        // =====================================================
        // BATALKAN TRANSAKSI KAS LAMA
        // =====================================================

        cashTransaction.status = 'CANCELLED'
        cashTransaction.cancelledBy = userId
        cashTransaction.cancelledAt = transactionDate
        cashTransaction.cancellationReason =
            String(cancellationReason).trim()

        await cashTransaction.save({ session })

        // =====================================================
        // BUAT TRANSAKSI PEMBALIK
        // =====================================================

        const [reversalTransaction] =
            await StoreOperationalCashTransaction.create(
                [
                    {
                        transactionNumber:
                            await generateTransactionNumber(),

                        cashId: cash._id,
                        shopId,

                        transactionDate,

                        transactionType: 'IN',
                        transactionCategory: 'ADJUSTMENT_IN',

                        amount,

                        balanceBefore,
                        balanceAfter,

                        description:
                            `Pembatalan pengeluaran: ${pengeluaran.item}`,

                        referenceType: 'STORE_EXPENSE',
                        referenceId: pengeluaran._id,

                        status: 'POSTED',

                        createdBy: userId
                    }
                ],
                {
                    session
                }
            )

        // =====================================================
        // HAPUS PENGELUARAN
        // =====================================================

        await PengeluaranModel.deleteOne(
            {
                _id: pengeluaran._id,
                shopId
            },
            {
                session
            }
        )

        // =====================================================
        // COMMIT
        // =====================================================

        await session.commitTransaction()

        // =====================================================
        // AMBIL PENGELUARAN HARI INI
        // =====================================================

        const now = new Date()

        const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        )

        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        const result = await PengeluaranModel
            .find({
                shopId,
                createdAt: {
                    $gte: today,
                    $lt: tomorrow
                }
            })
            .populate('categoryId', 'code name')
            .populate('userId', 'name')
            .sort({
                createdAt: -1
            })

        return res.status(200).json({
            success: true,
            message:
                'Pengeluaran berhasil dihapus dan saldo kas telah dikembalikan',

            data: {
                deletedExpense: {
                    _id: pengeluaran._id,
                    item: pengeluaran.item,
                    amount
                },

                cancelledCashTransaction: cashTransaction,

                reversalTransaction,

                cash: {
                    balanceBefore,
                    balanceAfter
                },

                todayExpenses: result
            }
        })
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction()
        }

        console.error('DELETE PENGELUARAN ERROR:', error)

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Nomor transaksi pembatalan sudah digunakan',
                duplicateField: error.keyPattern,
                duplicateValue: error.keyValue
            })
        }

        return res.status(500).json({
            success: false,
            message: 'Gagal menghapus pengeluaran',

            error:
                process.env.NODE_ENV === 'development'
                    ? error.message
                    : undefined
        })
    } finally {
        await session.endSession()
    }
}

// exports.deletePengeluaran = (req, res) => {
//     const id = req.params.pengeluaranId
//     const shopId = req.user.shopId
//     const date = new Date();
//     let today = new Date(date.getFullYear(), date.getMonth(), date.getDate())
//     PengeluaranModel.deleteOne({_id: id})
//     .then(() => {
//         return PengeluaranModel.find({$and: [{shopId: shopId}, {createdAt: {$gte: today}}]}).sort({createdAt: -1})
//     })
//     .then(result => {
//         res.status(200).json(result)
//     })
// }