const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    displayName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    avatar: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    imapPassword: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    signature: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    theme: {
        type: DataTypes.STRING,
        defaultValue: 'dark'
    },
    lastLogin: {
        type: DataTypes.DATE,
        allowNull: true
    },
    phoneNumber: {
        type: DataTypes.STRING,
        allowNull: true
    },
    isPhoneVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    lastPasswordChange: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'users',
    timestamps: true
});

module.exports = User;
