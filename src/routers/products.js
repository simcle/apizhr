const express = require('express');
const router = express.Router();
const multer = require('multer');

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        if(file.fieldname === 'images') {
            cb(null, 'public/img/temp');
        }
        if(file.fieldname == 'imageVarians') {
            cb(null, 'public/img/products/varians')
        }
    },
    filename: (req, file, cb) => {
        const time = new Date().getTime()
        const ext = file.mimetype.split("/")[1];
        if(file.fieldname === 'images') {
            cb(null, `${time}.${ext}`);
        }
        if(file.fieldname === 'imageVarians') {
            cb(null, `${time}.${ext}`);
        }
    }
});

const updateFileStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
        if(file.fieldname === 'images') {
            cb(null, 'public/img/temp');
        }
        if(file.fieldname == 'imageVarians') {
            cb(null, 'public/img/products/varians')
        }
    },
    filename: (req, file, cb) => {
        const time = new Date().getTime()
        const ext = file.mimetype.split("/")[1];
        if(file.fieldname === 'images') {
            cb(null, file.originalname)
        }
        if(file.fieldname == 'imageVarians') {
            cb(null, `${time}.${ext}`);
        }
    }
})

const upload = multer({storage: fileStorage});
const uploadUpdate = multer({storage: updateFileStorage});
const productController = require('../controllers/products');

router.get('/', productController.getAllProducts);
router.get('/filter', productController.getFilter);
router.get('/detail/:productId', productController.getDetail)
router.get('/create', productController.createProduct)
router.post('/create', upload.fields([{name: 'images'}, {name: 'imageVarians'}]), productController.postProduct)
router.get('/edit/:productId', productController.editProduct);
router.put('/update/:productId', uploadUpdate.fields([{name: 'images'}, {name: 'imageVarians'}]), productController.updateProduct);
router.put('/is-active/:productId', productController.putIsActive);
router.get('/sku', productController.getProductBySku);
router.get('/barcode', productController.printBarcode);


module.exports = router;