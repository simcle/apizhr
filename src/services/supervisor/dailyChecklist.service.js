const mongoose = require('mongoose')

const Shop = require('../../models/shops')
const ChecklistTemplateItem = require('../../models/checklistTemplateItem')
const DailyChecklist = require('../../models/dailyChecklist')
const DailyChecklistItem = require('../../models/dailyChecklistItem')

const { s } = require('./checklistIssue.service')

function createError(message, statusCode = 400) {
    const error = new Error(message)
    error.statusCode = statusCode

    return error
}

function getDateString(value = null) {
    if (value) {
        const date = String(value)

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const error = new Error('Format tanggal tidak valid')
            error.statusCode = 400
            throw error
        }

        return date
    }

    const now = new Date()

    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(now)
}

function getTodayString() {
    return getDateString()
}

function resolveVisitStatus(visit, date) {
    if (visit?.status === 'COMPLETED') {
        return 'COMPLETED'
    }

    if (visit) {
        return 'IN_PROGRESS'
    }

    if (date < getTodayString()) {
        return 'MISSED'
    }

    return 'NOT_VISITED'
}


function getDateWIB(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date)
}


function validateDate(date) {
    const value = String(date || '').trim()

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw createError(
            'Format tanggal tidak valid',
            400
        )
    }

    return value
}


async function getStore(shopId) {
    if (!mongoose.Types.ObjectId.isValid(shopId)) {
        throw createError(
            'ID toko tidak valid',
            400
        )
    }

    const shop = await Shop
        .findOne({
            _id: shopId,
            type: 'STORE'
        })
        .select('_id name type')
        .lean()

    if (!shop) {
        throw createError(
            'Toko tidak ditemukan',
            404
        )
    }

    return shop
}


async function createChecklistItems(
    checklistId,
    templateItems
) {
    if (!templateItems.length) {
        return []
    }

    const rows = templateItems.map(item => ({
        dailyChecklistId:
            checklistId,

        templateItemId:
            item._id,

        category:
            item.category,

        label:
            item.label,

        description:
            item.description || '',

        sortOrder:
            Number(item.sortOrder || 0),

        issueNoteRequired:
            item.issueNoteRequired !== false,

        result:
            'PENDING',

        notes:
            '',

        checkedAt:
            null
    }))

    try {
        return await DailyChecklistItem.insertMany(
            rows,
            {
                ordered: false
            }
        )
    } catch (error) {
        /*
         * Jika terjadi race condition dari request bersamaan,
         * unique index dailyChecklistId + templateItemId
         * tetap melindungi duplicate.
         */
        if (error.code !== 11000) {
            throw error
        }

        return []
    }
}


async function ensureChecklistItems(
    checklist,
    templateItems
) {
    const existingItems =
        await DailyChecklistItem
            .find({
                dailyChecklistId:
                    checklist._id
            })
            .select(
                'templateItemId'
            )
            .lean()

    const existingIds = new Set(
        existingItems.map(item => {
            return String(
                item.templateItemId
            )
        })
    )

    const missingItems =
        templateItems.filter(item => {
            return !existingIds.has(
                String(item._id)
            )
        })

    if (!missingItems.length) {
        return
    }

    /*
     * Template baru hanya ditambahkan jika checklist
     * belum selesai.
     *
     * Checklist COMPLETED adalah historical snapshot
     * dan tidak boleh ikut berubah ketika master berubah.
     */
    if (
        checklist.status === 'COMPLETED'
    ) {
        return
    }

    await createChecklistItems(
        checklist._id,
        missingItems
    )

    const totalItems =
        await DailyChecklistItem
            .countDocuments({
                dailyChecklistId:
                    checklist._id
            })

    await DailyChecklist.updateOne(
        {
            _id:
                checklist._id
        },
        {
            $set: {
                totalItems
            }
        }
    )
}


