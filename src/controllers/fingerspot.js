const axios = require('axios');
const token = 'JZNFMT26IQGI8PDU'
const cloud_id = 'C2622D141F382027'
axios.defaults.baseURL = 'https://developer.fingerspot.io/api/'
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

exports.setUserInfo = (body) => {
    const data = {
        trans_id: body.pin,
        cloud_id: cloud_id,
        data: {
            pin: body.pin,
            name: body.name,
            privilege: 1,
            password: '',
            template: body.template
        }
    }
    return axios.post('/set_userinfo', data)
}

exports.getUserInfo = (body) => {
    const data = {
        trans_id: body.trans_id,
        cloud_id: cloud_id,
        pin: body.trans_id
    }
    return axios.post('/get_userinfo', data)
}

exports.registerOnline = (body) => {
    const data = {
        trans_id: body.pin,
        cloud_id: cloud_id,
        pin: body.pin,
        verification: 0
    }
    return axios.post('reg_online', data)
}