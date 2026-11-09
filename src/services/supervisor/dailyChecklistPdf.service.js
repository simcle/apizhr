
'use strict'

const PDFDocument = require('pdfkit')
const fs = require('node:fs')
const path = require('node:path')

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89

const MARGIN = 42
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const CONTENT_TOP = 82
const CONTENT_BOTTOM = PAGE_HEIGHT - 62

const COLORS = {
    navy: '#17263E',
    ink: '#26364D',
    muted: '#63748B',
    cyan: '#179B9D',
    pale: '#E8F6F5',
    bg: '#F4F7FA',
    orange: '#DC8B42',
    red: '#B5454D',
    border: '#E0E6ED',
    white: '#FFFFFF'
}

const FONT = {
    title: 22,
    heading: 14,
    subheading: 12,
    kpi: 20,
    body: 11,
    tableHeader: 10,
    tableBody: 11,
    issue: 11,
    small: 10,
    footer: 10
}

function fmt(value) {
    return new Intl.NumberFormat('id-ID').format(
        Number(value || 0)
    )
}

function percent(value) {
    const number = Number(value)

    if (!Number.isFinite(number)) {
        return '—'
    }

    return `${number.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}%`
}

function clean(value) {
    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return '—'
    }

    return String(value)
}

function dateLabel(value) {
    if (!value) return '—'

    const source = String(value)

    const match = source.match(
        /^(\d{4})-(\d{2})-(\d{2})/
    )

    if (match) {
        return `${match[3]}/${match[2]}/${match[1]}`
    }

    const date = new Date(source)

    if (Number.isNaN(date.getTime())) {
        return source
    }

    return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date)
}

function registerFonts(doc) {
    const dir = path.resolve(
        __dirname,
        '../../../assets/fonts'
    )

    const regular = path.join(
        dir,
        'DejaVuSans.ttf'
    )

    const bold = path.join(
        dir,
        'DejaVuSans-Bold.ttf'
    )

    if (
        fs.existsSync(regular) &&
        fs.existsSync(bold)
    ) {
        doc.registerFont('Regular', regular)
        doc.registerFont('Bold', bold)
    } else {
        doc.registerFont('Regular', 'Helvetica')
        doc.registerFont('Bold', 'Helvetica-Bold')
    }
}

function setFont(doc, options = {}) {
    const fontSize = Math.max(
        9,
        Number(options.fontSize) || FONT.body
    )

    doc.font(
        options.bold ? 'Bold' : 'Regular'
    )

    doc.fontSize(fontSize)

    return fontSize
}

function text(
    doc,
    content,
    x,
    y,
    options = {}
) {
    const {
        color = COLORS.ink,
        bold = false,
        fontSize = FONT.body,
        ...rest
    } = options

    setFont(doc, {
        bold,
        fontSize
    })

    doc.fillColor(color)

    doc.text(
        clean(content),
        x,
        y,
        {
            lineGap: 2,
            ...rest
        }
    )
}

function textHeight(
    doc,
    content,
    width,
    options = {}
) {
    setFont(doc, options)

    return doc.heightOfString(
        clean(content),
        {
            width,
            lineGap: options.lineGap ?? 2
        }
    )
}

function rounded(
    doc,
    x,
    y,
    width,
    height,
    color,
    radius = 6
) {
    doc.roundedRect(
        x,
        y,
        width,
        height,
        radius
    ).fill(color)
}

function line(
    doc,
    x1,
    y1,
    x2,
    y2,
    color = COLORS.border,
    width = 0.7
) {
    doc.lineWidth(width)
        .strokeColor(color)
        .moveTo(x1, y1)
        .lineTo(x2, y2)
        .stroke()
}

function ensureSpace(
    doc,
    y,
    required,
    pageTitle = null
) {
    if (y + required <= CONTENT_BOTTOM) {
        return y
    }

    doc.addPage()

    let nextY = CONTENT_TOP

    if (pageTitle) {
        text(
            doc,
            pageTitle,
            MARGIN,
            nextY,
            {
                bold: true,
                fontSize: FONT.heading,
                color: COLORS.navy,
                width: CONTENT_WIDTH
            }
        )

        nextY += 30
    }

    return nextY
}

