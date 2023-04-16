const path = require('path');
const fs = require('fs');

const Shipping = require('../models/shipping');

// get all shipping data
exports.getShipping = (req, res) => {
    Shipping.find().sort({createdAt: -1})
    .then(result => {
        res.status(200).json(result);
    })
    .catch(err => {
        res.status(400).send(err);
    })
}

// create or add new shipping
exports.postShipping = (req, res) => {
    const shipping = new Shipping({
        name: req.body.name,
        services: JSON.parse(req.body.services),
        logo: req.file.path,
        status: req.body.status
    })
    shipping.save()
    .then(() => {
        Shipping.find().sort({createdAt: -1})
        .then(result => {
            res.status(201).json(result);
        })
    })
    .catch(err => {
        res.status(400).send(err);
    })
}

// update shipping
exports.putShipping = (req, res) => {
    Shipping.findById(req.params.shippingId)
    .then(shipping => {
        shipping.name = req.body.name;
        shipping.services = JSON.parse(req.body.services);
        shipping.status = req.body.status;
        if(req.file) {
            removeImage(shipping.logo)
            shipping.logo = req.file.path;
        }
        return shipping.save();
    })
    .then((result) => {
        res.status(200).json(result)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

// update shipping status & service status
exports.putShippingService = (req, res) => {
    Shipping.findById(req.params.shippingId)
    .then(shipping => {
        shipping.services = req.body.services;
        shipping.status = req.body.status;
        return shipping.save()
    })
    .then(() => {
        res.status(200).send('OK');
    })
    .catch(err => {
        res.status(400).send(err);
    })
}

// add service
exports.postService = (req, res) => {
    const shippingId = req.body.id ;
    const services = req.body.services;
    Shipping.findById(shippingId)
    .then(ship => {
        const service = ship.services
        const arr = service.find(obj => obj.name.toLowerCase() == services.name.toLowerCase())
        if(arr) {
            res.status(400).send('service name is already exists')
        } else {
            ship.services.push(services)
            return ship.save()
        }
    })
    .then(result => {
        res.status(200).json(result)
    })
    .catch(err => {
        console.log(err);
        res.status(400).send(err);
    });
}

exports.shippingMethod = async (req, res) => {
    const result = await Shipping.find({status: true})
    .sort({name: 1})
    .lean()
    let data = result.map(obj => {
        obj.id = obj._id ,
        obj.text = obj.name
        return obj
    })
    res.status(200).json(data)
}
// remove image
const removeImage = (filePath) => {
    filePath = path.join(__dirname, '../..', filePath);
    fs.unlink(filePath, err => {
       if(err) return;
    })
}