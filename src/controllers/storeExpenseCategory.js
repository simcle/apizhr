const StoreExpenseCategory = require('../models/StoreExpenseCategory')

exports.create = async (req, res) => {
    try {

        const {
            code,
            name,
            description,
            examples,
            sortOrder
        } = req.body

        const exist = await StoreExpenseCategory.findOne({
            $or: [
                { code: code.toUpperCase() },
                { name }
            ]
        })

        if (exist) {
            return res.status(400).json({
                success: false,
                message: 'Kategori sudah digunakan'
            })
        }

        const category = await StoreExpenseCategory.create({
            code: code.toUpperCase(),
            name,
            description,
            examples,
            sortOrder
        })

        res.json({
            success: true,
            data: category
        })

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        })

    }
}

exports.getAll = async (req, res) => {

    try {

        const page = Number(req.query.page || 1)
        const perPage = Number(req.query.perPage || 20)
        const search = req.query.search || ''

        const query = {}

        if (search) {
            query.$or = [
                {
                    code: {
                        $regex: search,
                        $options: 'i'
                    }
                },
                {
                    name: {
                        $regex: search,
                        $options: 'i'
                    }
                }
            ]
        }

        const total = await StoreExpenseCategory.countDocuments(query)

        const data = await StoreExpenseCategory
            .find(query)
            .sort({
                sortOrder: 1,
                name: 1
            })
            .skip((page - 1) * perPage)
            .limit(perPage)

        res.json({
            success: true,
            data,
            pages: {
                total,
                current_page: page,
                per_page: perPage,
                last_page: Math.ceil(total / perPage)
            }
        })

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        })

    }

}

exports.getById = async (req, res) => {

    try {

        const data = await StoreExpenseCategory.findById(req.params.id)

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Kategori tidak ditemukan'
            })
        }

        res.json({
            success: true,
            data
        })

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        })

    }

}

exports.update = async (req, res) => {

    try {

        const id = req.params.id

        const {
            code,
            name,
            description,
            examples,
            sortOrder,
            isActive
        } = req.body

        const exist = await StoreExpenseCategory.findOne({
            _id: {
                $ne: id
            },
            $or: [
                {
                    code: code.toUpperCase()
                },
                {
                    name
                }
            ]
        })

        if (exist) {
            return res.status(400).json({
                success: false,
                message: 'Kategori sudah digunakan'
            })
        }

        const data = await StoreExpenseCategory.findByIdAndUpdate(
            id,
            {
                code: code.toUpperCase(),
                name,
                description,
                examples,
                sortOrder,
                isActive
            },
            {
                new: true,
                runValidators: true
            }
        )

        res.json({
            success: true,
            data
        })

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        })

    }

}

exports.getActive = async (req, res) => {

    try {

        const data = await StoreExpenseCategory
            .find({
                isActive: true
            })
            .sort({
                sortOrder: 1,
                name: 1
            })

        res.json({
            success: true,
            data
        })

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        })

    }

}

exports.remove = async (req, res) => {

    try {

        const data = await StoreExpenseCategory.findByIdAndUpdate(
            req.params.id,
            {
                isActive: false
            },
            {
                new: true
            }
        )

        res.json({
            success: true,
            data
        })

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        })

    }

}