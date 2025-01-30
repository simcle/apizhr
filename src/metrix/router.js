const express = require('express')

const controller = require('./controller')
const router = express.Router()


router.get('/', controller.getSupplier)
router.get('/supplier', controller.getSupplierData)
module.exports = router
