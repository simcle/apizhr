const mongoose = require('mongoose')

const Shop = require('../../models/shops')
const Product = require('../../models/products')
const User = require('../../models/users')
const DeadStockDaily = require('../../models/deadStockDaily')
const DeadStockAction = require('../../models/DeadStockAction')

function createError(message, statusCode = 400) {
    const error = new Error(message)
    error.statusCode = statusCode

    return error
}

async function findDeadStock(deadStockId) {
    if (!mongoose.Types.ObjectId.isValid(deadStockId)) {
        throw createError('ID Dead Stock tidak valid', 400)
    }

    const deadStock = await DeadStockDaily
        .findOne({
            _id: deadStockId,
            shopType: 'STORE'
        })
        .lean()

    if (!deadStock) {
        throw createError('Dead Stock tidak ditemukan', 404)
    }

    return deadStock
}

function validateActionType(actionType) {
    const allowedActions = [
        'PROMO',
        'DISCOUNT',
        'CLEARANCE'
    ]

    if (!actionType || !allowedActions.includes(actionType)) {
        throw createError('Tindakan Dead Stock tidak valid', 400)
    }
}

async function createAction({
    deadStockId,
    actionType,
    notes,
    userId
}) {
    if (!userId) {
        throw createError('User tidak valid', 401)
    }

    validateActionType(actionType)

    const deadStock = await findDeadStock(deadStockId)

    const existingAction = await DeadStockAction
        .findOne({
            deadStockId: deadStock._id,
            status: 'DONE'
        })
        .lean()

    if (existingAction) {
        throw createError(
            'Dead Stock ini sudah memiliki tindakan aktif',
            409
        )
    }

    const action = await DeadStockAction.create({
        deadStockDate: deadStock.date,
        deadStockId: deadStock._id,
        shopId: deadStock.shopId,
        productId: deadStock.productId,
        deadLevel: deadStock.deadLevel,
        actionType,
        status: 'DONE',
        notes: String(notes || '').trim(),
        userId,
        completedAt: new Date()
    })

    return DeadStockAction
        .findById(action._id)
        .populate('shopId', 'name type')
        .populate('productId', 'name sku')
        .populate('userId', 'name role')
        .lean()
}

async function getActions(deadStockId) {
    const deadStock = await findDeadStock(deadStockId)

    return DeadStockAction
        .find({
            deadStockId: deadStock._id
        })
        .sort({
            createdAt: -1
        })
        .populate('shopId', 'name type')
        .populate('productId', 'name sku')
        .populate('userId', 'name role')
        .lean()
}

async function cancelAction({
    actionId,
    notes,
    userId
}) {
    if (!userId) {
        throw createError('User tidak valid', 401)
    }

    if (!mongoose.Types.ObjectId.isValid(actionId)) {
        throw createError('ID Action tidak valid', 400)
    }

    const action = await DeadStockAction.findById(actionId)

    if (!action) {
        throw createError('Action Dead Stock tidak ditemukan', 404)
    }

    if (action.status === 'CANCELLED') {
        throw createError(
            'Action Dead Stock sudah dibatalkan',
            400
        )
    }

    action.status = 'CANCELLED'
    action.cancelledAt = new Date()

    const cancelNote = String(notes || '').trim()

    if (cancelNote) {
        action.notes = action.notes
            ? `${action.notes}\nPembatalan: ${cancelNote}`
            : `Pembatalan: ${cancelNote}`
    }

    await action.save()

    return DeadStockAction
        .findById(action._id)
        .populate('shopId', 'name type')
        .populate('productId', 'name sku')
        .populate('userId', 'name role')
        .lean()
}

async function getActionList(params = {}) {
    const {
        shopId,
        actionType,
        status,
        level,
        search
    } = params

    let page = Number(params.page) || 1
    let limit = Number(params.limit) || 25

    if (page < 1) page = 1
    if (limit < 1) limit = 25
    if (limit > 100) limit = 100

    const match = {}

    if (shopId) {
        if (!mongoose.Types.ObjectId.isValid(shopId)) {
            throw createError('ID toko tidak valid', 400)
        }

        const shop = await Shop
            .findOne({
                _id: shopId,
                type: 'STORE'
            })
            .select('_id')
            .lean()

        if (!shop) {
            throw createError('Toko tidak ditemukan', 404)
        }

        match.shopId = new mongoose.Types.ObjectId(shopId)
    }

    if (actionType) {
        validateActionType(actionType)
        match.actionType = actionType
    }

    if (status) {
        if (!['DONE', 'CANCELLED'].includes(status)) {
            throw createError(
                'Status tindakan tidak valid',
                400
            )
        }

        match.status = status
    }

    if (level) {
        if (!['WARNING', 'SERIOUS', 'CRITICAL'].includes(level)) {
            throw createError(
                'Level Dead Stock tidak valid',
                400
            )
        }

        match.deadLevel = level
    }

    const pipeline = [
        {
            $match: match
        },

        {
            $lookup: {
                from: Product.collection.name,
                localField: 'productId',
                foreignField: '_id',
                as: 'product'
            }
        },

        {
            $unwind: {
                path: '$product',
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: Shop.collection.name,
                localField: 'shopId',
                foreignField: '_id',
                as: 'shop'
            }
        },

        {
            $unwind: {
                path: '$shop',
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: User.collection.name,
                localField: 'userId',
                foreignField: '_id',
                as: 'user'
            }
        },

        {
            $unwind: {
                path: '$user',
                preserveNullAndEmptyArrays: true
            }
        }
    ]

    const keyword = String(search || '').trim()

    if (keyword) {
        const escaped = keyword.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
        )

        pipeline.push({
            $match: {
                $or: [
                    {
                        'product.name': {
                            $regex: escaped,
                            $options: 'i'
                        }
                    },
                    {
                        'product.sku': {
                            $regex: escaped,
                            $options: 'i'
                        }
                    },
                    {
                        'shop.name': {
                            $regex: escaped,
                            $options: 'i'
                        }
                    }
                ]
            }
        })
    }

    pipeline.push(
        {
            $sort: {
                createdAt: -1
            }
        },

        {
            $facet: {
                items: [
                    {
                        $skip: (page - 1) * limit
                    },

                    {
                        $limit: limit
                    },

                    {
                        $project: {
                            deadStockDate: 1,
                            deadStockId: 1,
                            deadLevel: 1,
                            actionType: 1,
                            status: 1,
                            notes: 1,
                            completedAt: 1,
                            cancelledAt: 1,
                            createdAt: 1,

                            product: {
                                _id: '$product._id',
                                name: '$product.name',
                                sku: '$product.sku'
                            },

                            shop: {
                                _id: '$shop._id',
                                name: '$shop.name'
                            },

                            user: {
                                _id: '$user._id',
                                name: '$user.name',
                                role: '$user.role'
                            }
                        }
                    }
                ],

                meta: [
                    {
                        $count: 'total'
                    }
                ]
            }
        }
    )

    const result = await DeadStockAction.aggregate(pipeline)

    const items = result[0]?.items || []
    const total = result[0]?.meta?.[0]?.total || 0

    return {
        items,

        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    }
}

module.exports = {
    createAction,
    getActions,
    cancelAction,
    getActionList
}