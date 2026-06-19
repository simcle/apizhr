const mongoose = require('mongoose')

const Sales = require('../models/sales')
const Online = require('../models/online')
const Ngoles = require('../models/ngoles')
const MitraPayments = require('../models/mitraPayment')
const Reseller = require('../models/reseller')
const Bank = require('../models/banks')
const moment = require('moment')

function dateFilter(startDate, endDate, field = 'createdAt') {
  if (!startDate || !endDate) return {}

  return {
    [field]: {
      $gte: startDate,
      $lte: endDate
    }
  }
}

exports.getSalesReport = async (req, res) => {
    try {
    const startDate = moment(req.query.start).set('hour', 0).set('minute', 0).set('second', 0).toDate()
    const endDate = moment(req.query.end).set('hour', 23).set('minute', 59).set('second', 59).toDate()
    const shopId = ''
    const baseMatch = dateFilter(startDate, endDate)
    
    const shopMatch = shopId
      ? { shopId: new mongoose.Types.ObjectId(shopId) }
      : {}

    const offline = await Sales.aggregate([
      {
        $match: {
          ...baseMatch,
          ...shopMatch
        }
      },
      {
        $project: {
          source: 'OFFLINE',
          trxNo: '$salesNo',
          shopId: 1,
          grandTotal: { $ifNull: ['$grandTotal', 0] },
          cash: { $ifNull: ['$cash', 0] },
          transfer: { $ifNull: ['$transfer', 0] },
          debit: { $ifNull: ['$debit', 0] },
          bankId: 1,
          paymentMethod: 1,
          qtySold: { $sum: '$items.qty' },
          createdAt: 1
        }
      }
    ])

    const online = await Online.aggregate([
      {
        $match: baseMatch
      },
      {
        $project: {
          source: 'ONLINE',
          trxNo: '$onlineNo',
          shopId: null,
          grandTotal: { $ifNull: ['$grandTotal', 0] },

          // asumsi online masuk transfer
          cash: { $literal: 0 },
          transfer: { $ifNull: ['$grandTotal', 0] },
          debit: { $literal: 0 },

          bankId: 1,
          paymentMethod: { $literal: 'TRANSFER' },
          qtySold: { $sum: '$items.qty' },
          status: 1,
          createdAt: 1
        }
      }
    ])

    const ngoles = await Ngoles.aggregate([
      {
        $match: {
          ...baseMatch,
          ...shopMatch
        }
      },
      {
        $project: {
          source: 'NGOLES',
          trxNo: '$ngolesNo',
          shopId: 1,
          grandTotal: { $ifNull: ['$grandTotal', 0] },

          // ngoles belum punya breakdown pembayaran
          cash: {
            $cond: [
              { $eq: ['$status', 'LUNAS'] },
              { $ifNull: ['$grandTotal', 0] },
              0
            ]
          },
          transfer: { $literal: 0 },
          debit: { $literal: 0 },

          bankId: null,
          paymentMethod: '$status',
          qtySold: { $sum: '$items.qty' },
          status: 1,
          createdAt: 1
        }
      }
    ])

    const mitra = await MitraPayments.aggregate([
      {
        $match: baseMatch
      },
      {
        $project: {
          source: 'MITRA',
          trxNo: '$paymentNo',
          shopId: null,
          grandTotal: {
                $sum: '$items.total'
            },

          // asumsi pembayaran mitra masuk cash karena model belum ada bank/paymentMethod
          cash: {
                $sum: '$items.total'
            },
          transfer: { $literal: 0 },
          debit: { $literal: 0 },

          bankId: null,
          paymentMethod: { $literal: 'CASH' },
          qtySold: { $sum: '$items.qty' },
          createdAt: 1
        }
      }
    ])
    const reseller = await Reseller.aggregate([
      {
        $match: {
          ...baseMatch,
          ...shopMatch
        }
      },
      {
        $project: {
          source: 'RESELLER',
          trxNo: '$resellerNo',
          shopId: 1,
          grandTotal: { $ifNull: ['$grandTotal', 0] },
          cash: { $ifNull: ['$bayar', 0] },
          transfer: { $literal: 0 },
          debit: { $literal: 0 },
          bankId: null,
          paymentMethod: {
            $cond: ['$status', 'LUNAS', 'BELUM LUNAS']
          },
          qtySold: { $sum: '$items.qty' },
          status: 1,
          bayar: 1,
          sisa: 1,
          createdAt: 1
        }
      }
    ])

    const details = [
      ...offline,
      ...online,
      ...ngoles,
      ...mitra,
      ...reseller
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    const summary = details.reduce((acc, trx) => {
      acc.grandTotal += trx.grandTotal || 0
      acc.cash += trx.cash || 0
      acc.transfer += trx.transfer || 0
      acc.debit += trx.debit || 0
      acc.qtySold += trx.qtySold || 0
      acc.trxCount += 1
      return acc
    }, {
      grandTotal: 0,
      cash: 0,
      transfer: 0,
      debit: 0,
      qtySold: 0,
      trxCount: 0
    })

    const sourceSummary = Object.values(
      details.reduce((acc, trx) => {
        if (!acc[trx.source]) {
          acc[trx.source] = {
            source: trx.source,
            trxCount: 0,
            grandTotal: 0,
            cash: 0,
            transfer: 0,
            debit: 0,
            qtySold: 0
          }
        }

        acc[trx.source].trxCount += 1
        acc[trx.source].grandTotal += trx.grandTotal || 0
        acc[trx.source].cash += trx.cash || 0
        acc[trx.source].transfer += trx.transfer || 0
        acc[trx.source].debit += trx.debit || 0
        acc[trx.source].qtySold += trx.qtySold || 0

        return acc
      }, {})
    ).sort((a, b) => b.grandTotal - a.grandTotal)

    const paymentSummary = [
      {
        method: 'CASH',
        total: summary.cash
      },
      {
        method: 'TRANSFER',
        total: summary.transfer
      },
      {
        method: 'DEBIT',
        total: summary.debit
      }
    ]
    const bankIds = [
  ...new Set(
    details
      .filter(item => item.bankId)
      .map(item => item.bankId.toString())
  )
]

const banks = await Bank.find({
  _id: { $in: bankIds }
}).lean()

const bankMap = banks.reduce((acc, bank) => {
    acc[bank._id.toString()] = bank
        return acc
    }, {})

    const summaryBank = Object.values(
        details.reduce((acc, trx) => {
            if (!trx.bankId) return acc

            const bankId = trx.bankId.toString()

            // skip TUNAI
            if (bankId === '64f01ad71e97526902e474d9') {
                return acc
            }

            const bank = bankMap[bankId]

            if (!acc[bankId]) {
                acc[bankId] = {
                    bankId,
                    bankName: bank?.name || '-',
                    accountNumber: bank?.accountNumber || '-',
                    accountName: bank?.accountName || '-',
                    trxCount: 0,
                    cash: 0,
                    transfer: 0,
                    debit: 0,
                    total: 0
                }
            }

            acc[bankId].trxCount += 1
            acc[bankId].transfer += trx.transfer || 0
            acc[bankId].debit += trx.debit || 0
            acc[bankId].total +=
            (trx.transfer || 0) +
            (trx.debit || 0)

            return acc
        }, {})
    ).sort((a, b) => b.total - a.total)

    res.json({
      success: true,
      data: {
        summary,
        sourceSummary,
        paymentSummary,
        summaryBank
      }
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}