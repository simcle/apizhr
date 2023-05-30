const fingerspot = require('../controllers/fingerspot');
const AttlogModel = require('../models/attlog');
const UserModel = require('../models/users');

const pusher = require('../config/pusher');

exports.webhook = async (req, res) => {
    const body = req.body
    switch (body.type) {
        case 'attlog':
            insertAttlog(body)
            pusher.trigger('webhook', 'attlog', {
                message: body
            })
            break;
        case 'get_userinfo': 
            const userPin = body.data.pin
            const template = body.data.template
            UserModel.findOne({pin: userPin})
            .then(user => {
                user.template = template
                user.save()
            })
            break;
        case 'set_userinfo': 
            console.log(body)
            break;
        case 'delet_userinfo': 
            console.log(body)
            break;
        case 'get_userid_list': 
            console.log(body);
            break;
        case 'set_time': 
            console.log(body)
            break;
        case 'register_online':
            pusher.trigger('webhook', 'register_online', {
                message: body
            })
            fingerspot.getUserInfo(body)
    }
    res.status(200).send()
}


async function insertAttlog (body) {
    const userPin = body.data.pin
    const date = new Date(body.data.scan);
    const scanType = body.data.status_scan
    const start = new Date();
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23,59,59,999)
    if(scanType == 0) {
        const data = await AttlogModel.findOne({$and: [{scanDate: {$gte: start, $lt: end}}, {userPin: userPin}]})
        if(!data) {
            const attlog = new AttlogModel({
                userPin: userPin,
                scanIn: date,
                scanType: scanType,
                scanDate: date,
                information: 'Masuk'
            })
            await attlog.save()
        } else if(data.information !== 'Masuk') {
            data.scanIn = date
            data.scanType = scanType
            data.information = 'Masuk'
            await data.save()
        }
    }
    if(scanType == 1) {
        const data = await AttlogModel.findOne({$and: [{scanDate: {$gte: start, $lt: end}}, {userPin: userPin}]})
        if(data.scanOut == null) {
            data.scanOut = date
            data.scanType = scanType
            await data.save()
        }
    }

}