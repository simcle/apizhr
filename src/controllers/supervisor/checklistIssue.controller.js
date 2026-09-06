const {
    getIssueList,
    getIssueDetail,
    resolveIssue
} = require('../../services/supervisor/checklistIssue.service')


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


exports.getList = async (req, res) => {
    try {
        const result =
            await getIssueList({
                status:
                    req.query.status,

                shopId:
                    req.query.shopId,

                category:
                    req.query.category,

                search:
                    req.query.search,

                page:
                    req.query.page,

                limit:
                    req.query.limit
            })

        return res.status(200).json({
            status: true,
            data: result
        })

    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}


exports.getDetail = async (req, res) => {
    try {
        const result =
            await getIssueDetail(
                req.params.id
            )

        return res.status(200).json({
            status: true,
            data: result
        })

    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}


exports.resolve = async (req, res) => {
    try {
        const userId =
            req.user?._id ||
            null

        if (!userId) {
            return res.status(401).json({
                status: false,
                message: 'User tidak valid'
            })
        }

        const result =
            await resolveIssue({
                issueId:
                    req.params.id,

                resolutionNote:
                    req.body.resolutionNote,

                userId
            })

        return res.status(200).json({
            status: true,

            message:
                'Issue berhasil diselesaikan',

            data:
                result
        })

    } catch (error) {
        return handleError(
            res,
            error
        )
    }
}