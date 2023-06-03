const nodemailer = require('nodemailer');

const sendEmail = async (data) => {
    let transporter = nodemailer.createTransport({
        host: 'mail.zhrleather.com',
        port: 465,
        secure: true, // true for 465, false for other ports
        auth: {
          user: 'admin@zhrleather.com', // generated ethereal user
          pass: '&*]qCsWn*Bou', // generated ethereal password
        },
    });
    transporter.verify(function(error, success) {
      console.log(error, success)
    })
    return await transporter.sendMail(data)
}

module.exports = sendEmail