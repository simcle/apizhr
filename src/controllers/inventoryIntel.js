const InventoryIntelDaily = require('../models/InventoryIntelDaily');
const SalesDaily = require('../models/SalesDaily')
const Shops = require('../models/shops')
const Product = require('../models/products');
const ExcelJS = require('exceljs');
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



exports.getOrders = async (req, res) => {
  
  const isExport = req.query.export === 'excel'
  try {
    const date = await getLatestSnapshotDate()
    if (!date) {
      return res.json({
        status: true,
        date: null,
        total: 0,
        data: [],
        message: "Belum ada snapshot inventory intelligence"
      });
    }
    
    const match = {
      date,
      action: 'ORDER'
    };
    const orders = await InventoryIntelDaily.aggregate([
      {$match: match},
      {$group: {
        _id: '$productId',
        date: {$first: '$date'},
        action: {$addToSet: '$action'},
        rop: {$sum: '$rop'},
        ads: {$avg: '$ads'},
        status: {$addToSet: '$status'},
        leadTimeDays: {$first: '$leadTimeDays'},
        totalDemand: {$sum: '$sumSoldWindow'},
        totalRecommended: { $sum: "$recommendedQty" },
        totalWarehouseStock: { $first: "$warehouseStockOnHand" },
        avgPriority: { $avg: "$priorityScore" }
      }},
      {
        $addFields: {
          netToOrder: {
            $max: [
              { $subtract: ["$totalRecommended", "$totalWarehouseStock"] },
              0
            ]
          }
        }
      },
      { $match: { netToOrder: { $gt: 0 } } },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      {
        $match: {
          "product.flow": 'Receipts'
        }
      },
      {
        $addFields: {
          parentGroup: {
            $ifNull: ["$product.parentId", "$_id"]
          }
        }
      },
      {
        $group: {
          _id: "$parentGroup",
          variants: {
            $push: {
              productId: "$_id",
              sku: "$product.sku",
              name: "$product.name",
              netToOrder: "$netToOrder",
              totalDemand: "$totalDemand"
            }
          },
          totalNetToOrder: { $sum: "$netToOrder" },
          totalDemand: { $sum: "$totalDemand" },
          avgPriority: { $avg: "$avgPriority" }
        }
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "parent"
        }
      },
      { $unwind: "$parent" },
      {
        $project: {
          _id: 0,
          parentId: "$_id",
          parentName: "$parent.name",
          parentSku: "$parent.sku",
          variants: 1,
          totalNetToOrder: 1,
          totalDemand: 1,
          avgPriority: 1
        }
      },
      { $sort: { avgPriority: -1 } }
    ])
    if(!isExport) {
      res.json({
        status: true,
        date,
        total: orders.length,
        data: orders
      });
    }
    // =============================
    // EXCEL EXPORT
    // =============================
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Purchase Planning');

    sheet.columns = [
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Nama Barang', key: 'name', width: 40 },
      { header: 'Demand', key: 'demand', width: 15 },
      { header: 'Net Order', key: 'net', width: 15 },
    ];

    // Header Style
    const headerRow = sheet.getRow(1);
    headerRow.height = 23;
    sheet.getRow(1).font = { bold: true, height: 22 };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F1E35' }
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    orders.forEach(parent => {

      // 🔵 Parent Row
      const parentRow = sheet.addRow({
        sku: parent.parentName,
        name: '',
        demand: '',
        net: ''
      });

      parentRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9E2F3' }
      };

      parentRow.font = { bold: true };

      // 🟢 Variant Rows
      parent.variants.forEach(variant => {
        sheet.addRow({
          sku: variant.sku,
          name: variant.name,
          demand: variant.totalDemand,
          net: variant.netToOrder
        });
      });

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) row.height = 21; // bisa 22/24 sesuai selera
      });
      sheet.eachRow((row) => {
        row.alignment = { vertical: 'middle' };
      });

    });

    sheet.getColumn('demand').numFmt = '#,##0';
    sheet.getColumn('net').numFmt = '#,##0';

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=purchase-planning-${date}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    
  }
}

exports.getShops = async (req, res) => {
  const data = await Shops.find().sort({name: '1'})
  res.status(200).json(data)
}