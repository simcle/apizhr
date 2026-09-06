const mongoose = require('mongoose')

const Inventory = require('../../models/inventory')
const Product = require('../../models/products')
const Shop = require('../../models/shops')
const InventoryIntelDaily = require('../../models/InventoryIntelDaily')

const TARGET_COVER_DAYS = 14

const WAREHOUSE_SHOP_ID =
    '647aa84733581aaca9c7725b'


function createError(message, statusCode = 400) {
    const error = new Error(message)
    error.statusCode = statusCode

    return error
}


function calcTargetStock(ads) {
    return Math.ceil(
        Math.max(
            0,
            Number(ads || 0) *
            TARGET_COVER_DAYS
        )
    )
}


function getFallbackAction(productFlow) {
    if (
        productFlow &&
        String(productFlow)
            .toUpperCase() ===
            'PRODUCTION'
    ) {
        return 'PRODUKSI'
    }

    return 'ORDER'
}


async function getLatestSnapshotDate() {
    const latest =
        await InventoryIntelDaily
            .findOne({
                shopType: 'STORE'
            })
            .sort({
                date: -1
            })
            .select('date')
            .lean()

    return latest?.date || null
}


async function validateStore(shopId) {
    if (
        !mongoose.Types.ObjectId.isValid(
            shopId
        )
    ) {
        throw createError(
            'ID toko tidak valid',
            400
        )
    }

    const shop =
        await Shop
            .findOne({
                _id:
                    shopId,

                type:
                    'STORE'
            })
            .select(
                '_id name type'
            )
            .lean()

    if (!shop) {
        throw createError(
            'Toko tidak ditemukan',
            404
        )
    }

    return shop
}


