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
const marketplaceController = require('../controllers/marketplace');

router.get('/marketplaces', marketplaceController.getMarketplace);
router.post('/marketplaces', upload.single('logo'), marketplaceController.postMarketplace);
router.put('/marketplaces', upload.single('logo'), marketplaceController.putMarketplace);
router.put('/marketplaces/:marketId', marketplaceController.putStatus);

module.exports = router;
