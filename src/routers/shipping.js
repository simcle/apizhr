const express = require('express');
const multer = require('multer');
const uuid = require('uuid');
const router = express.Router();

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/img/shipping');
    },
    filename: (req, file, cb) => {
        const ext = file.mimetype.split("/")[1];
        cb(null, `${uuid.v1()}.${ext}`);
    }
})

const upload = multer({storage: fileStorage});

const shippingController = require('../controllers/shipping');

router.get('/shipping', shippingController.getShipping);
router.post('/shipping', upload.single('logo'), shippingController.postShipping);
router.post('/services', shippingController.postService);
router.put('/shipping/:shippingId', upload.single('logo'), shippingController.putShipping)
router.put('/shipping/service/:shippingId', shippingController.putShippingService);
router.get('/method', shippingController.shippingMethod);


module.exports = router;