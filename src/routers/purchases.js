const express = require('express');
const router = express.Router();

const purchaseController = require('../controllers/purchases');

router.get('/', purchaseController.getPurchases);
router.get('/suppliers', purchaseController.getSuppliers)
router.get('/product', purchaseController.getProduct);
router.post('/', purchaseController.insertPurchase);
router.get('/detail/:purchaseId', purchaseController.getPurchaseDetail);
router.put('/insert/:purchaseId', purchaseController.insertItem);
router.put('/delete/:purchaseId', purchaseController.deleteItem);
router.put('/update/:purchaseId', purchaseController.updatePurchase);
router.delete('/delete/:purchaseId', purchaseController.deletePurchase);

module.exports = router;