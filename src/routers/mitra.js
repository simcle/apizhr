const express = require('express');
const router = express.Router();

const mitraController = require('../controllers/mintra');
router.get('/history', mitraController.getHistory)
router.get('/mitras', mitraController.getMitra);
router.get('/', mitraController.getAllMitras);
router.post('/new', mitraController.newMitra);
router.post('/take', mitraController.mitraTake);
router.post('/return', mitraController.mitraReturn);

module.exports = router;