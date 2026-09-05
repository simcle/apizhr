const Shop = require('../../models/shops')

/**
 * GET ALL STORES
 *
 * Khusus Supervisor/Admin.
 * Hanya mengembalikan lokasi dengan type === STORE.
 *
 * Dipakai untuk:
 * - filter Stock Opname
 * - create Stock Opname
 * - filter modul operasional toko lainnya
 */
exports.getStores = async (req, res) => {
    try {
        const data = await Shop
            .find({
                type: 'STORE'
            })
            .select(
                '_id name address mobile type'
            )
            .sort({
                name: 1
            })
            .lean()

        return res.status(200).json({
            status: true,
            total: data.length,
            data
        })

    } catch (err) {
        console.error(
            'Supervisor getStores:',
            err
        )

        return res.status(500).json({
            status: false,
            message: err.message
        })
    }
}