async function ensureDailyChecklists(
    date = getDateWIB()
) {
    const dateStr =
        validateDate(date)

    const [
        shops,
        templateItems
    ] = await Promise.all([
        Shop
            .find({
                type: 'STORE'
            })
            .select(
                '_id name type'
            )
            .sort({
                name: 1
            })
            .lean(),

        ChecklistTemplateItem
            .find({
                isActive: true
            })
            .sort({
                category: 1,
                sortOrder: 1,
                createdAt: 1
            })
            .lean()
    ])

    if (!templateItems.length) {
        throw createError(
            'Master checklist belum tersedia',
            400
        )
    }

    for (const shop of shops) {
        let checklist =
            await DailyChecklist
                .findOne({
                    date:
                        dateStr,

                    shopId:
                        shop._id
                })

        if (!checklist) {
            try {
                checklist =
                    await DailyChecklist.create({
                        date:
                            dateStr,

                        shopId:
                            shop._id,

                        shopName:
                            shop.name,

                        status:
                            'PENDING',

                        supervisorId:
                            null,

                        totalItems:
                            templateItems.length,

                        totalOk:
                            0,

                        totalIssue:
                            0,

                        totalNA:
                            0
                    })

            } catch (error) {
                if (error.code !== 11000) {
                    throw error
                }

                checklist =
                    await DailyChecklist
                        .findOne({
                            date:
                                dateStr,

                            shopId:
                                shop._id
                        })
            }
        }

        await ensureChecklistItems(
            checklist,
            templateItems
        )
    }

    return {
        date:
            dateStr,

        totalStores:
            shops.length,

        totalTemplateItems:
            templateItems.length
    }
}


async function getDailyOverview({
    date = null
} = {}) {
    const dateStr =
        date
            ? validateDate(date)
            : getDateWIB()

    await ensureDailyChecklists(
        dateStr
    )

    const rows = await DailyChecklist
        .find({
            date:
                dateStr
        })
        .sort({
            shopName: 1
        })
        .populate(
            'supervisorId',
            'name role'
        )
        .lean()

    const totalStores =
        rows.length

    const completed =
        rows.filter(item => {
            return (
                item.status ===
                'COMPLETED'
            )
        }).length

    const inProgress =
        rows.filter(item => {
            return (
                item.status ===
                'IN_PROGRESS'
            )
        }).length

    const pending =
        rows.filter(item => {
            return (
                item.status ===
                'PENDING'
            )
        }).length

    const totalIssues =
        rows.reduce(
            (total, item) => {
                return (
                    total +
                    Number(
                        item.totalIssue ||
                        0
                    )
                )
            },
            0
        )

    const completionRate =
        totalStores
            ? Math.round(
                completed /
                totalStores *
                100
            )
            : 0

    return {
        date:
            dateStr,

        summary: {
            totalStores,
            pending,
            inProgress,
            completed,
            totalIssues,
            completionRate
        },

        shops:
            rows.map(item => ({
                _id:
                    item._id,

                date:
                    item.date,

                shopId:
                    item.shopId,

                shopName:
                    item.shopName,

                status:
                    item.status,

                totalItems:
                    Number(
                        item.totalItems || 0
                    ),

                totalOk:
                    Number(
                        item.totalOk || 0
                    ),

                totalIssue:
                    Number(
                        item.totalIssue || 0
                    ),

                totalNA:
                    Number(
                        item.totalNA || 0
                    ),

                supervisor:
                    item.supervisorId || null,

                startedAt:
                    item.startedAt,

                completedAt:
                    item.completedAt
            }))
    }
}


