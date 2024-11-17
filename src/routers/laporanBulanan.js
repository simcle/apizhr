const express = require('express')

const router = express.Router()

const laporanBulananController = require('../controllers/laporanBulanan')

router.get('/', laporanBulananController.getLaporan)

module.exports = router