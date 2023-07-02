const axios = require('axios');
axios.defaults.baseURL = 'https://pro.rajaongkir.com/api/'
axios.defaults.headers.common['key'] = '7df812cc8d843302214c45f8553999c1'
axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded';

exports.cekOngkir = (req, res) => {

}

exports.cekResi = (req, res) => {
    const form = {
        waybill: 'P2306280161261',
        courier: 'pos'
    }
    axios.post('/waybill', form)
    .then(result => {
        console.log(result.data)
    })
}