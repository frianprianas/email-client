const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ScheduledEmail = sequelize.define('ScheduledEmail', {
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    to: {
        type: DataTypes.JSON, // Use JSON to store array of emails
        allowNull: false
    },
    cc: {
        type: DataTypes.JSON,
        allowNull: true
    },
    bcc: {
        type: DataTypes.JSON,
        allowNull: true
    },
    subject: {
        type: DataTypes.STRING,
        defaultValue: ''
    },
    html: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    text: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    attachments: {
        type: DataTypes.JSON, // Store attachment metadata/content (careful with size)
        allowNull: true
    },
    inReplyTo: {
        type: DataTypes.STRING,
        allowNull: true
    },
    references: {
        type: DataTypes.STRING,
        allowNull: true
    },
    scheduledTime: {
        type: DataTypes.DATE,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'sent', 'failed'),
        defaultValue: 'pending'
    },
    errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true
    }
});

module.exports = ScheduledEmail;
