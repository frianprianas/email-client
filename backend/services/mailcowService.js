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

/**
 * Fetch mailbox tags from Mailcow
 * @param {string} email
 * @returns {Promise<string[]>}
 */
const getMailboxTags = async (email) => {
    try {
        const response = await axios.get(`${MAILCOW_API_URL}/api/v1/get/mailbox/${email}`, {
            headers: {
                'X-API-Key': MAILCOW_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        let mailboxData = null;
        if (Array.isArray(response.data)) {
            mailboxData = response.data[0];
        } else if (response.data && typeof response.data === 'object') {
            if (response.data[email]) {
                mailboxData = response.data[email];
            } else if (response.data.username === email || response.data.email === email || response.data.local_part) {
                mailboxData = response.data;
            } else {
                // If it's a dictionary keyed by email
                const keys = Object.keys(response.data);
                if (keys.length > 0) {
                    mailboxData = response.data[keys[0]];
                }
            }
        }

        if (mailboxData && mailboxData.tags) {
            return Array.isArray(mailboxData.tags) ? mailboxData.tags : [mailboxData.tags];
        }
        return [];
    } catch (error) {
        console.error('Mailcow API error in getMailboxTags:', error.response?.data || error.message);
        return [];
    }
};

/**
 * Fetch all mailboxes from Mailcow
 * @returns {Promise<any>}
 */
const getAllMailboxes = async () => {
    try {
        const response = await axios.get(`${MAILCOW_API_URL}/api/v1/get/mailbox/all`, {
            headers: {
                'X-API-Key': MAILCOW_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Mailcow API error in getAllMailboxes:', error.response?.data || error.message);
        throw new Error('Gagal mengambil daftar email dari server Mailcow');
    }
};

/**
 * Update tags of a mailbox in Mailcow
 * @param {string} email
 * @param {string[]} tags
 * @returns {Promise<any>}
 */
const updateMailboxTags = async (email, tags) => {
    try {
        const response = await axios.post(`${MAILCOW_API_URL}/api/v1/edit/mailbox`, {
            attr: {
                tags: tags
            },
            items: [email]
        }, {
            headers: {
                'X-API-Key': MAILCOW_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (Array.isArray(response.data) && response.data[0]?.type === 'error') {
            throw new Error(response.data[0].msg || 'Gagal mengubah tag di server Mailcow');
        }

        return response.data;
    } catch (error) {
        console.error('Mailcow API error in updateMailboxTags:', error.response?.data || error.message);
        throw new Error('Gagal menghubungi server Mailcow untuk pembaruan tag');
    }
};

module.exports = { changePassword, getMailboxTags, getAllMailboxes, updateMailboxTags };