function section(doc, title, y) {
    y = ensureSpace(doc, y, 35)

    text(
        doc,
        title,
        MARGIN,
        y,
        {
            bold: true,
            fontSize: FONT.subheading,
            color: COLORS.navy,
            width: CONTENT_WIDTH
        }
    )

    return y + 29
}

function newSectionPage(
    doc,
    title,
    subtitle = ''
) {
    doc.addPage()

    let y = CONTENT_TOP

    text(
        doc,
        title,
        MARGIN,
        y,
        {
            fontSize: FONT.title,
            color: COLORS.navy,
            bold: true,
            width: CONTENT_WIDTH
        }
    )

    y += 38

    if (subtitle) {
        const height = textHeight(
            doc,
            subtitle,
            CONTENT_WIDTH,
            {
                fontSize: FONT.small
            }
        )

        text(
            doc,
            subtitle,
            MARGIN,
            y,
            {
                fontSize: FONT.small,
                color: COLORS.muted,
                width: CONTENT_WIDTH
            }
        )

        y += height + 18
    }

    return y
}

function drawKpiCard(
    doc,
    x,
    y,
    width,
    label,
    value,
    description
) {
    const height = 94

    rounded(
        doc,
        x,
        y,
        width,
        height,
        COLORS.bg
    )

    text(
        doc,
        label.toUpperCase(),
        x + 13,
        y + 12,
        {
            fontSize: FONT.small,
            bold: true,
            color: COLORS.muted,
            width: width - 26
        }
    )

    text(
        doc,
        value,
        x + 13,
        y + 34,
        {
            fontSize: FONT.kpi,
            bold: true,
            color: COLORS.navy,
            width: width - 26
        }
    )

    text(
        doc,
        description,
        x + 13,
        y + 68,
        {
            fontSize: FONT.small,
            color: COLORS.muted,
            width: width - 26
        }
    )

    return height
}

function drawTrend(
    doc,
    dateRows,
    y
) {
    const rows = [
        ...(dateRows || [])
    ].sort(
        (a, b) =>
            String(a.date).localeCompare(
                String(b.date)
            )
    )

    const height = 245

    y = ensureSpace(
        doc,
        y,
        height
    )

    rounded(
        doc,
        MARGIN,
        y,
        CONTENT_WIDTH,
        height,
        COLORS.bg
    )

    const left = MARGIN + 48
    const right = MARGIN + CONTENT_WIDTH - 20

    const top = y + 43
    const bottom = y + height - 46

    text(
        doc,
        'Completion Rate harian (%)',
        MARGIN + 15,
        y + 12,
        {
            fontSize: FONT.small,
            bold: true
        }
    )

    for (
        const value of [0, 25, 50, 75, 100]
    ) {
        const py =
            bottom -
            (bottom - top) * value / 100

        line(
            doc,
            left,
            py,
            right,
            py
        )

        text(
            doc,
            String(value),
            left - 38,
            py - 6,
            {
                fontSize: FONT.small,
                color: COLORS.muted,
                width: 30,
                align: 'right'
            }
        )
    }

    if (!rows.length) {
        text(
            doc,
            'Tidak ada data harian',
            left + 20,
            y + 110
        )

        return y + height
    }

    const points = rows.map(
        (row, index) => {
            const ratio =
                rows.length === 1
                    ? 0.5
                    : index / (rows.length - 1)

            const rate = Math.max(
                0,
                Math.min(
                    100,
                    Number(row.completionRate) || 0
                )
            )

            return {
                x:
                    left +
                    (right - left) * ratio,

                y:
                    bottom -
                    (bottom - top) *
                    rate / 100,

                label: String(row.date)
            }
        }
    )

    doc.strokeColor(COLORS.cyan)
        .lineWidth(2)

    points.forEach(
        (point, index) => {
            if (index === 0) {
                doc.moveTo(
                    point.x,
                    point.y
                )
            } else {
                doc.lineTo(
                    point.x,
                    point.y
                )
            }
        }
    )

    doc.stroke()

    const stride = Math.max(
        1,
        Math.ceil(points.length / 5)
    )

    points.forEach(
        (point, index) => {
            doc.circle(
                point.x,
                point.y,
                2.5
            ).fill(COLORS.cyan)

            if (
                index % stride === 0 ||
                index === points.length - 1
            ) {
                text(
                    doc,
                    point.label.slice(5),
                    point.x - 26,
                    bottom + 14,
                    {
                        fontSize: FONT.small,
                        color: COLORS.muted,
                        width: 52,
                        align: 'center'
                    }
                )
            }
        }
    )

    return y + height
}

