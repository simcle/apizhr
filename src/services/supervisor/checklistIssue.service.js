const mongoose = require('mongoose')

const Shop = require('../../models/shops')
const ChecklistIssue = require('../../models/checklistIssue')
const ChecklistIssueOccurrence = require('../../models/checklistIssueOccurrence')


function createError(message, statusCode = 400) {
    const error = new Error(message)
    error.statusCode = statusCode

    return error
}


function getDateWIB(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date)
}


async function registerChecklistIssue({
    checklist,
    item,
    userId
}) {
    if (!checklist || !item || !userId) {
        throw createError(
            'Data issue checklist tidak lengkap',
            400
        )
    }

    if (item.result !== 'ISSUE') {
        return null
    }

    const now = new Date()

    let issue = await ChecklistIssue.findOne({
        shopId:
            checklist.shopId,

        templateItemId:
            item.templateItemId,

        status:
            'OPEN'
    })

    if (!issue) {
        issue = await ChecklistIssue.create({
            shopId:
                checklist.shopId,

            templateItemId:
                item.templateItemId,

            category:
                item.category,

            label:
                item.label,

            description:
                item.description || '',

            status:
                'OPEN',

            firstReportedAt:
                now,

            lastReportedAt:
                now,

            occurrenceCount:
                1,

            latestIssueNote:
                String(
                    item.notes || ''
                ).trim(),

            reportedBy:
                userId
        })
    } else {
        issue.lastReportedAt =
            now

        issue.occurrenceCount =
            Number(
                issue.occurrenceCount || 0
            ) + 1

        issue.latestIssueNote =
            String(
                item.notes || ''
            ).trim()

        await issue.save()
    }

    try {
        await ChecklistIssueOccurrence.create({
            checklistIssueId:
                issue._id,

            dailyChecklistId:
                checklist._id,

            dailyChecklistItemId:
                item._id,

            shopId:
                checklist.shopId,

            templateItemId:
                item.templateItemId,

            date:
                checklist.date,

            category:
                item.category,

            label:
                item.label,

            issueNote:
                String(
                    item.notes || ''
                ).trim(),

            reportedBy:
                userId,

            reportedAt:
                now
        })
    } catch (error) {
        if (error.code !== 11000) {
            throw error
        }
    }

    return issue
}


async function getIssueList(params = {}) {
    const match = {}

    const status =
        String(
            params.status || ''
        ).trim()

    if (status) {
        if (
            ![
                'OPEN',
                'RESOLVED'
            ].includes(status)
        ) {
            throw createError(
                'Status issue tidak valid',
                400
            )
        }

        match.status =
            status
    }

    if (params.shopId) {
        if (
            !mongoose.Types.ObjectId.isValid(
                params.shopId
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
                        params.shopId,

                    type:
                        'STORE'
                })
                .select('_id')
                .lean()

        if (!shop) {
            throw createError(
                'Toko tidak ditemukan',
                404
            )
        }

        match.shopId =
            new mongoose.Types.ObjectId(
                params.shopId
            )
    }

    const category =
        String(
            params.category || ''
        ).trim()

    if (category) {
        match.category =
            category
    }

    let page =
        Number(
            params.page
        ) || 1

    let limit =
        Number(
            params.limit
        ) || 25

    if (page < 1) {
        page = 1
    }

    if (limit < 1) {
        limit = 25
    }

    if (limit > 100) {
        limit = 100
    }

    const search =
        String(
            params.search || ''
        ).trim()

    if (search) {
        const escaped =
            search.replace(
                /[.*+?^${}()|[\]\\]/g,
                '\\$&'
            )

        match.$or = [
            {
                label: {
                    $regex:
                        escaped,

                    $options:
                        'i'
                }
            },

            {
                latestIssueNote: {
                    $regex:
                        escaped,

                    $options:
                        'i'
                }
            },

            {
                category: {
                    $regex:
                        escaped,

                    $options:
                        'i'
                }
            }
        ]
    }

    const skip =
        (page - 1) *
        limit

    const [
        items,
        total
    ] = await Promise.all([
        ChecklistIssue
            .find(match)
            .sort({
                status: 1,
                lastReportedAt: -1
            })
            .skip(skip)
            .limit(limit)
            .populate(
                'shopId',
                'name type'
            )
            .populate(
                'reportedBy',
                'name role'
            )
            .populate(
                'resolvedBy',
                'name role'
            )
            .lean(),

        ChecklistIssue
            .countDocuments(
                match
            )
    ])

    const now =
        new Date()

    const rows =
        items.map(item => {
            const firstReportedAt =
                item.firstReportedAt
                    ? new Date(
                        item.firstReportedAt
                    )
                    : null

            const ageDays =
                firstReportedAt
                    ? Math.max(
                        Math.floor(
                            (
                                now -
                                firstReportedAt
                            ) /
                            86400000
                        ),
                        0
                    )
                    : 0

            return {
                ...item,
                ageDays
            }
        })

    return {
        items:
            rows,

        pagination: {
            page,
            limit,
            total,
            pages:
                Math.ceil(
                    total /
                    limit
                )
        }
    }
}


async function getIssueDetail(
    issueId
) {
    if (
        !mongoose.Types.ObjectId.isValid(
            issueId
        )
    ) {
        throw createError(
            'ID issue tidak valid',
            400
        )
    }

    const issue =
        await ChecklistIssue
            .findById(
                issueId
            )
            .populate(
                'shopId',
                'name type'
            )
            .populate(
                'reportedBy',
                'name role'
            )
            .populate(
                'resolvedBy',
                'name role'
            )
            .lean()

    if (!issue) {
        throw createError(
            'Issue tidak ditemukan',
            404
        )
    }

    const occurrences =
        await ChecklistIssueOccurrence
            .find({
                checklistIssueId:
                    issue._id
            })
            .sort({
                date: -1,
                reportedAt: -1
            })
            .populate(
                'reportedBy',
                'name role'
            )
            .lean()

    return {
        issue,
        occurrences
    }
}


async function resolveIssue({
    issueId,
    resolutionNote,
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
            issueId
        )
    ) {
        throw createError(
            'ID issue tidak valid',
            400
        )
    }

    const issue =
        await ChecklistIssue
            .findById(
                issueId
            )

    if (!issue) {
        throw createError(
            'Issue tidak ditemukan',
            404
        )
    }

    if (
        issue.status ===
        'RESOLVED'
    ) {
        throw createError(
            'Issue sudah diselesaikan',
            400
        )
    }

    const note =
        String(
            resolutionNote || ''
        ).trim()

    if (!note) {
        throw createError(
            'Catatan penyelesaian wajib diisi',
            400
        )
    }

    issue.status =
        'RESOLVED'

    issue.resolutionNote =
        note

    issue.resolvedBy =
        userId

    issue.resolvedAt =
        new Date()

    await issue.save()

    return ChecklistIssue
        .findById(
            issue._id
        )
        .populate(
            'shopId',
            'name type'
        )
        .populate(
            'reportedBy',
            'name role'
        )
        .populate(
            'resolvedBy',
            'name role'
        )
        .lean()
}


module.exports = {
    getDateWIB,
    registerChecklistIssue,
    getIssueList,
    getIssueDetail,
    resolveIssue
}