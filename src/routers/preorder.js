const express = require('express');
const router = express.Router();

const preorderController = require('../controllers/preorder');
const authenticateToken = require('../../authenticate');

router.get('/', authenticateToken, preorderController.getPreorder);
router.post('/', authenticateToken, preorderController.insertPreorder);
router.get('/menunggu/:id', preorderController.getMenunggu);
router.get('/proses/:id', preorderController.getProses);
router.get('/selesai/:id', preorderController.getSelesai);
router.get('/tolak/:id', preorderController.getTolak);
router.put('/terima', preorderController.putTerima);
router.put('/tolak', preorderController.putTolak);
router.put('/selesai', preorderController.putSelesai);

module.exports = router;