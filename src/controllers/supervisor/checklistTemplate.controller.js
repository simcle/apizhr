const mongoose = require('mongoose')

const ChecklistTemplateItem = require('../../models/checklistTemplateItem')


function handleError(res, error) {
    console.error(error)

    return res.status(
        error.statusCode || 500
    ).json({
        status: false,
        message:
            error.statusCode
                ? error.message
                : 'Terjadi kesalahan pada server'
    })
}


/*
 * GET /api/supervisor/checklist-template-items
 *
 * Query:
 * ?active=true
 * ?category=
 * ?search=
 */
exports.getList = async (req, res) => {
    try {
        const match = {}

        if (
            req.query.active === 'true' ||
            req.query.active === 'false'
        ) {
            match.isActive =
                req.query.active === 'true'
        }

        const category =
            String(
                req.query.category || ''
            ).trim()

        if (category) {
            match.category = category
        }

        const search =
            String(
                req.query.search || ''
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
                        $regex: escaped,
                        $options: 'i'
                    }
                },

                {
                    description: {
                        $regex: escaped,
                        $options: 'i'
                    }
                },

                {
                    category: {
                        $regex: escaped,
                        $options: 'i'
                    }
                }
            ]
        }

        const items =
            await ChecklistTemplateItem
                .find(match)
                .sort({
                    category: 1,
                    sortOrder: 1,
                    createdAt: 1
                })
                .lean()

        return res.status(200).json({
            status: true,
            data: {
                items
            }
        })

    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}


/*
 * POST /api/supervisor/checklist-template-items
 *
 * Body:
 *
 * {
 *     "category": "KONDISI_TOKO",
 *     "label": "Kebersihan area toko",
 *     "description": "",
 *     "sortOrder": 1,
 *     "issueNoteRequired": true
 * }
 */
exports.create = async (req, res) => {
    try {
        const category =
            String(
                req.body.category || ''
            ).trim()

        const label =
            String(
                req.body.label || ''
            ).trim()

        const description =
            String(
                req.body.description || ''
            ).trim()

        if (!category) {
            return res.status(400).json({
                status: false,
                message: 'Kategori checklist wajib diisi'
            })
        }

        if (!label) {
            return res.status(400).json({
                status: false,
                message: 'Item checklist wajib diisi'
            })
        }

        const item =
            await ChecklistTemplateItem.create({
                category,
                label,
                description,

                sortOrder:
                    Number(
                        req.body.sortOrder || 0
                    ),

                isActive:
                    true,

                issueNoteRequired:
                    req.body.issueNoteRequired !== false
            })

        return res.status(201).json({
            status: true,
            message: 'Item checklist berhasil dibuat',
            data: item
        })

    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}


/*
 * PATCH /api/supervisor/checklist-template-items/:id
 */
exports.update = async (req, res) => {
    try {
        const id = req.params.id

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                status: false,
                message: 'ID item checklist tidak valid'
            })
        }

        const item =
            await ChecklistTemplateItem
                .findById(id)

        if (!item) {
            return res.status(404).json({
                status: false,
                message: 'Item checklist tidak ditemukan'
            })
        }

        if (
            req.body.category !== undefined
        ) {
            const category =
                String(
                    req.body.category || ''
                ).trim()

            if (!category) {
                return res.status(400).json({
                    status: false,
                    message: 'Kategori checklist wajib diisi'
                })
            }

            item.category = category
        }

        if (
            req.body.label !== undefined
        ) {
            const label =
                String(
                    req.body.label || ''
                ).trim()

            if (!label) {
                return res.status(400).json({
                    status: false,
                    message: 'Item checklist wajib diisi'
                })
            }

            item.label = label
        }

        if (
            req.body.description !== undefined
        ) {
            item.description =
                String(
                    req.body.description || ''
                ).trim()
        }

        if (
            req.body.sortOrder !== undefined
        ) {
            item.sortOrder =
                Number(
                    req.body.sortOrder || 0
                )
        }

        if (
            req.body.issueNoteRequired !== undefined
        ) {
            item.issueNoteRequired =
                Boolean(
                    req.body.issueNoteRequired
                )
        }

        await item.save()

        return res.status(200).json({
            status: true,
            message: 'Item checklist berhasil diperbarui',
            data: item
        })

    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}


/*
 * PATCH /api/supervisor/checklist-template-items/:id/toggle
 */
exports.toggle = async (req, res) => {
    try {
        const id = req.params.id

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                status: false,
                message: 'ID item checklist tidak valid'
            })
        }

        const item =
            await ChecklistTemplateItem
                .findById(id)

        if (!item) {
            return res.status(404).json({
                status: false,
                message: 'Item checklist tidak ditemukan'
            })
        }

        item.isActive =
            !item.isActive

        await item.save()

        return res.status(200).json({
            status: true,

            message:
                item.isActive
                    ? 'Item checklist diaktifkan'
                    : 'Item checklist dinonaktifkan',

            data: item
        })

    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}