async function getChecklistDetail(
    checklistId
) {
    if (
        !mongoose.Types.ObjectId.isValid(
            checklistId
        )
    ) {
        throw createError(
            'ID checklist tidak valid',
            400
        )
    }

    const checklist =
        await DailyChecklist
            .findById(
                checklistId
            )
            .populate(
                'supervisorId',
                'name role'
            )
            .lean()

    if (!checklist) {
        throw createError(
            'Checklist tidak ditemukan',
            404
        )
    }

    const items =
        await DailyChecklistItem
            .find({
                dailyChecklistId:
                    checklist._id
            })
            .sort({
                category: 1,
                sortOrder: 1,
                createdAt: 1
            })
            .lean()

    const categoryMap =
        new Map()

    for (const item of items) {
        if (
            !categoryMap.has(
                item.category
            )
        ) {
            categoryMap.set(
                item.category,
                []
            )
        }

        categoryMap
            .get(item.category)
            .push(item)
    }

    const categories =
        Array.from(
            categoryMap.entries()
        ).map(
            ([category, categoryItems]) => ({
                category,
                items:
                    categoryItems
            })
        )

    const answered =
        items.filter(item => {
            return (
                item.result !==
                'PENDING'
            )
        }).length

    return {
        checklist: {
            _id:
                checklist._id,

            date:
                checklist.date,

            shopId:
                checklist.shopId,

            shopName:
                checklist.shopName,

            status:
                checklist.status,

            supervisor:
                checklist.supervisorId || null,

            startedAt:
                checklist.startedAt,

            completedAt:
                checklist.completedAt,

            totalItems:
                Number(
                    checklist.totalItems || 0
                ),

            totalOk:
                Number(
                    checklist.totalOk || 0
                ),

            totalIssue:
                Number(
                    checklist.totalIssue || 0
                ),

            totalNA:
                Number(
                    checklist.totalNA || 0
                ),

            notes:
                checklist.notes || '',

            answered,

            progress:
                items.length
                    ? Math.round(
                        answered /
                        items.length *
                        100
                    )
                    : 0
        },

        categories
    }
}


async function startChecklist({
    checklistId,
    userId
}) {
    if (!userId) {
        throw createError(
            'User tidak valid',
            401
        )
    }

    if (
        !mongoose.Types.ObjectId.isValid(
            checklistId
        )
    ) {
        throw createError(
            'ID checklist tidak valid',
            400
        )
    }

    const checklist =
        await DailyChecklist
            .findById(
                checklistId
            )

    if (!checklist) {
        throw createError(
            'Checklist tidak ditemukan',
            404
        )
    }

    if (
        checklist.status ===
        'COMPLETED'
    ) {
        throw createError(
            'Checklist sudah selesai',
            400
        )
    }

    if (
        checklist.status ===
        'PENDING'
    ) {
        checklist.status =
            'IN_PROGRESS'

        checklist.supervisorId =
            userId

        checklist.startedAt =
            new Date()

        await checklist.save()
    }

    return getChecklistDetail(
        checklist._id
    )
}


async function updateChecklistItem({
    checklistId,
    itemId,
    result,
    notes,
    userId
}) {
    if (!userId) {
        throw createError(
            'User tidak valid',
            401
        )
    }

    if (
        !mongoose.Types.ObjectId.isValid(
            checklistId
        ) ||
        !mongoose.Types.ObjectId.isValid(
            itemId
        )
    ) {
        throw createError(
            'ID checklist tidak valid',
            400
        )
    }

    const allowedResults = [
        'OK',
        'ISSUE',
        'NA'
    ]

    if (
        !allowedResults.includes(
            result
        )
    ) {
        throw createError(
            'Hasil checklist tidak valid',
            400
        )
    }

    const checklist =
        await DailyChecklist
            .findById(
                checklistId
            )

    if (!checklist) {
        throw createError(
            'Checklist tidak ditemukan',
            404
        )
    }

    if (
        checklist.status ===
        'COMPLETED'
    ) {
        throw createError(
            'Checklist yang sudah selesai tidak dapat diubah',
            400
        )
    }

    const item =
        await DailyChecklistItem
            .findOne({
                _id:
                    itemId,

                dailyChecklistId:
                    checklist._id
            })

    if (!item) {
        throw createError(
            'Item checklist tidak ditemukan',
            404
        )
    }

    const cleanNotes =
        String(
            notes || ''
        ).trim()

    if (
        result === 'ISSUE' &&
        item.issueNoteRequired &&
        !cleanNotes
    ) {
        throw createError(
            'Catatan wajib diisi untuk item bermasalah',
            400
        )
    }

    item.result =
        result

    item.notes =
        cleanNotes

    item.checkedAt =
        new Date()

    await item.save()

    /*
     * Jika ini item pertama yang diisi,
     * otomatis mulai checklist.
     */
    if (
        checklist.status ===
        'PENDING'
    ) {
        checklist.status =
            'IN_PROGRESS'

        checklist.supervisorId =
            userId

        checklist.startedAt =
            new Date()

        await checklist.save()
    }

    return item.toObject()
}


