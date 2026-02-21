const axios = require('axios');

const MAILCOW_API_URL = process.env.MAILCOW_API_URL || 'http://mail.smk.baktinusantara666.sch.id';
const MAILCOW_API_KEY = process.env.MAILCOW_API_KEY || '925B68-0FF6BB-36B760-F6C051-AAF343';

/**
 * Change mailbox password in Mailcow
 * @param {string} email - Mailbox email address
 * @param {string} newPassword - New password
 * @returns {Promise<any>}
 */
const changePassword = async (email, newPassword) => {
    try {
        const response = await axios.post(`${MAILCOW_API_URL}/api/v1/edit/mailbox`, {
            attr: {
                password: newPassword,
                password2: newPassword
            },
            items: [email]
        }, {
            headers: {
                'X-API-Key': MAILCOW_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        // Mailcow API response checking
        if (Array.isArray(response.data) && response.data[0]?.type === 'error') {
            throw new Error(response.data[0].msg || 'Gagal mengubah password di server Mailcow');
        }

        return response.data;
    } catch (error) {
        console.error('Mailcow API error:', error.response?.data || error.message);
        throw new Error('Gagal menghubungi server Mailcow untuk perubahan password');
    }
};

module.exports = { changePassword };
