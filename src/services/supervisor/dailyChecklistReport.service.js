
const ChecklistIssueOccurrence = require('../../models/checklistIssueOccurrence')

const {
    getHistory
} = require('./dailyChecklist.service')


async function getDailyChecklistReport({
    startDate = null,
    endDate = null,
    shopId = null
} = {}) {
    // Reuse validasi dan perhitungan History existing
    const history = await getHistory({
        startDate,
        endDate,
        shopId
    })

    const completedChecklists = history.dates.flatMap(
        dateRow => dateRow.shops.filter(
            shop => shop.visitStatus === 'COMPLETED'
        )
    )

    const checklistIds = completedChecklists.map(
        shop => shop._id
    )

    const occurrences = checklistIds.length
        ? await ChecklistIssueOccurrence.find({
            dailyChecklistId: {
                $in: checklistIds
            },
            date: {
                $gte: history.period.startDate,
                $lte: history.period.endDate
            }
        })
            .populate({
                path: 'checklistIssueId',
                select: [
                    'status',
                    'firstReportedAt',
                    'lastReportedAt',
                    'occurrenceCount',
                    'resolvedAt',
                    'resolvedBy',
                    'resolutionNote'
                ].join(' '),
                populate: {
                    path: 'resolvedBy',
                    select: 'name role'
                }
            })
            .populate('shopId', 'name type')
            .populate('reportedBy', 'name role')
            .sort({
                date: -1,
                reportedAt: -1
            })
            .lean()
        : []

    const issueDetails = occurrences.map(item => {
        const issue = item.checklistIssueId

        return {
            _id: item._id,
            checklistIssueId: issue?._id || null,
            dailyChecklistId: item.dailyChecklistId,
            dailyChecklistItemId: item.dailyChecklistItemId,

            date: item.date,
            shop: item.shopId || null,

            category: item.category,
            label: item.label,
            issueNote: item.issueNote || '',

            reportedBy: item.reportedBy || null,
            reportedAt: item.reportedAt,

            status: issue?.status || null,
            firstReportedAt: issue?.firstReportedAt || null,
            lastReportedAt: issue?.lastReportedAt || null,

            resolvedAt: issue?.resolvedAt || null,
            resolvedBy: issue?.resolvedBy || null,
            resolutionNote: issue?.resolutionNote || ''
        }
    })

    // Hitung issue unik, bukan jumlah kemunculan
    const uniqueIssueMap = new Map()

    for (const item of issueDetails) {
        if (!item.checklistIssueId) continue

        const id = String(item.checklistIssueId)

        if (!uniqueIssueMap.has(id)) {
            uniqueIssueMap.set(id, item.status)
        }
    }

    const statuses = Array.from(uniqueIssueMap.values())

    const issueSummary = {
        totalOccurrences: issueDetails.length,
        uniqueIssues: uniqueIssueMap.size,
        openIssues: statuses.filter(
            status => status === 'OPEN'
        ).length,
        resolvedIssues: statuses.filter(
            status => status === 'RESOLVED'
        ).length
    }

    // Rekap performa per toko, termasuk laporan global
    const shopMap = new Map()

    for (const dateRow of history.dates) {
        for (const shop of dateRow.shops) {
            const id = String(shop.shopId)

            if (!shopMap.has(id)) {
                shopMap.set(id, {
                    shopId: shop.shopId,
                    shopName: shop.shopName,
                    totalExpected: 0,
                    completed: 0,
                    missed: 0,
                    inProgress: 0,
                    notVisited: 0,
                    totalItems: 0,
                    totalOk: 0,
                    totalIssues: 0
                })
            }

            const row = shopMap.get(id)

            row.totalExpected++

            if (shop.visitStatus === 'COMPLETED') {
                row.completed++
                row.totalItems += shop.totalItems
                row.totalOk += shop.totalOk
            }

            if (shop.visitStatus === 'MISSED') {
                row.missed++
            }

            if (shop.visitStatus === 'IN_PROGRESS') {
                row.inProgress++
            }

            if (shop.visitStatus === 'NOT_VISITED') {
                row.notVisited++
            }

            row.totalIssues += shop.totalIssue
        }
    }

    const shopSummary = Array.from(shopMap.values())
        .map(row => {
            const evaluatedItems =
                row.totalOk + row.totalIssues

            return {
                ...row,

                completionRate: row.totalExpected
                    ? Math.round(
                        row.completed / row.totalExpected * 100
                    )
                    : 0,

                complianceRate: evaluatedItems
                    ? Number(
                        (
                            row.totalOk / evaluatedItems * 100
                        ).toFixed(2)
                    )
                    : 0
            }
        })
        .sort((a, b) =>
            a.shopName.localeCompare(b.shopName)
        )

    const expectedIssueOccurrences =
        completedChecklists.reduce(
            (total, checklist) =>
                total + checklist.totalIssue,
            0
        )

    return {
        period: history.period,
        shop: history.shop,

        summary: history.summary,
        dates: history.dates,

        shopSummary,
        issueSummary,
        issueDetails,

        reconciliation: {
            expectedIssueOccurrences,
            actualIssueOccurrences: issueDetails.length,
            matches:
                expectedIssueOccurrences === issueDetails.length
        }
    }
}


module.exports = {
    getDailyChecklistReport
}
