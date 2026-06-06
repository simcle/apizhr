require('dotenv').config();
const mongoose = require('mongoose');

const { buildSalesDailyForDate } = require('../src/jobs/buildSalesDaily');
const { buildInventoryIntelForDate } = require('../src/jobs/buildInventoryIntelDaily');
const { buildDeadStockDailyForDate } = require('../src/jobs/buildDeadStockDaily')
const { buildParentProductHealthDaily } = require('../src/jobs/buildParentProductHealthDaily')
const { buildTransferRecommendationDaily } = require('../src/jobs/buildTransferRecommendationDaily')

async function main() {
  const dateStr = process.argv[2]; // "YYYY-MM-DD"
  if (!dateStr) {
    console.error('Usage: node scripts/run_inv_intel.js YYYY-MM-DD');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  console.log('[1] Build SalesDaily for:', dateStr);
  const r1 = await buildSalesDailyForDate(dateStr);
  console.log('SalesDaily:', r1);

  console.log('[2] Build Inventory Intelligence for:', dateStr);
  const r2 = await buildInventoryIntelForDate(dateStr);
  console.log('InventoryIntelDaily:', r2);

  console.log('[3] Build Dead Stock Daily for:', dateStr)
  const r3 = await buildDeadStockDailyForDate(dateStr)
  console.log('DeadStockDaily:', r3)

  console.log('[4] Build Parent Product Health for:', dateStr)
  const r4 = await buildParentProductHealthDaily(dateStr)
  console.log('ParentProductHealthDaily:', r4)

  console.log('[5] Build Transfer Recommendation for:', dateStr)
  const r5 = await buildTransferRecommendationDaily(dateStr)
  console.log('TransferRecommendationDaily:', r5)

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

// WAREHOUSE_SHOP_ID="647aa84733581aaca9c7725b" MONGODB_URI="mongodb://admin:pwlan123@82.29.162.105:27017/zhrleather?authSource=admin" node scripts/run_inv_intel.js 2026-06-05