const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SnoozedEmail = sequelize.define('SnoozedEmail', {
    userId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    messageUid: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    originalFolder: {
        type: DataTypes.STRING,
        defaultValue: 'INBOX'
    },
    snoozeUntil: {
        type: DataTypes.DATE,
        allowNull: false
    },
    processed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
});

module.exports = SnoozedEmail;
