const express = require('express');
const router = express.Router()
const setorController = require('../controllers/setor')


router.get('/', setorController.getSetor)
router.post('/', setorController.postSetor);
router.delete('/:id', setorController.deleteSetor)
router.get('/report', setorController.getLaporan)

module.exports = router