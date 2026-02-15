const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Label = sequelize.define('Label', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    color: {
        type: DataTypes.STRING,
        defaultValue: '#1a73e8'
    }
}, {
    tableName: 'labels',
    timestamps: true
});

module.exports = Label;
