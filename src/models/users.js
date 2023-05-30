const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    name: {type: String, required: true},
    email: {type: String, required: true, unique: true},
    phone: {type: String, default: null},
    password: {type: String},
    isAdmin: {type: Boolean, default: false},
    isAuth: {type: Boolean, default: false},
    isActive: {type: Boolean, default: true},
    personalData: {
        nik: {type: String},
        tempatLahir: {type: String},
        tanggalLahir: {type: Date},
        jenisKelamin: {type: String},
        statusPerkawinan: {type: String},
        golonganDarah: {type: String},
        agama: {type: String},
        alamat: {type: String}
    },
    employmentData: {
        shopId: {type: Schema.Types.ObjectId},
        posisiPekerjaan: {type: String},
        employeeId: {type: String},
        barcode: {type: String},
        statusPekerjaan: {type: String},
        tanggalBergabung: {type: Date},
        tanggalKeluar: {type: Date},
    },
    payroll: {
        gajiPokok: {type: Number}
    },
    role: {type: String},
    avatar: {type: String, default: null},
    refreshToken: {type: String, default: null},
    pin: {type: Number, unique: true},
    template: {type: String}
    
}, {
    timestamps: true
});

module.exports = mongoose.model('User', UserSchema);