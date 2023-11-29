const express = require('express');
const router = express.Router();

const returnController = require('../controllers/returns');

router.get('/', returnController.getAllReturn);
router.post('/', returnController.insertReturn);


module.exports = router;