function getShopName(shop) {
    return (
        shop.shopName ||
        shop.name ||
        shop.shop?.name ||
        '—'
    )
}

function drawShopTable(
    doc,
    shops,
    summary,
    y
) {
    const columns = [
        { key: 'name', label: 'Toko', width: 74 },
        { key: 'expected', label: 'Wajib', width: 47 },
        { key: 'completed', label: 'Selesai', width: 53 },
        { key: 'missed', label: 'Lewat', width: 48 },
        { key: 'ok', label: 'OK', width: 55 },
        { key: 'issues', label: 'Issue', width: 43 },
        { key: 'completion', label: 'Selesai %', width: 84 },
        { key: 'compliance', label: 'Patuh %', width: 107.28 }
    ]

    const headerHeight = 45
    const rowHeight = 40

    const drawHeader = () => {
        doc.rect(
            MARGIN,
            y,
            CONTENT_WIDTH,
            headerHeight
        ).fill(COLORS.navy)

        let x = MARGIN

        columns.forEach(column => {
            text(
                doc,
                column.label,
                x + 3,
                y + 13,
                {
                    fontSize: FONT.tableHeader,
                    color: COLORS.white,
                    bold: true,
                    width: column.width - 6,
                    align:
                        column.key === 'name'
                            ? 'left'
                            : 'center'
                }
            )

            x += column.width
        })

        y += headerHeight
    }

    const drawRow = (
        shop,
        index,
        total = false
    ) => {
        y = ensureSpace(
            doc,
            y,
            rowHeight,
            'Performa toko - lanjutan'
        )

        if (y === CONTENT_TOP + 30) {
            drawHeader()
        }

        const fill =
            total
                ? COLORS.pale
                : index % 2 === 0
                    ? COLORS.white
                    : COLORS.bg

        doc.rect(
            MARGIN,
            y,
            CONTENT_WIDTH,
            rowHeight
        ).fill(fill)

        const values = [
            total
                ? 'TOTAL'
                : getShopName(shop),

            fmt(shop.totalExpected),

            fmt(shop.completed),

            fmt(shop.missed),

            fmt(shop.totalOk),

            fmt(shop.totalIssues),

            `${Math.round(
                Number(shop.completionRate) || 0
            )}%`,

            percent(shop.complianceRate)
        ]

        let x = MARGIN

        values.forEach(
            (value, columnIndex) => {
                text(
                    doc,
                    value,
                    x + 3,
                    y + 13,
                    {
                        fontSize: FONT.tableBody,
                        bold: total,
                        color: COLORS.ink,
                        width:
                            columns[columnIndex].width - 6,
                        align:
                            columnIndex === 0
                                ? 'left'
                                : 'center'
                    }
                )

                x += columns[columnIndex].width
            }
        )

        y += rowHeight
    }

    y = ensureSpace(
        doc,
        y,
        headerHeight + rowHeight,
        'Performa toko'
    )

    drawHeader()

    shops.forEach(
        (shop, index) => {
            drawRow(shop, index)
        }
    )

    drawRow(
        summary,
        shops.length,
        true
    )

    return y
}

function drawShopChart(
    doc,
    shops,
    y
) {
    const sorted = [
        ...shops
    ].sort(
        (a, b) =>
            Number(b.complianceRate) -
            Number(a.complianceRate)
    )

    const rowHeight = 29

    const height = Math.max(
        75,
        35 + sorted.length * rowHeight
    )

    y = ensureSpace(
        doc,
        y,
        height,
        'Perbandingan kepatuhan - lanjutan'
    )

    rounded(
        doc,
        MARGIN,
        y,
        CONTENT_WIDTH,
        height,
        COLORS.bg
    )

    const labelWidth = 105
    const rightWidth = 79

    const barX = MARGIN + labelWidth

    const barWidth =
        CONTENT_WIDTH -
        labelWidth -
        rightWidth

    sorted.forEach(
        (shop, index) => {
            const py =
                y + 16 +
                index * rowHeight

            text(
                doc,
                getShopName(shop),
                MARGIN + 10,
                py,
                {
                    fontSize: FONT.small,
                    bold: true,
                    width: labelWidth - 16
                }
            )

            rounded(
                doc,
                barX,
                py + 3,
                barWidth,
                12,
                COLORS.border,
                3
            )

            const rate = Math.max(
                0,
                Math.min(
                    100,
                    Number(shop.complianceRate) || 0
                )
            )

            if (rate > 0) {
                rounded(
                    doc,
                    barX,
                    py + 3,
                    barWidth * rate / 100,
                    12,
                    COLORS.cyan,
                    3
                )
            }

            text(
                doc,
                percent(shop.complianceRate),
                barX + barWidth + 8,
                py,
                {
                    fontSize: FONT.small,
                    width: rightWidth - 12
                }
            )
        }
    )

    return y + height
}