async function buildSupplyPlan({
    shopId,
    date = null,
    status = null
}) {
    /*
     * --------------------------------------------------
     * DESTINATION
     * --------------------------------------------------
     */

    const destination =
        await validateStore(
            shopId
        )

    const dateStr =
        date ||
        await getLatestSnapshotDate()

    if (!dateStr) {
        return {
            date: null,

            destination,

            summary: {
                totalSku: 0,
                totalNeedQty: 0,
                warehouseAllocatedQty: 0,
                storeAllocatedQty: 0,
                internalAllocatedQty: 0,
                productionQty: 0,
                orderQty: 0,
                remainingQty: 0,
                fulfillmentRate: 0
            },

            sources: [],
            production: [],
            order: [],
            items: []
        }
    }

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
            String(dateStr)
        )
    ) {
        throw createError(
            'Format tanggal tidak valid',
            400
        )
    }

    const allowedStatuses = [
        'WASPADA',
        'SIAGA',
        'AWAS'
    ]

    if (
        status &&
        !allowedStatuses.includes(
            status
        )
    ) {
        throw createError(
            'Status inventory tidak valid',
            400
        )
    }

    /*
     * --------------------------------------------------
     * INTELLIGENCE DESTINATION
     * --------------------------------------------------
     */

    const match = {
        date:
            dateStr,

        shopType:
            'STORE',

        shopId:
            destination._id,

        status:
            status
                ? status
                : {
                    $in:
                        allowedStatuses
                }
    }

    const intelRows =
        await InventoryIntelDaily
            .find(match)
            .sort({
                priorityScore: -1,
                recommendedQty: -1,
                ads: -1
            })
            .lean()

    if (!intelRows.length) {
        return {
            date:
                dateStr,

            destination,

            summary: {
                totalSku: 0,
                totalNeedQty: 0,
                warehouseAllocatedQty: 0,
                storeAllocatedQty: 0,
                internalAllocatedQty: 0,
                productionQty: 0,
                orderQty: 0,
                remainingQty: 0,
                fulfillmentRate: 100
            },

            sources: [],
            production: [],
            order: [],
            items: []
        }
    }

    /*
     * --------------------------------------------------
     * PRODUCT MASTER
     * --------------------------------------------------
     */

    const productIds = [
        ...new Set(
            intelRows.map(item => {
                return String(
                    item.productId
                )
            })
        )
    ]

    const [
        products,
        stores,
        warehouseShop
    ] = await Promise.all([
        Product
            .find({
                _id: {
                    $in:
                        productIds
                }
            })
            .select(
                '_id name sku flow isActive'
            )
            .lean(),

        Shop
            .find({
                type:
                    'STORE',

                _id: {
                    $ne:
                        destination._id
                }
            })
            .select(
                '_id name type'
            )
            .lean(),

        Shop
            .findById(
                WAREHOUSE_SHOP_ID
            )
            .select(
                '_id name type'
            )
            .lean()
    ])

    const productMap =
        new Map(
            products.map(product => [
                String(product._id),
                product
            ])
        )

    const donorStoreIds =
        stores.map(store => {
            return store._id
        })

    /*
     * --------------------------------------------------
     * INVENTORY AKTUAL
     * --------------------------------------------------
     *
     * Inventory tetap single source of truth.
     *
     * Yang kita perlukan:
     *
     * - destination
     * - warehouse
     * - seluruh donor STORE
     */

    const inventoryShopIds = [
        destination._id,
        ...donorStoreIds,
        new mongoose.Types.ObjectId(
            WAREHOUSE_SHOP_ID
        )
    ]

    const inventoryRows =
        await Inventory
            .find({
                shopId: {
                    $in:
                        inventoryShopIds
                },

                productId: {
                    $in:
                        productIds
                }
            })
            .select(
                'shopId productId qty'
            )
            .lean()

    const inventoryMap =
        new Map()

    for (const row of inventoryRows) {
        const key =
            `${String(row.shopId)}|${String(row.productId)}`

        inventoryMap.set(
            key,
            Number(
                row.qty || 0
            )
        )
    }

    /*
     * --------------------------------------------------
     * DONOR INTELLIGENCE
     * --------------------------------------------------
     *
     * Hanya mengambil SKU yang dibutuhkan destination.
     * Ini jauh lebih ringan dibanding membaca seluruh
     * inventory intelligence perusahaan.
     */

    const donorIntelRows =
        donorStoreIds.length
            ? await InventoryIntelDaily
                .find({
                    date:
                        dateStr,

                    shopType:
                        'STORE',

                    shopId: {
                        $in:
                            donorStoreIds
                    },

                    productId: {
                        $in:
                            productIds
                    }
                })
                .select(
                    'shopId productId ads daysOfCover status'
                )
                .lean()
            : []

    const donorIntelMap =
        new Map()

    for (const row of donorIntelRows) {
        const key =
            `${String(row.shopId)}|${String(row.productId)}`

        donorIntelMap.set(
            key,
            row
        )
    }

    /*
     * --------------------------------------------------
     * WAREHOUSE POOL
     * --------------------------------------------------
     */

    const warehousePool =
        new Map()

    for (const productId of productIds) {
        const key =
            `${WAREHOUSE_SHOP_ID}|${productId}`

        warehousePool.set(
            productId,
            Math.max(
                0,
                Number(
                    inventoryMap.get(
                        key
                    ) || 0
                )
            )
        )
    }

    /*
     * --------------------------------------------------
     * DONOR POOL
     * --------------------------------------------------
     */

    const donorPool =
        new Map()

    for (const store of stores) {
        for (const productId of productIds) {
            const key =
                `${String(store._id)}|${productId}`

            const stock =
                Math.max(
                    0,
                    Number(
                        inventoryMap.get(
                            key
                        ) || 0
                    )
                )

            if (stock <= 0) {
                continue
            }

            const intel =
                donorIntelMap.get(
                    key
                )

            /*
             * Tanpa intelligence donor,
             * stok tidak boleh dianggap surplus.
             */
            if (!intel) {
                continue
            }

            const ads =
                Number(
                    intel.ads || 0
                )

            const safeStock =
                calcTargetStock(
                    ads
                )

            const surplus =
                Math.max(
                    0,
                    stock -
                    safeStock
                )

            if (surplus <= 0) {
                continue
            }

            donorPool.set(
                key,
                {
                    shopId:
                        store._id,

                    shopName:
                        store.name,

                    productId,

                    stock,

                    ads,

                    daysOfCover:
                        Number(
                            intel.daysOfCover ||
                            0
                        ),

                    status:
                        intel.status,

                    safeStock,

                    initialSurplus:
                        surplus,

                    remainingSurplus:
                        surplus
                }
            )
        }
    }

    /*
     * --------------------------------------------------
     * OUTPUT
     * --------------------------------------------------
     */

    const sourceMap =
        new Map()

    const production = []
    const order = []
    const items = []

    let totalNeedQty = 0
    let warehouseAllocatedQty = 0
    let storeAllocatedQty = 0
    let productionQty = 0
    let orderQty = 0

    /*
     * --------------------------------------------------
     * ALLOCATION
     * --------------------------------------------------
     */

    for (const intel of intelRows) {
        const product =
            productMap.get(
                String(intel.productId)
            )

        if (
            !product ||
            product.isActive === false
        ) {
            continue
        }

        const productKey =
            String(
                product._id
            )

        const destinationInventoryKey =
            `${String(destination._id)}|${productKey}`

        const currentStock =
            Math.max(
                0,
                Number(
                    inventoryMap.get(
                        destinationInventoryKey
                    ) || 0
                )
            )

        /*
         * Need dihitung ulang terhadap
         * Inventory aktual.
         */
        const targetStock =
            calcTargetStock(
                intel.ads
            )

        const need =
            Math.max(
                0,
                targetStock -
                currentStock
            )

        if (need <= 0) {
            continue
        }

        totalNeedQty +=
            need

        let remaining =
            need

        const allocations = []

        /*
         * ==================================================
         * 1. WAREHOUSE
         * ==================================================
         */

        const warehouseAvailable =
            Number(
                warehousePool.get(
                    productKey
                ) || 0
            )

        const warehouseAllocate =
            Math.min(
                remaining,
                warehouseAvailable
            )

        if (warehouseAllocate > 0) {
            warehousePool.set(
                productKey,
                warehouseAvailable -
                warehouseAllocate
            )

            remaining -=
                warehouseAllocate

            warehouseAllocatedQty +=
                warehouseAllocate

            const sourceId =
                String(
                    warehouseShop?._id ||
                    WAREHOUSE_SHOP_ID
                )

            const allocation = {
                sourceType:
                    'WAREHOUSE',

                sourceShopId:
                    warehouseShop?._id ||
                    WAREHOUSE_SHOP_ID,

                sourceShopName:
                    warehouseShop?.name ||
                    'Gudang',

                destinationShopId:
                    destination._id,

                destinationShopName:
                    destination.name,

                productId:
                    product._id,

                sku:
                    product.sku,

                productName:
                    product.name,

                qty:
                    warehouseAllocate
            }

            allocations.push(
                allocation
            )

            if (
                !sourceMap.has(
                    sourceId
                )
            ) {
                sourceMap.set(
                    sourceId,
                    {
                        sourceType:
                            'WAREHOUSE',

                        sourceShopId:
                            warehouseShop?._id ||
                            WAREHOUSE_SHOP_ID,

                        sourceShopName:
                            warehouseShop?.name ||
                            'Gudang',

                        destinationShopId:
                            destination._id,

                        destinationShopName:
                            destination.name,

                        totalSku:
                            0,

                        totalQty:
                            0,

                        items:
                            []
                    }
                )
            }

            const source =
                sourceMap.get(
                    sourceId
                )

            source.totalSku++
            source.totalQty +=
                warehouseAllocate

            source.items.push(
                allocation
            )
        }

        /*
         * ==================================================
         * 2. STORE DONOR
         * ==================================================
         */

        if (remaining > 0) {
            const candidates = []

            for (
                const donor of
                donorPool.values()
            ) {
                if (
                    String(
                        donor.productId
                    ) !== productKey
                ) {
                    continue
                }

                if (
                    donor.remainingSurplus <=
                    0
                ) {
                    continue
                }

                candidates.push(
                    donor
                )
            }

            /*
             * Prioritas donor:
             *
             * 1. surplus terbesar
             * 2. ADS rendah
             * 3. DOC tinggi
             */
            candidates.sort(
                (a, b) => {
                    if (
                        b.remainingSurplus !==
                        a.remainingSurplus
                    ) {
                        return (
                            b.remainingSurplus -
                            a.remainingSurplus
                        )
                    }

                    if (
                        a.ads !==
                        b.ads
                    ) {
                        return (
                            a.ads -
                            b.ads
                        )
                    }

                    return (
                        b.daysOfCover -
                        a.daysOfCover
                    )
                }
            )

            for (const donor of candidates) {
                if (remaining <= 0) {
                    break
                }

                const allocate =
                    Math.min(
                        remaining,
                        donor.remainingSurplus
                    )

                if (allocate <= 0) {
                    continue
                }

                donor.remainingSurplus -=
                    allocate

                remaining -=
                    allocate

                storeAllocatedQty +=
                    allocate

                const allocation = {
                    sourceType:
                        'STORE',

                    sourceShopId:
                        donor.shopId,

                    sourceShopName:
                        donor.shopName,

                    destinationShopId:
                        destination._id,

                    destinationShopName:
                        destination.name,

                    productId:
                        product._id,

                    sku:
                        product.sku,

                    productName:
                        product.name,

                    qty:
                        allocate,

                    sourceStock:
                        donor.stock,

                    sourceAds:
                        donor.ads,

                    sourceSafeStock:
                        donor.safeStock,

                    sourceInitialSurplus:
                        donor.initialSurplus
                }

                allocations.push(
                    allocation
                )

                const sourceId =
                    String(
                        donor.shopId
                    )

                if (
                    !sourceMap.has(
                        sourceId
                    )
                ) {
                    sourceMap.set(
                        sourceId,
                        {
                            sourceType:
                                'STORE',

                            sourceShopId:
                                donor.shopId,

                            sourceShopName:
                                donor.shopName,

                            destinationShopId:
                                destination._id,

                            destinationShopName:
                                destination.name,

                            totalSku:
                                0,

                            totalQty:
                                0,

                            items:
                                []
                        }
                    )
                }

                const source =
                    sourceMap.get(
                        sourceId
                    )

                source.totalSku++
                source.totalQty +=
                    allocate

                source.items.push(
                    allocation
                )
            }
        }

        /*
         * ==================================================
         * 3. FALLBACK
         * ==================================================
         */

        let fallbackAction = null

        if (remaining > 0) {
            fallbackAction =
                getFallbackAction(
                    product.flow
                )

            const fallbackItem = {
                destinationShopId:
                    destination._id,

                destinationShopName:
                    destination.name,

                productId:
                    product._id,

                sku:
                    product.sku,

                productName:
                    product.name,

                qty:
                    remaining,

                action:
                    fallbackAction
            }

            if (
                fallbackAction ===
                'PRODUKSI'
            ) {
                production.push(
                    fallbackItem
                )

                productionQty +=
                    remaining

            } else {
                order.push(
                    fallbackItem
                )

                orderQty +=
                    remaining
            }
        }

        items.push({
            inventoryIntelId:
                intel._id,

            productId:
                product._id,

            sku:
                product.sku,

            productName:
                product.name,

            status:
                intel.status,

            priorityScore:
                Number(
                    intel.priorityScore ||
                    0
                ),

            ads:
                Number(
                    intel.ads || 0
                ),

            daysOfCover:
                Number(
                    intel.daysOfCover ||
                    0
                ),

            currentStock,

            targetStock,

            need,

            internalAllocated:
                need -
                remaining,

            remaining,

            fallbackAction,

            allocations
        })
    }

    /*
     * --------------------------------------------------
     * SOURCE DOCUMENTS
     * --------------------------------------------------
     *
     * Setiap element sources nantinya bisa menjadi
     * satu dokumen print-out.
     *
     * Gudang -> ZHR
     * ZAHIR  -> ZHR
     * MARSYA -> ZHR
     */

    const sources =
        Array.from(
            sourceMap.values()
        )
        .sort(
            (a, b) => {
                if (
                    a.sourceType !==
                    b.sourceType
                ) {
                    return (
                        a.sourceType ===
                        'WAREHOUSE'
                            ? -1
                            : 1
                    )
                }

                return (
                    b.totalQty -
                    a.totalQty
                )
            }
        )

    const internalAllocatedQty =
        warehouseAllocatedQty +
        storeAllocatedQty

    const remainingQty =
        productionQty +
        orderQty

    const fulfillmentRate =
        totalNeedQty
            ? Math.round(
                internalAllocatedQty /
                totalNeedQty *
                100
            )
            : 100

    return {
        date:
            dateStr,

        destination,

        summary: {
            totalSku:
                items.length,

            totalNeedQty,

            warehouseAllocatedQty,

            storeAllocatedQty,

            internalAllocatedQty,

            productionQty,

            orderQty,

            remainingQty,

            fulfillmentRate:
                Math.min(
                    100,
                    fulfillmentRate
                )
        },

        sources,

        production,

        order,

        items
    }
}


module.exports = {
    buildSupplyPlan
}