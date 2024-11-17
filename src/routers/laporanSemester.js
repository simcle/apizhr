const express = require('express')
const router = express.Router()

const laporanSemesterController = require('../controllers/laporanSemester')

router.get('/category', laporanSemesterController.getCategory);
router.get('/model-permonth', laporanSemesterController.getModelPerMonth)
router.get('/model', laporanSemesterController.getModelVarian);
router.get('/warna', laporanSemesterController.getWarna)
router.get('/size', laporanSemesterController.getSize)
router.get('/toko', laporanSemesterController.getToko)
router.get('/online', laporanSemesterController.getOnline)
router.get('/mitra', laporanSemesterController.getMitra)
router.get('/attlog', laporanSemesterController.getAttlog)
router.get('/employee', laporanSemesterController.getEmployee)
router.get('/barang', laporanSemesterController.getBarangMasuk)
router.get('/permintaan', laporanSemesterController.getPermintaan)
router.get('/belum-terjual', laporanSemesterController.getProductNotSales);
router.get('/sales', laporanSemesterController.getSalesBySupplier)

module.exports = router