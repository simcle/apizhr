module.exports = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                status: false,
                message: 'User belum terautentikasi'
            })
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                status: false,
                message: 'Anda tidak memiliki akses ke fitur ini'
            })
        }

        next()
    }
}