const express = require('express');
const router = express.Router();

const resellerController = require('../controllers/reseller');

router.get('/', resellerController.getReseller);
router.post('/', resellerController.inserReseller);
router.put('/', resellerController.updateReseller);
router.get('/stat', resellerController.statReseller);
router.get('/seller', resellerController.getSeller);
router.post('/seller', resellerController.insertSeller);
router.post('/bayar/:resellerId', resellerController.bayarReseller);


module.exports = router;