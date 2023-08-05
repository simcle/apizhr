const axios = require('axios');
const baseURL = 'https://api.biteship.com';
const apiKey = 'biteship_live.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiWkhSIiwidXNlcklkIjoiNjRjYzU2ZDY2NWI3MWMyM2Y3Y2RkZjkwIiwiaWF0IjoxNjkxMTMyMTQ2fQ.xSNcIQK-dWLutPSPmQUmX8NNci8NJqqfvY-LtnCnmZg';

exports.getMaps = (req, res) => {
    const input = req.query.search
    
    axios.get(baseURL+'/v1/maps/areas', {
        params: {
            countries: 'ID',
            input: input,
            type: 'single'
        },
        headers: {
            'Authorization': apiKey
        }
    })
    .then(result => {
        res.status(200).json(result.data)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

exports.postRates = (req, res) => {
    const form = req.body
    axios.post(baseURL+'/v1/rates/couriers', form, {
        headers: {
            'Authorization': apiKey
        }
    })
    .then(result => {
        res.status(200).json(result.data)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

exports.getTracking = (req, res) => {
    const waybill_id = req.body.resi
    let courier_code;
    switch (req.body.shippingName) {
        case 'J&T': 
            courier_code = 'jnt'
            break;
        case 'SICEPAT': 
            courier_code = 'sicepat'
            break;
        case 'JNE': 
            courier_code = 'jne'
            break;
        case 'ANTERAJA':
            courier_code = 'anteraja'
            break
        case 'POS': 
            courier_code = 'pos'
            break
    }
    axios.get(baseURL+'/v1/trackings/'+waybill_id+'/couriers/'+courier_code, {
        headers: {
            'Authorization': apiKey
        }
    })
    .then(result => {
        res.status(200).json(result.data)
    })
    .catch(err => {
        res.status(400).send(err)
    })
}