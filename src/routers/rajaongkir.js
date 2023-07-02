const express = require('express');
const router = express.Router();

const rajaongkirController = require('../controllers/rajaongkir');

router.post('/resi', rajaongkirController.cekResi);


module.exports = router;