const express = require('express');
const router = express.Router();

const ngolesController = require('../controllers/ngoles');

router.get('/stat', ngolesController.statNgoles);
router.get('/', ngolesController.getNgoles);
router.get('/detail/:ngolesId', ngolesController.getDetailNgoles);
router.post('/batal/:ngolesId', ngolesController.cancelNgoles);
router.post('/', ngolesController.insertNgoles);
router.put('/qty', ngolesController.updateQty);
router.put('/bayar', ngolesController.bayarNgoles);
router.get('/pedagang', ngolesController.getPedagang);
router.post('/pedagang', ngolesController.insertPedagang);


module.exports = router;