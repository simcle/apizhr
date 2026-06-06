const mongoose = require('mongoose')

const InventoryIntelDaily = require('../models/InventoryIntelDaily')
const TransferRecommendationDaily = require('../models/TransferRecommendationDaily')

async function buildTransferRecommendationDaily(dateStr) {

  /**
   * Ambil seluruh inventory intelligence
   * hanya toko STORE + ONLINE
   */
  const rows = await InventoryIntelDaily.aggregate([

    {
      $match: {
        date: dateStr
      }
    },

    {
      $lookup: {
        from: 'shops',
        localField: 'shopId',
        foreignField: '_id',
        as: 'shop'
      }
    },

    { $unwind: '$shop' },

    {
      $match: {
        'shop.type': {
          $in: ['STORE', 'ONLINE']
        }
      }
    },

    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'product'
      }
    },

    { $unwind: '$product' }

  ]).allowDiskUse(true)

  if (!rows.length) {

    await TransferRecommendationDaily.deleteMany({
      date: dateStr
    })

    return {
      upserted: 0
    }
  }

  /**
   * Group by SKU
   */
  const productMap = new Map()

  for (const row of rows) {

    const product = row.product
    const shop = row.shop

    if (!product?._id || !shop?._id) continue

    const key = String(product._id)

    if (!productMap.has(key)) {

      productMap.set(key, {
        productId: product._id,
        sku: product.sku,
        productName: product.name,

        parentId:
          product.parentId || product._id,

        parentName:
          product.parentName || product.name,

        shops: []
      })
    }

    productMap.get(key).shops.push({

      shopId: shop._id,
      shopName: shop.name,

      stockOnHand:
        row.stockOnHand || 0,

      ads:
        row.ads || 0,

      daysOfCover:
        row.daysOfCover || 999
    })
  }

  const recommendations = []

  /**
   * Cari source & target
   */
  for (const item of productMap.values()) {

    const shops = item.shops

    /**
     * kandidat source:
     * stok tinggi + ADS rendah
     */
    const sources = shops.filter(shop => {

      return (
        shop.stockOnHand > 2 &&
        shop.daysOfCover > 30 &&
        shop.ads <= 0.1
      )
    })

    /**
     * kandidat target:
     * stok rendah + ADS tinggi
     */
    const targets = shops.filter(shop => {

      return (
        shop.daysOfCover < 5 &&
        shop.ads >= 0.15
      )
    })

    if (!sources.length || !targets.length) {
      continue
    }

    /**
     * pair source-target
     */
    for (const source of sources) {

      for (const target of targets) {

        /**
         * jangan transfer ke toko sama
         */
        if (
          String(source.shopId) ===
          String(target.shopId)
        ) {
          continue
        }

        /**
         * estimasi kebutuhan target
         */
        const targetNeed = Math.ceil(
          (target.ads * 14) -
          target.stockOnHand
        )

        if (targetNeed <= 0) {
          continue
        }

        /**
         * spare stock source
         */
        const sourceSpare = Math.max(
          source.stockOnHand - 2,
          0
        )

        if (sourceSpare <= 0) {
          continue
        }

        /**
         * qty transfer
         */
        const transferQty = Math.min(
          targetNeed,
          sourceSpare
        )

        if (transferQty <= 0) {
          continue
        }

        /**
         * priority score
         */
        const priorityScore =
          (
            (target.ads * 100) +
            (source.daysOfCover) +
            (transferQty * 5)
          )

        const reason = []

        if (source.daysOfCover > 60) {
          reason.push(
            'Source overstock'
          )
        }

        if (target.daysOfCover < 3) {
          reason.push(
            'Target near stockout'
          )
        }

        if (target.ads >= 0.3) {
          reason.push(
            'High demand target'
          )
        }

        recommendations.push({

          date: dateStr,

          productId: item.productId,

          sku: item.sku,

          productName: item.productName,

          parentId: item.parentId,

          parentName: item.parentName,

          sourceShopId: source.shopId,
          sourceShopName: source.shopName,

          targetShopId: target.shopId,
          targetShopName: target.shopName,

          sourceStock:
            source.stockOnHand,

          targetStock:
            target.stockOnHand,

          sourceAds:
            source.ads,

          targetAds:
            target.ads,

          sourceDaysOfCover:
            source.daysOfCover,

          targetDaysOfCover:
            target.daysOfCover,

          transferQty,

          priorityScore,

          reason
        })
      }
    }
  }

  /**
   * cleanup snapshot lama
   */
  await TransferRecommendationDaily.deleteMany({
    date: dateStr
  })

  if (!recommendations.length) {

    return {
      upserted: 0
    }
  }

  /**
   * sort priority tinggi
   */
  recommendations.sort(
    (a, b) =>
      b.priorityScore -
      a.priorityScore
  )

  /**
   * bulk insert
   */
  await TransferRecommendationDaily.insertMany(
    recommendations
  )

  return {
    upserted: recommendations.length
  }
}

module.exports = {
  buildTransferRecommendationDaily
}