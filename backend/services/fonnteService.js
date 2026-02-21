const axios = require('axios');

const FONNTE_TOKEN = process.env.FONNTE_TOKEN || 'KQ1XKbd2ZHue4cn9e7hc';

/**
 * Send OTP via Fonnte WhatsApp API
 * @param {string} target - Phone number
 * @param {string} otp - OTP code
 * @returns {Promise<any>}
 */
const sendOTP = async (target, otp) => {
    try {
        // Form data approach as per Fonnte documentation (often uses multipart or urlencoded)
        // But axios handles JSON too if the API supports it. 
        // Example PHP used simple array which usually maps to multipart/form-data or application/x-www-form-urlencoded
        const formData = new URLSearchParams();
        formData.append('target', target);
        formData.append('message', `Kode OTP BaknusMail Anda: ${otp}. Berlaku selama 5 menit.`);
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
