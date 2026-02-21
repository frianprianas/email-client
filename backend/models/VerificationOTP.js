const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VerificationOTP = sequelize.define('VerificationOTP', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    phoneNumber: {
        type: DataTypes.STRING,
        allowNull: false
    },
    otp: {
        type: DataTypes.STRING,
        allowNull: false
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'verification_otps',
    timestamps: true
});

module.exports = VerificationOTP;