async function completeChecklist({
    checklistId,
    notes,
    userId
}) {
    if (!userId) {
        throw createError(
            'User tidak valid',
            401
        )
    }

    if (
        !mongoose.Types.ObjectId.isValid(
            checklistId
        )
    ) {
        throw createError(
            'ID checklist tidak valid',
            400
        )
    }

    const checklist =
        await DailyChecklist
            .findById(
                checklistId
            )

    if (!checklist) {
        throw createError(
            'Checklist tidak ditemukan',
            404
        )
    }

    if (
        checklist.status ===
        'COMPLETED'
    ) {
        throw createError(
            'Checklist sudah selesai',
            400
        )
    }

    const items =
        await DailyChecklistItem
            .find({
                dailyChecklistId:
                    checklist._id
            })
            .lean()

    if (!items.length) {
        throw createError(
            'Checklist tidak memiliki item',
            400
        )
    }

    const pendingItems =
        items.filter(item => {
            return (
                item.result ===
                'PENDING'
            )
        })

    if (pendingItems.length) {
        throw createError(
            `Masih ada ${pendingItems.length} item checklist yang belum diperiksa`,
            400
        )
    }

    const invalidIssues =
        items.filter(item => {
            return (
                item.result === 'ISSUE' &&
                item.issueNoteRequired &&
                !String(
                    item.notes || ''
                ).trim()
            )
        })

    if (invalidIssues.length) {
        throw createError(
            'Terdapat item bermasalah yang belum memiliki catatan',
            400
        )
    }

    const totalOk =
        items.filter(item => {
            return (
                item.result ===
                'OK'
            )
        }).length

    const totalIssue =
        items.filter(item => {
            return (
                item.result ===
                'ISSUE'
            )
        }).length

    const totalNA =
        items.filter(item => {
            return (
                item.result ===
                'NA'
            )
        }).length

    
    const issueItems =
        items.filter(item => {
            return (
                item.result ===
                'ISSUE'
            )
        })

    for (const item of issueItems) {
        await registerChecklistIssue({
            checklist,
            item,
            userId
        })
    }
    
    checklist.status =
        'COMPLETED'

    checklist.supervisorId =
        checklist.supervisorId ||
        userId

    checklist.startedAt =
        checklist.startedAt ||
        new Date()

    checklist.completedAt =
        new Date()

    checklist.totalItems =
        items.length

    checklist.totalOk =
        totalOk

    checklist.totalIssue =
        totalIssue

    checklist.totalNA =
        totalNA

    checklist.notes =
        String(
            notes || ''
        ).trim()

    await checklist.save()

    return getChecklistDetail(
        checklist._id
    )
}


async function getChecklistByShopAndDate({
    shopId,
    date = null
}) {
    const dateStr =
        date
            ? validateDate(date)
            : getDateWIB()

    await getStore(
        shopId
    )

    await ensureDailyChecklists(
        dateStr
    )

    const checklist =
        await DailyChecklist
            .findOne({
                date:
                    dateStr,

                shopId:
                    shopId
            })
            .lean()

    if (!checklist) {
        throw createError(
            'Checklist toko tidak ditemukan',
            404
        )
    }

    return getChecklistDetail(
        checklist._id
    )
}


module.exports = {
    getDateWIB,
    ensureDailyChecklists,
    getDailyOverview,
    getChecklistDetail,
    getChecklistByShopAndDate,
    startChecklist,
    updateChecklistItem,
    completeChecklist
}