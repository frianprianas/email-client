require('dotenv').config();
const { sequelize } = require('./config/database');
const { QueryTypes } = require('sequelize');

async function fixAvatarColumn() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Database connected.');

        console.log('Checking avatar column type...');

        // PostgreSQL specific: Alter column type to TEXT
        // In Postgres, TEXT is variable length string of unlimited length.
        await sequelize.query('ALTER TABLE users ALTER COLUMN avatar TYPE TEXT;', {
            type: QueryTypes.RAW
        });

        console.log('Successfully altered users.avatar column to TEXT.');

        process.exit(0);
    } catch (error) {
        console.error('Error fixing avatar column:', error);
        process.exit(1);
    }
}

fixAvatarColumn();
