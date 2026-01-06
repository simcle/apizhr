const InventoryIntelDaily = require('../models/InventoryIntelDaily');
const Product = require('../models/products');
const mongoose = require('mongoose');

/**
 * Helper: tanggal default = hari ini WIB
 */
function todayWIB() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

exports.getSummary = async (req, res) => {
  try {
    const date = req.query.date || todayWIB();
    const shopId = req.query.shopId;

    const match = { date };
    if (shopId) match.shopId = new mongoose.Types.ObjectId(shopId);

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
    const date = req.query.date || todayWIB();
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
    const date = req.query.date || todayWIB();
    const action = req.query.action;

    const match = { date };
    if (action) match.action = action;
    if (req.query.shopId) {
      match.shopId = new mongoose.Types.ObjectId(req.query.shopId);
    }

    const data = await InventoryIntelDaily.find(match)
      .sort({ priorityScore: -1 })
      .populate('productId', 'name sku')
      .limit(100)
      .lean();

    res.json({
      status: true,
      date,
      action,
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