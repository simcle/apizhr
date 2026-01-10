const InventoryIntelDaily = require('../models/InventoryIntelDaily');
const SalesDaily = require('../models/SalesDaily')
const Shops = require('../models/shops')
const Product = require('../models/products');
const mongoose = require('mongoose');

// ambil data lates
async function getLatestSnapshotDate() {
  const latest = await InventoryIntelDaily
    .findOne({})
    .sort({ date: -1 })
    .select('date')
    .lean();

  return latest?.date || null;
}

function daysBetween(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.floor((a - b) / (1000 * 60 * 60 * 24));
}

exports.getSummary = async (req, res) => {
  try {
    let date = req.query.date;

    // 🔥 INI KUNCINYA
    if (!date) {
      date = await getLatestSnapshotDate();

      if (!date) {
        return res.json({
          status: true,
          date: null,
          summary: {
            AMAN: 0,
            WASPADA: 0,
            SIAGA: 0,
            AWAS: 0
          },
          message: "Belum ada snapshot inventory intelligence"
        });
      }
    }

    const match = { date };
    if (req.query.shopId) {
      match.shopId = new mongoose.Types.ObjectId(req.query.shopId);
    }

    const summary = await InventoryIntelDaily.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      AMAN: 0,
      WASPADA: 0,
      SIAGA: 0,
      AWAS: 0
    };

    summary.forEach(s => {
      result[s._id] = s.count;
    });

    res.json({
      status: true,
      date,
      summary: result
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

exports.getIssues = async (req, res) => {
  try {
    let date = req.query.date;

    // 🔥 KUNCI UTAMA
    if (!date) {
      date = await getLatestSnapshotDate();

      if (!date) {
        return res.json({
          status: true,
          date: null,
          total: 0,
          data: [],
          message: "Belum ada snapshot inventory intelligence"
        });
      }
    }

    const limit = Number(req.query.limit || 50);
    const statusList = req.query.status
      ? req.query.status.split(',')
      : ['AWAS', 'SIAGA'];

    const match = {
      date,
      status: { $in: statusList }
    };

    if (req.query.shopId) {
      match.shopId = new mongoose.Types.ObjectId(req.query.shopId);
    }

    const data = await InventoryIntelDaily.find(match)
      .sort({ priorityScore: -1 })
      .limit(limit)
      .populate('productId', 'name sku price')
      .populate('shopId', 'name')
      .lean();

    res.json({
      status: true,
      date,
      total: data.length,
      data
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

exports.getActions = async (req, res) => {
  try {
    let date = req.query.date;

    // 🔥 KUNCI UTAMA
    if (!date) {
      date = await getLatestSnapshotDate();

      if (!date) {
        return res.json({
          status: true,
          date: null,
          action: req.query.action || null,
          total: 0,
          data: [],
          message: "Belum ada snapshot inventory intelligence"
        });
      }
    }

    const match = { date };

    if (req.query.action) {
      match.action = req.query.action;
    }

    if (req.query.shopId) {
      match.shopId = new mongoose.Types.ObjectId(req.query.shopId);
    }

    const data = await InventoryIntelDaily.find(match)
      .sort({ priorityScore: -1 })
      .populate('productId', 'name sku')
      .populate('shopId', 'name'  )
      .limit(100)
      .lean();

    res.json({
      status: true,
      date,
      action: req.query.action || null,
      total: data.length,
      data
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

exports.getProductDetail = async (req, res) => {
  try {
    const { productId } = req.params;
    const days = Number(req.query.days || 30);

    const data = await InventoryIntelDaily.find({
      productId,
      ...(req.query.shopId && { shopId: req.query.shopId })
    })
      .sort({ date: -1 })
      .limit(days)
      .lean();

    res.json({
      status: true,
      productId,
      data
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

exports.getDeadStock = async (req, res) => {
  try {
    let date = req.query.date;

    // 🔥 selalu pakai snapshot terakhir kalau date kosong
    if (!date) {
      date = await getLatestSnapshotDate();
      if (!date) {
        return res.json({
          status: true,
          date: null,
          total: 0,
          data: [],
          message: "Belum ada snapshot inventory intelligence"
        });
      }
    }

    const shopId = req.query.shopId;
    const level = req.query.level; 
    // WARNING | SERIOUS | CRITICAL

    const match = {
      date,
      stockOnHand: { $gt: 0 },
      ads: { $lte: 0.1 }   // hampir tidak laku
    };

    if (shopId) {
      match.shopId = new mongoose.Types.ObjectId(shopId);
    }

    // 1️⃣ ambil kandidat dead stock
    const intelRows = await InventoryIntelDaily.find(match)
      .populate('productId', 'name sku price')
      .lean();

    if (!intelRows.length) {
      return res.json({ status: true, date, total: 0, data: [] });
    }

    // 2️⃣ cari tanggal terakhir terjual per product+shop
    const productIds = [...new Set(intelRows.map(i => i.productId._id.toString()))];

    const lastSales = await SalesDaily.aggregate([
      {
        $match: {
          productId: { $in: productIds.map(id => new mongoose.Types.ObjectId(id)) },
          ...(shopId && { shopId: new mongoose.Types.ObjectId(shopId) })
        }
      },
      {
        $group: {
          _id: { productId: "$productId", shopId: "$shopId" },
          lastSoldDate: { $max: "$date" }
        }
      }
    ]);

    const lastSoldMap = new Map();
    lastSales.forEach(s => {
      lastSoldMap.set(
        `${s._id.productId}_${s._id.shopId}`,
        s.lastSoldDate
      );
    });

    // 3️⃣ klasifikasi dead stock
    const result = [];

    for (const row of intelRows) {
      const key = `${row.productId._id}_${row.shopId}`;
      const lastSold = lastSoldMap.get(key);
      const daysNoSale = lastSold
        ? daysBetween(date, lastSold)
        : 9999;

      let deadLevel = null;
      let action = null;

      if (daysNoSale >= 365) {
        deadLevel = "CRITICAL";
        action = "CLEARANCE";
      } else if (daysNoSale >= 180) {
        deadLevel = "SERIOUS";
        action = "DISCOUNT";
      } else if (daysNoSale >= 90) {
        deadLevel = "WARNING";
        action = "PROMO";
      }

      if (!deadLevel) continue;
      if (level && level !== deadLevel) continue;

      result.push({
        date,
        shopId: row.shopId,
        product: row.productId,
        stockOnHand: row.stockOnHand,
        ads: row.ads,
        daysNoSale,
        deadLevel,
        recommendedAction: action
      });
    }

    res.json({
      status: true,
      date,
      total: result.length,
      data: result
    });

  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

exports.getShops = async (req, res) => {
  const data = await Shops.find().sort({name: '1'})
  res.status(200).json(data)
}