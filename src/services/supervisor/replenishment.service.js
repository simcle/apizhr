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


function calcSafeStock({
    ads
}) {
    return Math.ceil(
        Math.max(
            0,
            Number(ads || 0) *
            TARGET_COVER_DAYS
        )
    )
}


function calcSurplus({
    stock,
    ads
}) {
    const safeStock =
        calcSafeStock({
            ads
        })

    const surplus =
        Math.max(
            0,
            Number(stock || 0) -
            safeStock
        )

    return {
        safeStock,
        surplus
    }
}


async function getReplenishmentPlan(
    inventoryIntelId
) {
    if (
        !mongoose.Types.ObjectId.isValid(
            inventoryIntelId
        )
    ) {
        throw createError(
            'ID Inventory Intelligence tidak valid',
            400
        )
    }

    /*
     * Destination wajib STORE.
     */
    const intel =
        await InventoryIntelDaily
            .findOne({
                _id:
                    inventoryIntelId,

                shopType:
                    'STORE'
            })
            .lean()

    if (!intel) {
        throw createError(
            'Inventory Intelligence tidak ditemukan',
            404
        )
    }

    if (
        intel.status ===
        'AMAN'
    ) {
        throw createError(
            'Produk tidak membutuhkan replenishment',
            400
        )
    }

    const [
        destinationShop,
        product
    ] = await Promise.all([
        Shop
            .findOne({
                _id:
                    intel.shopId,

                type:
                    'STORE'
            })
            .select(
                '_id name type'
            )
            .lean(),

        Product
            .findById(
                intel.productId
            )
            .select(
                '_id name sku flow'
            )
            .lean()
    ])

    if (!destinationShop) {
        throw createError(
            'Toko tujuan tidak ditemukan',
            404
        )
    }

    if (!product) {
        throw createError(
            'Produk tidak ditemukan',
            404
        )
    }

    /*
     * Need menggunakan hasil intelligence.
     *
     * Tetapi stok aktual tetap menggunakan
     * Inventory sebagai source of truth.
     */
    let need =
        Math.max(
            0,
            Number(
                intel.recommendedQty || 0
            )
        )

    if (!need) {
        return {
            date:
                intel.date,

            destination: {
                shopId:
                    destinationShop._id,

                shopName:
                    destinationShop.name
            },

            product: {
                productId:
                    product._id,

                sku:
                    product.sku,

                name:
                    product.name
            },

            intelligence: {
                status:
                    intel.status,

                ads:
                    Number(
                        intel.ads || 0
                    ),

                daysOfCover:
                    Number(
                        intel.daysOfCover || 0
                    ),

                priorityScore:
                    Number(
                        intel.priorityScore || 0
                    )
            },

            need:
                0,

            warehouse: {
                shopId:
                    WAREHOUSE_SHOP_ID,

                available:
                    0,

                allocate:
                    0
            },

            donors: [],

            remaining:
                0,

            fallbackAction:
                null
        }
    }

    /*
     * --------------------------------------------------
     * INVENTORY AKTUAL DESTINATION
     * --------------------------------------------------
     */

    const destinationInventory =
        await Inventory
            .findOne({
                shopId:
                    destinationShop._id,

                productId:
                    product._id
            })
            .select(
                'qty'
            )
            .lean()

    const currentDestinationStock =
        Number(
            destinationInventory?.qty || 0
        )

    /*
     * Recalculate need berdasarkan stok aktual.
     *
     * Intelligence bisa snapshot beberapa jam lalu,
     * sementara Inventory adalah stock master aktual.
     */
    const targetStock =
        Math.ceil(
            Number(
                intel.ads || 0
            ) *
            TARGET_COVER_DAYS
        )

    need =
        Math.max(
            0,
            targetStock -
            currentDestinationStock
        )

    let remaining =
        need

    /*
     * --------------------------------------------------
     * WAREHOUSE
     * --------------------------------------------------
     */

    const warehouseInventory =
        await Inventory
            .findOne({
                shopId:
                    WAREHOUSE_SHOP_ID,

                productId:
                    product._id
            })
            .select(
                'qty'
            )
            .lean()

    const warehouseAvailable =
        Math.max(
            0,
            Number(
                warehouseInventory?.qty || 0
            )
        )

    const warehouseAllocate =
        Math.min(
            remaining,
            warehouseAvailable
        )

    remaining -=
        warehouseAllocate

    /*
     * --------------------------------------------------
     * STORE DONORS
     * --------------------------------------------------
     */

    const donors = []

    if (remaining > 0) {
        const stores =
            await Shop
                .find({
                    type:
                        'STORE',

                    _id: {
                        $ne:
                            destinationShop._id
                    }
                })
                .select(
                    '_id name'
                )
                .lean()

        const storeIds =
            stores.map(
                store => store._id
            )

        /*
         * Ambil inventory aktual donor.
         */
        const donorInventoryRows =
            await Inventory
                .find({
                    shopId: {
                        $in:
                            storeIds
                    },

                    productId:
                        product._id,

                    qty: {
                        $gt: 0
                    }
                })
                .select(
                    'shopId qty'
                )
                .lean()

        const donorInventoryMap =
            new Map(
                donorInventoryRows.map(
                    item => [
                        String(
                            item.shopId
                        ),

                        Number(
                            item.qty || 0
                        )
                    ]
                )
            )

        /*
         * Ambil intelligence donor pada
         * snapshot tanggal yang sama.
         */
        const donorIntelRows =
            await InventoryIntelDaily
                .find({
                    date:
                        intel.date,

                    shopType:
                        'STORE',

                    shopId: {
                        $in:
                            storeIds
                    },

                    productId:
                        product._id
                })
                .select(
                    'shopId ads daysOfCover status'
                )
                .lean()

        const donorIntelMap =
            new Map(
                donorIntelRows.map(
                    item => [
                        String(
                            item.shopId
                        ),

                        item
                    ]
                )
            )

        const candidates = []

        for (const store of stores) {
            const stock =
                donorInventoryMap.get(
                    String(store._id)
                ) || 0

            if (stock <= 0) {
                continue
            }

            const donorIntel =
                donorIntelMap.get(
                    String(store._id)
                ) || null

            /*
             * Kalau intelligence donor belum tersedia,
             * jangan ambil stoknya.
             *
             * Kita harus tahu demand donor dulu
             * sebelum menyatakan surplus.
             */
            if (!donorIntel) {
                continue
            }

            const ads =
                Number(
                    donorIntel.ads || 0
                )

            const {
                safeStock,
                surplus
            } = calcSurplus({
                stock,
                ads
            })

            if (surplus <= 0) {
                continue
            }

            candidates.push({
                shopId:
                    store._id,

                shopName:
                    store.name,

                stock,

                ads,

                daysOfCover:
                    Number(
                        donorIntel.daysOfCover || 0
                    ),

                status:
                    donorIntel.status,

                safeStock,

                surplus
            })
        }

        /*
         * Prioritas donor:
         *
         * 1. surplus terbesar
         * 2. ADS paling rendah
         * 3. DOC paling tinggi
         */
        candidates.sort(
            (a, b) => {
                if (
                    b.surplus !==
                    a.surplus
                ) {
                    return (
                        b.surplus -
                        a.surplus
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

        for (const candidate of candidates) {
            if (remaining <= 0) {
                break
            }

            const allocate =
                Math.min(
                    remaining,
                    candidate.surplus
                )

            if (allocate <= 0) {
                continue
            }

            donors.push({
                ...candidate,
                allocate
            })

            remaining -=
                allocate
        }
    }

    /*
     * --------------------------------------------------
     * FALLBACK
     * --------------------------------------------------
     */

    let fallbackAction = null

    if (remaining > 0) {
        fallbackAction =
            product.flow &&
            String(
                product.flow
            ).toUpperCase() ===
            'PRODUCTION'
                ? 'PRODUKSI'
                : 'ORDER'
    }

    const internalAllocated =
        warehouseAllocate +
        donors.reduce(
            (total, item) => {
                return (
                    total +
                    Number(
                        item.allocate || 0
                    )
                )
            },
            0
        )

    const fulfillmentRate =
        need
            ? Math.round(
                internalAllocated /
                need *
                100
            )
            : 100

    return {
        date:
            intel.date,

        destination: {
            shopId:
                destinationShop._id,

            shopName:
                destinationShop.name
        },

        product: {
            productId:
                product._id,

            sku:
                product.sku,

            name:
                product.name,

            flow:
                product.flow || null
        },

        intelligence: {
            status:
                intel.status,

            ads:
                Number(
                    intel.ads || 0
                ),

            daysOfCover:
                Number(
                    intel.daysOfCover || 0
                ),

            rop:
                Number(
                    intel.rop || 0
                ),

            priorityScore:
                Number(
                    intel.priorityScore || 0
                ),

            snapshotStock:
                Number(
                    intel.stockOnHand || 0
                ),

            recommendedQty:
                Number(
                    intel.recommendedQty || 0
                )
        },

        current: {
            stockOnHand:
                currentDestinationStock,

            targetStock,

            need
        },

        warehouse: {
            shopId:
                WAREHOUSE_SHOP_ID,

            available:
                warehouseAvailable,

            allocate:
                warehouseAllocate
        },

        donors,

        summary: {
            need,

            warehouseAllocated:
                warehouseAllocate,

            storeAllocated:
                donors.reduce(
                    (total, item) => {
                        return (
                            total +
                            Number(
                                item.allocate || 0
                            )
                        )
                    },
                    0
                ),

            internalAllocated,

            remaining,

            fulfillmentRate:
                Math.min(
                    100,
                    fulfillmentRate
                ),

            fallbackAction
        }
    }
}


module.exports = {
    getReplenishmentPlan
}