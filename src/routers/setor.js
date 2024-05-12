const express = require('express');
const router = express.Router()
const setorController = require('../controllers/setor')


router.get('/', setorController.getSetor)


module.exports = router