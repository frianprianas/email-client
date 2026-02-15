const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Template = sequelize.define('Template', {
    userId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    subject: {
        type: DataTypes.STRING,
        defaultValue: ''
    },
    body: {
        type: DataTypes.TEXT,
        defaultValue: ''
    },
    isHtml: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
});

module.exports = Template;
