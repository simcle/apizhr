const Inventory = require('../models/inventory')
const Product = require('../models/products')
const Shop = require('../models/shops')
const SalesDaily = require('../models/SalesDaily')
const InventoryIntelDaily = require('../models/InventoryIntelDaily')

const WINDOW_DAYS = 30
const EPS = 0.1

const DOC_SIAGA_DAYS = 2
const DOC_WASPADA_DAYS = 7

const TARGET_COVER_DAYS = 14

const WAREHOUSE_SHOP_ID = '647aa84733581aaca9c7725b'


function dateMinusDays(dateStr, days) {
    const date = new Date(
        `${dateStr}T00:00:00+07:00`
    )

    const from = new Date(
        date.getTime() -
        days * 24 * 60 * 60 * 1000
    )

    const yyyy =
        from.getFullYear()

    const mm =
        String(
            from.getMonth() + 1
        ).padStart(2, '0')

    const dd =
        String(
            from.getDate()
        ).padStart(2, '0')

    return `${yyyy}-${mm}-${dd}`
}


function calcStatus({
    stockOnHand,
    ads,
    daysOfCover,
    rop
}) {
    const reasons = []

    /*
     * Tidak ada meaningful demand.
     */
    if (ads < EPS) {
        reasons.push(
            'NoDemand'
        )

        return {
            status: 'AMAN',
            reasons
        }
    }

    /*
     * Produk mempunyai demand tetapi stok habis.
     */
    if (stockOnHand <= 0) {
        reasons.push(
            'Stockout & Demand>0'
        )

        return {
            status: 'AWAS',
            reasons
        }
    }

    /*
     * Stok diperkirakan hanya cukup <= 2 hari.
     */
    if (
        daysOfCover <=
        DOC_SIAGA_DAYS
    ) {
        reasons.push(
            `DOC<=${DOC_SIAGA_DAYS}`
        )

        return {
            status: 'SIAGA',
            reasons
        }
    }

    /*
     * Stok mulai berisiko:
     *
     * - cover <= 7 hari
     * - atau sudah menyentuh reorder point
     */
    if (
        daysOfCover <=
        DOC_WASPADA_DAYS ||
        stockOnHand <= rop
    ) {
        if (
            daysOfCover <=
            DOC_WASPADA_DAYS
        ) {
            reasons.push(
                `DOC<=${DOC_WASPADA_DAYS}`
            )
        }

        if (
            stockOnHand <= rop
        ) {
            reasons.push(
                'Stock<=ROP'
            )
        }

        return {
            status: 'WASPADA',
            reasons
        }
    }

    return {
        status: 'AMAN',
        reasons
    }
}


function decideAction({
    status,
    warehouseStockOnHand,
    productFlow
}) {
    if (status === 'AMAN') {
        return {
            action: 'NO_ACTION',
            reasons: []
        }
    }

    /*
     * Gudang masih mempunyai stok.
     *
     * TRANSFER di sini hanya menunjukkan
     * supply source utama tersedia.
     *
     * recommendedQty tetap menyimpan
     * kebutuhan penuh destination.
     */
    if (warehouseStockOnHand > 0) {
        return {
            action: 'TRANSFER',
            reasons: [
                'WarehouseStockAvailable'
            ]
        }
    }

    /*
     * Tidak tersedia di gudang.
     * Tentukan produksi / order berdasarkan flow produk.
     */
    if (
        productFlow &&
        String(productFlow).toUpperCase() ===
        'PRODUCTION'
    ) {
        return {
            action: 'PRODUKSI',
            reasons: [
                'NoWarehouseStock'
            ]
        }
    }

    return {
        action: 'ORDER',
        reasons: [
            'NoWarehouseStock'
        ]
    }
}


function calcRecommendedQty({
    stockOnHand,
    ads
}) {
    const target =
        ads *
        TARGET_COVER_DAYS

    return Math.ceil(
        Math.max(
            0,
            target - stockOnHand
        )
    )
}