function drawIssue(
    doc,
    issue,
    index,
    y
) {
    const shopName =
        issue.shop?.name ||
        issue.shopName ||
        '—'

    const status =
        clean(issue.status)

    const heading =
        `${String(index + 1).padStart(3, '0')}  |  ` +
        `${dateLabel(issue.date)}  |  ` +
        `${shopName}  |  ${status}`

    const descriptor =
        `${clean(issue.label)}  |  ` +
        `${clean(issue.category)}`

    const found =
        `Temuan: ${clean(issue.issueNote)}`

    const resolution =
        `Penyelesaian: ${clean(issue.resolutionNote)}`

    const resolvedAt =
        issue.resolvedAt
            ? dateLabel(issue.resolvedAt)
            : '—'

    const footer =
        `Diselesaikan: ${resolvedAt}  |  ` +
        `ID kejadian: ${clean(issue._id)}`

    const entries = [
        {
            value: heading,
            fontSize: FONT.issue,
            bold: true
        },
        {
            value: descriptor,
            fontSize: FONT.issue
        },
        {
            value: found,
            fontSize: FONT.issue
        },
        {
            value: resolution,
            fontSize: FONT.issue
        },
        {
            value: footer,
            fontSize: FONT.small
        }
    ]

    const innerWidth = CONTENT_WIDTH - 28

    const gap = 5
    const verticalPadding = 14

    const heights = entries.map(entry => {
        return textHeight(
            doc,
            entry.value,
            innerWidth,
            {
                fontSize: entry.fontSize,
                bold: Boolean(entry.bold)
            }
        )
    })

    const required =
        verticalPadding * 2 +
        heights.reduce(
            (sum, value) => sum + value,
            0
        ) +
        gap * (entries.length - 1)

    y = ensureSpace(
        doc,
        y,
        required + 10,
        'Lampiran temuan - lanjutan'
    )

    rounded(
        doc,
        MARGIN,
        y,
        CONTENT_WIDTH,
        required,
        index % 2 === 0
            ? COLORS.bg
            : COLORS.white
    )

    doc.roundedRect(
        MARGIN,
        y,
        CONTENT_WIDTH,
        required,
        6
    )
        .lineWidth(0.6)
        .strokeColor(COLORS.border)
        .stroke()

    let currentY =
        y + verticalPadding

    entries.forEach(
        (entry, entryIndex) => {
            text(
                doc,
                entry.value,
                MARGIN + 14,
                currentY,
                {
                    fontSize: entry.fontSize,
                    bold: Boolean(entry.bold),
                    color:
                        entryIndex === 4
                            ? COLORS.muted
                            : COLORS.ink,
                    width: innerWidth
                }
            )

            currentY +=
                heights[entryIndex] + gap
        }
    )

    return y + required + 10
}

function drawPageFrame(
    doc,
    pageIndex
) {
    doc.rect(
        0,
        0,
        PAGE_WIDTH,
        55
    ).fill(COLORS.navy)

    text(
        doc,
        'ZHR LEATHER',
        MARGIN,
        20,
        {
            fontSize: 11,
            bold: true,
            color: COLORS.white
        }
    )

    text(
        doc,
        'OPERASIONAL TOKO / LAPORAN',
        PAGE_WIDTH - MARGIN - 245,
        21,
        {
            fontSize: FONT.small,
            color: COLORS.white,
            width: 245,
            align: 'right'
        }
    )

    line(
        doc,
        MARGIN,
        PAGE_HEIGHT - 45,
        PAGE_WIDTH - MARGIN,
        PAGE_HEIGHT - 45
    )

    text(
        doc,
        'Daily Checklist Supervisor',
        MARGIN,
        PAGE_HEIGHT - 34,
        {
            fontSize: FONT.footer,
            color: COLORS.muted
        }
    )

    text(
        doc,
        `Halaman ${pageIndex + 1}`,
        PAGE_WIDTH - MARGIN - 110,
        PAGE_HEIGHT - 34,
        {
            fontSize: FONT.footer,
            color: COLORS.muted,
            width: 110,
            align: 'right'
        }
    )
}

