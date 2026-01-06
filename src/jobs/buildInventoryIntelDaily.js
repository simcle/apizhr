const Inventory = require('../models/inventory');
const Product = require('../models/products');
const SalesDaily = require('../models/SalesDaily');
const InventoryIntelDaily = require('../models/InventoryIntelDaily');

// konfigurasi default (bisa kamu pindah ke ENV/Config)
const WINDOW_DAYS = 30;
const EPS = 0.1;
const DOC_SIAGA_DAYS = 2;
const DOC_WASPADA_DAYS = 7;
const TARGET_COVER_DAYS = 14;

// Wajib: set shopId gudang di ENV agar tidak nanya-nanya
// contoh: WAREHOUSE_SHOP_ID="6760...."
const WAREHOUSE_SHOP_ID = "647aa84733581aaca9c7725b";

function dateMinusDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00+07:00`);
  const from = new Date(d.getTime() - days * 24 * 60 * 60 * 1000);
  // balikkan "YYYY-MM-DD"
  const yyyy = from.getFullYear();
  const mm = String(from.getMonth() + 1).padStart(2, '0');
  const dd = String(from.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function calcStatus({ stockOnHand, ads, daysOfCover, rop }) {
  const reasons = [];

  if (stockOnHand === 0 && ads > 0.2) {
    reasons.push('Stockout & Demand>0');
    return { status: 'AWAS', reasons };
  }

  if (daysOfCover <= DOC_SIAGA_DAYS && ads > 0.2) {
    reasons.push(`DOC<=${DOC_SIAGA_DAYS}`);
    return { status: 'SIAGA', reasons };
  }

  if ((daysOfCover <= DOC_WASPADA_DAYS && ads > 0.2) || stockOnHand <= rop) {
    if (daysOfCover <= DOC_WASPADA_DAYS) reasons.push(`DOC<=${DOC_WASPADA_DAYS}`);
    if (stockOnHand <= rop) reasons.push('Stock<=ROP');
    return { status: 'WASPADA', reasons };
  }

  return { status: 'AMAN', reasons };
}

function decideAction({ status, warehouseStockOnHand, productFlow }) {
  if (status === 'AMAN') return { action: 'NO_ACTION', reasons: [] };

  // kalau gudang ada stok → transfer
  if (warehouseStockOnHand > 0) return { action: 'TRANSFER', reasons: ['WarehouseStockAvailable'] };

  // kalau tidak ada gudang → order/produksi tergantung flow
  if (productFlow && String(productFlow).toUpperCase() === 'PRODUCTION') return { action: 'PRODUKSI', reasons: ['NoWarehouseStock'] };

  return { action: 'ORDER', reasons: ['NoWarehouseStock'] };
}

function calcRecommendedQty({ stockOnHand, ads }) {
  // target cover 14 hari (bisa kamu ubah)
  const target = ads * TARGET_COVER_DAYS;
  const need = Math.ceil(Math.max(0, target - stockOnHand));
  return need;
}

function calcPriorityScore({ status, ads, daysOfCover }) {
  // skor sederhana tapi efektif:
  // status weight + demand + urgensi DOC
  const w =
    status === 'AWAS' ? 1.0 :
    status === 'SIAGA' ? 0.8 :
    status === 'WASPADA' ? 0.5 : 0.0;

  const demandFactor = Math.min(1, ads / 10); // ads>=10 dianggap tinggi
  const urgency = daysOfCover <= 0 ? 1 : Math.min(1, 1 / daysOfCover);

  return Number((w * 0.6 + demandFactor * 0.25 + urgency * 0.15).toFixed(4));
}

async function buildInventoryIntelForDate(dateStr) {
  if (!WAREHOUSE_SHOP_ID) {
    throw new Error('WAREHOUSE_SHOP_ID belum di-set. Isi ENV WAREHOUSE_SHOP_ID dengan shopId gudang.');
  }

  // 1) Ambil semua inventory non-zero / atau semua inventory (pilih sesuai kebutuhan)
const invList = await Inventory.find({
  shopId: { $exists: true, $ne: null }
})
.select('shopId productId qty')
.lean();
  if (!invList.length) return { upserted: 0 };

  // 2) Ambil product metadata untuk semua productId yang muncul di inventory
  const productIds = [...new Set(invList.map(x => String(x.productId)))];
  const products = await Product.find({ _id: { $in: productIds } })
    .select('_id sku flow leadTimeDays safetyDays isActive')
    .lean();

  const productMap = new Map(products.map(p => [String(p._id), p]));

  // 3) Ambil stok gudang untuk productIds (sekali query)
  const whInv = await Inventory.find({ shopId: WAREHOUSE_SHOP_ID, productId: { $in: productIds } })
    .select('productId qty')
    .lean();

  const whMap = new Map(whInv.map(x => [String(x.productId), x.qty || 0]));

  // 4) Ambil sales window untuk semua SKU+shopId yang ada di inventory
  const fromDate = dateMinusDays(dateStr, WINDOW_DAYS - 1);

  // Kita ambil sales_daily dalam window untuk semua lokasi yang ada di inventory,
  // lalu group di memory (lebih cepat daripada query per item).
  const shopIds = [
    ...new Set(
      invList
        .map(x => x.shopId)
        .filter(Boolean)       // 🔥 buang null / undefined
        .map(id => String(id))
    )
  ];

  const sdRows = await SalesDaily.find({
    date: { $gte: fromDate, $lte: dateStr },
    shopId: { $in: shopIds },
    productId: { $in: productIds },
  }).select('shopId productId qtySold').lean();

  // key: shopId|productId -> sumSold
  const soldMap = new Map();
  for (const r of sdRows) {
    const key = `${String(r.shopId)}|${String(r.productId)}`;
    soldMap.set(key, (soldMap.get(key) || 0) + (r.qtySold || 0));
  }

  // 5) Build bulk ops untuk inv_intel_daily
  const ops = [];
  for (const inv of invList) {
    const product = productMap.get(String(inv.productId));
    if (!product || product.isActive === false) continue;

    const stockOnHand = inv.qty || 0;
    const warehouseStockOnHand = whMap.get(String(inv.productId)) || 0;

    const sumSoldWindow = soldMap.get(`${String(inv.shopId)}|${String(inv.productId)}`) || 0;
    const ads = Number((sumSoldWindow / WINDOW_DAYS).toFixed(4));

    const daysOfCover = ads > EPS ? Number((stockOnHand / ads).toFixed(2)) : (stockOnHand > 0 ? 9999 : 0);

    const leadTimeDays = Number(product.leadTimeDays || 5);
    const safetyDays = Number(product.safetyDays || 2);

    const rop = Number((ads * (leadTimeDays + safetyDays)).toFixed(2));

    const { status, reasons: statusReasons } = calcStatus({ stockOnHand, ads, daysOfCover, rop });
    const { action, reasons: actionReasons } = decideAction({
      status,
      warehouseStockOnHand,
      productFlow: product.flow
    });

    let recommendedQty = 0;
    if (action === 'ORDER' || action === 'PRODUKSI') {
      recommendedQty = calcRecommendedQty({ stockOnHand, ads });
    } else if (action === 'TRANSFER') {
      // kebutuhan toko untuk cover 14 hari, maksimal stok gudang
      const need = calcRecommendedQty({ stockOnHand, ads });
      recommendedQty = Math.min(need, warehouseStockOnHand);
    }

    const priorityScore = calcPriorityScore({ status, ads, daysOfCover });

    const doc = {
      date: dateStr,
      shopId: inv.shopId,
      productId: inv.productId,
      sku: product.sku,

      stockOnHand,
      warehouseStockOnHand,

      windowDays: WINDOW_DAYS,
      sumSoldWindow,
      ads,
      daysOfCover,

      leadTimeDays,
      safetyDays,
      rop,

      status,
      action,
      recommendedQty,
      priorityScore,

      reasons: [...statusReasons, ...actionReasons],
    };

    ops.push({
      updateOne: {
        filter: { date: dateStr, shopId: inv.shopId, productId: inv.productId },
        update: { $set: doc },
        upsert: true
      }
    });
  }

  if (!ops.length) return { upserted: 0 };

  const res = await InventoryIntelDaily.bulkWrite(ops, { ordered: false });
  const upserted = (res.upsertedCount || 0) + (res.modifiedCount || 0) + (res.matchedCount || 0);

  return { upserted };
}

module.exports = { buildInventoryIntelForDate };