function calcPriorityScore({
    status,
    ads,
    daysOfCover
}) {
    const statusWeight =
        status === 'AWAS'
            ? 1
            : status === 'SIAGA'
                ? 0.8
                : status === 'WASPADA'
                    ? 0.5
                    : 0

    const demandFactor =
        Math.min(
            1,
            ads / 10
        )

    const urgency =
        daysOfCover <= 0
            ? 1
            : Math.min(
                1,
                1 / daysOfCover
            )

    return Number(
        (
            statusWeight * 0.6 +
            demandFactor * 0.25 +
            urgency * 0.15
        ).toFixed(4)
    )
}


async function buildInventoryIntelForDate(
    dateStr
) {
    /*
     * Intelligence hanya dibuat untuk:
     *
     * STORE
     * ONLINE
     *
     * WAREHOUSE dan WORKSHOP tidak menjadi
     * destination intelligence.
     */
    const operationalShops =
        await Shop
            .find({
                type: {
                    $in: [
                        'STORE',
                        'ONLINE'
                    ]
                }
            })
            .select(
                '_id type'
            )
            .lean()

    if (!operationalShops.length) {
        await InventoryIntelDaily.deleteMany({
            date: dateStr
        })

        return {
            processed: 0,
            upserted: 0,
            deleted: 0
        }
    }

    const shopMap =
        new Map(
            operationalShops.map(shop => [
                String(shop._id),
                shop
            ])
        )

    const operationalShopIds =
        operationalShops.map(
            shop => shop._id
        )

    /*
     * Inventory tetap single source of truth.
     *
     * Di sini kita hanya mengambil inventory
     * milik STORE + ONLINE.
     */
    const invList =
        await Inventory
            .find({
                shopId: {
                    $in:
                        operationalShopIds
                }
            })
            .select(
                'shopId productId qty'
            )
            .lean()

    if (!invList.length) {
        const deleteResult =
            await InventoryIntelDaily
                .deleteMany({
                    date: dateStr
                })

        return {
            processed: 0,
            upserted: 0,
            deleted:
                deleteResult.deletedCount || 0
        }
    }

    /*
     * Product yang benar-benar muncul
     * pada inventory destination.
     */
    const productIds = [
        ...new Set(
            invList.map(item => {
                return String(
                    item.productId
                )
            })
        )
    ]

    const products =
        await Product
            .find({
                _id: {
                    $in:
                        productIds
                }
            })
            .select(
                '_id sku flow leadTime safetyDays isActive'
            )
            .lean()

    const productMap =
        new Map(
            products.map(product => [
                String(product._id),
                product
            ])
        )

    /*
     * Stok gudang.
     *
     * Gudang tidak dibuatkan intelligence,
     * tetapi tetap menjadi supply source.
     */
    const warehouseInventory =
        await Inventory
            .find({
                shopId:
                    WAREHOUSE_SHOP_ID,

                productId: {
                    $in:
                        productIds
                }
            })
            .select(
                'productId qty'
            )
            .lean()

    const warehouseMap =
        new Map(
            warehouseInventory.map(
                item => [
                    String(item.productId),
                    Number(item.qty || 0)
                ]
            )
        )

    /*
     * Demand window.
     */
    const fromDate =
        dateMinusDays(
            dateStr,
            WINDOW_DAYS - 1
        )

    const shopIds = [
        ...new Set(
            invList
                .map(item => {
                    return String(
                        item.shopId
                    )
                })
        )
    ]

    const salesRows =
        await SalesDaily
            .find({
                date: {
                    $gte: fromDate,
                    $lte: dateStr
                },

                shopId: {
                    $in:
                        shopIds
                },

                productId: {
                    $in:
                        productIds
                }
            })
            .select(
                'shopId productId qtySold'
            )
            .lean()

    /*
     * key:
     *
     * shopId|productId
     */
    const soldMap =
        new Map()

    for (const row of salesRows) {
        const key =
            `${String(row.shopId)}|${String(row.productId)}`

        soldMap.set(
            key,
            (
                soldMap.get(key) ||
                0
            ) +
            Number(
                row.qtySold || 0
            )
        )
    }

    const ops = []

    /*
     * Dipakai untuk stale snapshot cleanup.
     */
    const activeSnapshotKeys =
        []

    for (const inv of invList) {
        const shop =
            shopMap.get(
                String(inv.shopId)
            )

        if (!shop) {
            continue
        }

        const product =
            productMap.get(
                String(inv.productId)
            )

        if (
            !product ||
            product.isActive === false
        ) {
            continue
        }

        const stockOnHand =
            Number(
                inv.qty || 0
            )

        const warehouseStockOnHand =
            warehouseMap.get(
                String(inv.productId)
            ) || 0

        const salesKey =
            `${String(inv.shopId)}|${String(inv.productId)}`

        const sumSoldWindow =
            soldMap.get(
                salesKey
            ) || 0

        const ads =
            Number(
                (
                    sumSoldWindow /
                    WINDOW_DAYS
                ).toFixed(4)
            )

        /*
         * Harus konsisten dengan EPS pada calcStatus.
         */
        const daysOfCover =
            ads >= EPS
                ? Number(
                    (
                        stockOnHand /
                        ads
                    ).toFixed(2)
                )
                : stockOnHand > 0
                    ? 9999
                    : 0

        const leadTimeDays =
            Number(
                product.leadTime ??
                5
            )

        const safetyDays =
            Number(
                product.safetyDays ??
                2
            )

        const rop =
            Number(
                (
                    ads *
                    (
                        leadTimeDays +
                        safetyDays
                    )
                ).toFixed(2)
            )

        const {
            status,
            reasons:
                statusReasons
        } = calcStatus({
            stockOnHand,
            ads,
            daysOfCover,
            rop
        })

        const {
            action,
            reasons:
                actionReasons
        } = decideAction({
            status,
            warehouseStockOnHand,
            productFlow:
                product.flow
        })

        /*
         * recommendedQty =
         * kebutuhan penuh destination.
         *
         * Tidak dibatasi stok gudang.
         */
        const recommendedQty =
            status === 'AMAN'
                ? 0
                : calcRecommendedQty({
                    stockOnHand,
                    ads
                })

        const priorityScore =
            calcPriorityScore({
                status,
                ads,
                daysOfCover
            })

        const doc = {
            date:
                dateStr,

            shopId:
                inv.shopId,

            shopType:
                shop.type,

            productId:
                inv.productId,

            sku:
                product.sku,

            stockOnHand,
            warehouseStockOnHand,

            windowDays:
                WINDOW_DAYS,

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

            reasons: [
                ...statusReasons,
                ...actionReasons
            ]
        }

        activeSnapshotKeys.push({
            shopId:
                inv.shopId,

            productId:
                inv.productId
        })

        ops.push({
            updateOne: {
                filter: {
                    date:
                        dateStr,

                    shopId:
                        inv.shopId,

                    productId:
                        inv.productId
                },

                update: {
                    $set:
                        doc
                },

                upsert:
                    true
            }
        })
    }

    let writeResult = null

    if (ops.length) {
        writeResult =
            await InventoryIntelDaily
                .bulkWrite(
                    ops,
                    {
                        ordered: false
                    }
                )
    }

    /*
     * Cleanup snapshot stale.
     *
     * Hanya mempertahankan STORE + ONLINE
     * yang benar-benar masuk hasil build saat ini.
     */
    let deleted = 0

    if (activeSnapshotKeys.length) {
        const deleteResult =
            await InventoryIntelDaily
                .deleteMany({
                    date:
                        dateStr,

                    $nor:
                        activeSnapshotKeys
                })

        deleted =
            deleteResult.deletedCount ||
            0
    } else {
        const deleteResult =
            await InventoryIntelDaily
                .deleteMany({
                    date:
                        dateStr
                })

        deleted =
            deleteResult.deletedCount ||
            0
    }

    return {
        processed:
            ops.length,

        inserted:
            writeResult?.upsertedCount ||
            0,

        modified:
            writeResult?.modifiedCount ||
            0,

        matched:
            writeResult?.matchedCount ||
            0,

        deleted
    }
}


module.exports = {
    buildInventoryIntelForDate
}