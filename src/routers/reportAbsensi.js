const express = require('express')
const router = express.Router()

const reportAbsensiController = require('../controllers/reportAbsensi')

router.get('/', reportAbsensiController.getReportAttlogs)

module.exports = router