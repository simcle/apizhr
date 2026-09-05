const mongoose = require('mongoose')

const Shop = require('../../models/shops')
const DeadStockDaily = require('../../models/deadStockDaily')
const DeadStockAction = require('../../models/DeadStockAction')

function createError(message, statusCode = 400) {
    const error = new Error(message)
    error.statusCode = statusCode

    return error
}

function getRecommendedAction(deadStock) {
    if (
        deadStock.recommendedAction &&
        [
            'PROMO',
            'DISCOUNT',
            'CLEARANCE'
        ].includes(deadStock.recommendedAction)
    ) {
        return deadStock.recommendedAction
    }

    if (deadStock.deadLevel === 'CRITICAL') {
        return 'CLEARANCE'
    }

    if (deadStock.deadLevel === 'SERIOUS') {
        return 'DISCOUNT'
    }

    return 'PROMO'
}

async function getDeadStockReview(deadStockId) {
    if (!mongoose.Types.ObjectId.isValid(deadStockId)) {
        throw createError(
            'ID Dead Stock tidak valid',
            400
        )
    }

    const deadStock = await DeadStockDaily
        .findOne({
            _id: deadStockId,
            shopType: 'STORE'
        })
        .lean()

    if (!deadStock) {
        throw createError(
            'Dead Stock tidak ditemukan',
            404
        )
    }

    const shop = await Shop
        .findOne({
            _id: deadStock.shopId,
            type: 'STORE'
        })
        .select('_id name type')
        .lean()

    if (!shop) {
        throw createError(
            'Toko Dead Stock tidak valid',
            400
        )
    }

    const recommendedAction =
        getRecommendedAction(deadStock)

    const actions = await DeadStockAction
        .find({
            deadStockId: deadStock._id
        })
        .sort({
            createdAt: -1
        })
        .populate(
            'userId',
            'name role'
        )
        .lean()

    const activeAction = actions.find(action => {
        return action.status === 'DONE'
    }) || null

    return {
        deadStock: {
            _id:
                deadStock._id,

            date:
                deadStock.date,

            shopId:
                deadStock.shopId,

            shopName:
                deadStock.shopName,

            productId:
                deadStock.productId,

            parentId:
                deadStock.parentId,

            sku:
                deadStock.sku,

            name:
                deadStock.name,

            stockOnHand:
                Number(deadStock.stockOnHand || 0),

            ads:
                Number(deadStock.ads || 0),

            lastSoldDate:
                deadStock.lastSoldDate,

            daysNoSale:
                Number(deadStock.daysNoSale || 0),

            lifetimeQtySold:
                Number(deadStock.lifetimeQtySold || 0),

            unitCost:
                Number(deadStock.unitCost || 0),

            stockValue:
                Number(deadStock.stockValue || 0),

            deadLevel:
                deadStock.deadLevel,

            recommendedAction:
                deadStock.recommendedAction,

            message:
                deadStock.message
        },

        recommendation: {
            actionType:
                recommendedAction,

            reason:
                deadStock.message ||
                getRecommendationReason(
                    deadStock.deadLevel
                )
        },

        actionStatus: {
            hasAction:
                Boolean(activeAction),

            latestAction:
                activeAction
        },

        actions
    }
}

function getRecommendationReason(deadLevel) {
    if (deadLevel === 'CRITICAL') {
        return 'Produk berada pada kondisi Critical dan direkomendasikan untuk Clearance.'
    }

    if (deadLevel === 'SERIOUS') {
        return 'Produk berada pada kondisi Serious dan direkomendasikan untuk Discount.'
    }

    return 'Produk berada pada kondisi Warning dan direkomendasikan untuk Promo.'
}

module.exports = {
    getDeadStockReview
}