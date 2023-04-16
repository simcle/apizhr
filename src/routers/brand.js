const express = require('express');
const multer = require('multer');
const uuid = require('uuid');
const router = express.Router();

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/img/temp');
    },
    filename: (req, file, cb) => {
        const ext = file.mimetype.split("/")[1];
        cb(null, `${uuid.v1()}.${ext}`);
    }
});

const upload = multer({storage: fileStorage});
const brandController = require('../controllers/brand');

router.get('/', brandController.getBrands);
router.post('/create', upload.single('logo'), brandController.postBrand);
router.put('/update/:brandId', upload.single('logo'), brandController.putBrand);

module.exports = router;