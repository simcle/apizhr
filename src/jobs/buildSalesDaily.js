const mongoose = require('mongoose');
const Sales = require('../models/sales'); // model kamu
const Online = require('../models/online')
const SalesDaily = require('../models/SalesDaily');

function toJakartaRange(dateStr) {
  // dateStr: "YYYY-MM-DD"
  // Range: [date 00:00 WIB, nextDate 00:00 WIB] dalam Date UTC
  // Trik aman: bikin string dengan offset +07:00
  const start = new Date(`${dateStr}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

async function buildSalesDailyForDate(dateStr) {
  const { start, end } = toJakartaRange(dateStr);

  const offlinePipeline = [
    { $match: { createdAt: { $gte: start, $lt: end } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: {
          date: dateStr,
          shopId: '$shopId',
          productId: '$items.productId',
          sku: '$items.sku',
        },
        qtySold: { $sum: '$items.qty' },
        trxCount: { $addToSet: '$_id' },
      }
    },
    {
      $project: {
        _id: 0,
        date: '$_id.date',
        shopId: '$_id.shopId',
        productId: '$_id.productId',
        sku: '$_id.sku',
        qtySold: 1,
        trxCount: { $size: '$trxCount' }
      }
    },
  ];

  const onlinePipeline = [
    { $match: { createdAt: { $gte: start, $lt: end } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: {
          date: dateStr,
          shopId: mongoose.Types.ObjectId('6475d52daa375fa751092f5d'),
          productId: '$items.productId',
          sku: '$items.sku',
        },
        qtySold: { $sum: '$items.qty' },
        trxCount: { $addToSet: '$_id' },
      }
    },
    {
      $project: {
        _id: 0,
        date: '$_id.date',
        shopId: '$_id.shopId',
        productId: '$_id.productId',
        sku: '$_id.sku',
        qtySold: 1,
        trxCount: { $size: '$trxCount' }
      }
    },
  ]

  const offlineRows = await Sales.aggregate(offlinePipeline).allowDiskUse(true)
  const onlineRows = await Online.aggregate(onlinePipeline).allowDiskUse(true)

  const rows = [...offlineRows, ...onlineRows]

  if (!rows.length) return { insertedOrUpdated: 0 };

  const ops = rows.map(r => ({
    updateOne: {
      filter: { date: r.date, shopId: r.shopId, productId: r.productId },
      update: { $set: r },
      upsert: true
    }
  }));

  const res = await SalesDaily.bulkWrite(ops, { ordered: false });
  const count = (res.upsertedCount || 0) + (res.modifiedCount || 0) + (res.matchedCount || 0);

  return { insertedOrUpdated: count };
}

module.exports = { buildSalesDailyForDate };