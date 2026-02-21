const axios = require('axios');

const FONNTE_TOKEN = process.env.FONNTE_TOKEN || 'KQ1XKbd2ZHue4cn9e7hc';

/**
 * Send OTP via Fonnte WhatsApp API
 * @param {string} target - Phone number
 * @param {string} otp - OTP code
 * @param {string} email - User email
 * @param {string} type - Type of OTP (verification or password_change)
 * @returns {Promise<any>}
 */
const sendOTP = async (target, otp, email, type = 'verification') => {
    try {
        let message = '';
        if (type === 'password_change') {
            message = `Hallo pengguna email : ${email} ini kode OTP untuk mengganti password Anda: ${otp}. Berlaku selama 5 menit.`;
        } else {
            message = `Hallo pengguna email : ${email} ini kode OTP untuk menambahkan nomor WhatsApp Anda: ${otp}. Berlaku selama 5 menit.`;
        }

        const formData = new URLSearchParams();
        formData.append('target', target);
        formData.append('message', message);
        formData.append('countryCode', '62');

        const response = await axios.post('https://api.fonnte.com/send', formData, {
            headers: {
                'Authorization': FONNTE_TOKEN,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Fonnte API error:', error.response?.data || error.message);
        throw new Error('Gagal mengirim pesan WhatsApp');
    }
};

module.exports = { sendOTP };
