const express = require('express');
const router = express.Router();

const pengeluaranController = require('../controllers/pengeluaran');

router.get('/', pengeluaranController.getPengeluaran);
router.post('/', pengeluaranController.insertPengeluaran);
router.get('/admin', pengeluaranController.getPengeluaranAdmin);
router.post('/admin', pengeluaranController.insertPengeluaranAdmin);
router.delete('/:pengeluaranId', pengeluaranController.deletePengeluaran);

module.exports = router;