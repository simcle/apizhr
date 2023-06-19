const express = require('express');
const router = express.Router();

const pengeluaranController = require('../controllers/pengeluaran');

router.get('/', pengeluaranController.getPengeluaran);
router.post('/', pengeluaranController.insertPengeluaran);
router.delete('/:pengeluaranId', pengeluaranController.deletePengeluaran);

module.exports = router;