function generateDailyChecklistPdf(report) {
    return new Promise(
        (resolve, reject) => {
            if (
                !report ||
                !report.period ||
                !report.summary ||
                !Array.isArray(report.issueDetails)
            ) {
                reject(
                    new TypeError(
                        'Format data laporan Daily Checklist tidak valid'
                    )
                )

                return
            }

            const doc = new PDFDocument({
                size: 'A4',
                margin: 0,
                bufferPages: true,
                compress: true,
                info: {
                    Title:
                        'ZHR Leather - Laporan Daily Checklist Supervisor',
                    Author: 'ZHR Leather'
                }
            })

            registerFonts(doc)

            const chunks = []

            doc.on(
                'data',
                chunk => chunks.push(chunk)
            )

            doc.on('error', reject)

            doc.on(
                'end',
                () => resolve(
                    Buffer.concat(chunks)
                )
            )

            try {
                const summary =
                    report.summary

                const shops =
                    report.shopSummary || []

                const dates =
                    report.dates || []

                const issues =
                    report.issueDetails

                const shopName =
                    report.shop?.name ||
                    'Seluruh Toko'

                const periodText =
                    `Periode ` +
                    `${dateLabel(report.period.startDate)} - ` +
                    `${dateLabel(report.period.endDate)}` +
                    `  |  ${shopName}`

                // HALAMAN 1
                // RINGKASAN

                let y = CONTENT_TOP

                text(
                    doc,
                    'Laporan Daily Checklist',
                    MARGIN,
                    y,
                    {
                        fontSize: FONT.title,
                        bold: true,
                        color: COLORS.navy,
                        width: CONTENT_WIDTH
                    }
                )

                y += 31

                text(
                    doc,
                    'Supervisor',
                    MARGIN,
                    y,
                    {
                        fontSize: FONT.title,
                        bold: true,
                        color: COLORS.navy
                    }
                )

                y += 39

                text(
                    doc,
                    periodText,
                    MARGIN,
                    y,
                    {
                        fontSize: FONT.small,
                        color: COLORS.muted,
                        width: CONTENT_WIDTH
                    }
                )

                y += 36

                const gap = 10

                const half =
                    (CONTENT_WIDTH - gap) / 2

                drawKpiCard(
                    doc,
                    MARGIN,
                    y,
                    half,
                    'Penyelesaian',
                    `${Math.round(
                        Number(summary.completionRate) || 0
                    )}%`,
                    `${fmt(summary.completed)} dari ` +
                    `${fmt(summary.totalExpected)} kunjungan`
                )

                drawKpiCard(
                    doc,
                    MARGIN + half + gap,
                    y,
                    half,
                    'Kepatuhan',
                    percent(summary.complianceRate),
                    `${fmt(summary.totalOk)} dari ` +
                    `${fmt(summary.totalItems)} item sesuai`
                )

                y += 104

                drawKpiCard(
                    doc,
                    MARGIN,
                    y,
                    half,
                    'Terlewat',
                    fmt(summary.missed),
                    'Kunjungan terlewat'
                )

                drawKpiCard(
                    doc,
                    MARGIN + half + gap,
                    y,
                    half,
                    'Issue',
                    fmt(summary.totalIssues),
                    'Kejadian temuan'
                )

                y += 118

                y = section(
                    doc,
                    'Ringkasan pelaksanaan',
                    y
                )

                const overview =
                    `Sebanyak ${fmt(summary.completed)} ` +
                    `dari ${fmt(summary.totalExpected)} ` +
                    `checklist selesai dan ` +
                    `${fmt(summary.missed)} terlewat. ` +
                    `Dari ${fmt(summary.totalItems)} item ` +
                    `yang diperiksa, ${fmt(summary.totalOk)} ` +
                    `memenuhi standar dan ` +
                    `${fmt(summary.totalIssues)} ` +
                    `dicatat sebagai issue.`

                const overviewHeight = textHeight(
                    doc,
                    overview,
                    CONTENT_WIDTH,
                    {
                        fontSize: FONT.body
                    }
                )

                text(
                    doc,
                    overview,
                    MARGIN,
                    y,
                    {
                        fontSize: FONT.body,
                        width: CONTENT_WIDTH
                    }
                )

                y += overviewHeight + 14

                const note =
                    'MISSED hanya memengaruhi penyelesaian, ' +
                    'bukan kepatuhan. Kepatuhan dihitung ' +
                    'berdasarkan item yang benar-benar diperiksa.'

                const noteHeight = textHeight(
                    doc,
                    note,
                    CONTENT_WIDTH,
                    {
                        fontSize: FONT.small
                    }
                )

                text(
                    doc,
                    note,
                    MARGIN,
                    y,
                    {
                        fontSize: FONT.small,
                        color: COLORS.muted,
                        width: CONTENT_WIDTH
                    }
                )

                y += noteHeight + 22

                y = section(
                    doc,
                    'Tren penyelesaian harian',
                    y
                )

                drawTrend(
                    doc,
                    dates,
                    y
                )

                // HALAMAN PERFORMA TOKO

                y = newSectionPage(
                    doc,
                    'Performa setiap toko',
                    'Persentase kepatuhan berdasarkan ' +
                    'item yang benar-benar diperiksa.'
                )

                y = drawShopTable(
                    doc,
                    shops,
                    summary,
                    y
                )

                y += 24

                y = section(
                    doc,
                    'Perbandingan kepatuhan toko',
                    y
                )

                y = drawShopChart(
                    doc,
                    shops,
                    y
                )

                y += 24

                y = section(
                    doc,
                    'Rekonsiliasi issue',
                    y
                )

                const issueSummary =
                    report.issueSummary || {}

                const reconciliation =
                    report.reconciliation || {}

                const issueText =
                    `Total kejadian: ` +
                    `${fmt(issueSummary.totalOccurrences)}  |  ` +
                    `Issue unik: ` +
                    `${fmt(issueSummary.uniqueIssues)}  |  ` +
                    `OPEN: ${fmt(issueSummary.openIssues)}  |  ` +
                    `RESOLVED: ` +
                    `${fmt(issueSummary.resolvedIssues)}`

                const issueHeight = textHeight(
                    doc,
                    issueText,
                    CONTENT_WIDTH,
                    {
                        fontSize: FONT.body
                    }
                )

                y = ensureSpace(
                    doc,
                    y,
                    issueHeight + 50,
                    'Rekonsiliasi issue - lanjutan'
                )

                text(
                    doc,
                    issueText,
                    MARGIN,
                    y,
                    {
                        fontSize: FONT.body,
                        width: CONTENT_WIDTH
                    }
                )

                y += issueHeight + 12

                const reconciliationText =
                    `Rekonsiliasi occurrence: ` +
                    `${fmt(
                        reconciliation.expectedIssueOccurrences
                    )} diharapkan, ` +
                    `${fmt(
                        reconciliation.actualIssueOccurrences
                    )} tersedia - ` +
                    `${
                        reconciliation.matches
                            ? 'sesuai'
                            : 'tidak sesuai'
                    }.`

                text(
                    doc,
                    reconciliationText,
                    MARGIN,
                    y,
                    {
                        fontSize: FONT.small,
                        color: COLORS.muted,
                        width: CONTENT_WIDTH
                    }
                )

                // LAMPIRAN ISSUE

                y = newSectionPage(
                    doc,
                    'Lampiran - Seluruh kejadian temuan',
                    `${fmt(issues.length)} kejadian. ` +
                    'Seluruh temuan, termasuk kejadian ' +
                    'berulang, ditampilkan tanpa penggabungan.'
                )

                issues.forEach(
                    (issue, index) => {
                        y = drawIssue(
                            doc,
                            issue,
                            index,
                            y
                        )
                    }
                )

                // HEADER DAN FOOTER

                const range =
                    doc.bufferedPageRange()

                for (
                    let page = range.start;
                    page < range.start + range.count;
                    page++
                ) {
                    doc.switchToPage(page)

                    drawPageFrame(
                        doc,
                        page
                    )
                }

                doc.end()
            } catch (error) {
                reject(error)
            }
        }
    )
}

module.exports = {
    generateDailyChecklistPdf
}
