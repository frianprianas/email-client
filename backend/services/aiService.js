const axios = require('axios');
const FormData = require('form-data');

const ANIME_API_BASE = 'http://100.90.62.5:8001';
const ANIME_API_KEY = 'RAHASIA_BAKNUSMAIL';

/**
 * Kirim gambar ke Anime API dan dapatkan job_id (tidak menunggu selesai)
 * @param {string} base64Image - Base64 image string
 * @param {string} userId - User ID
 * @returns {Promise<string>} - job_id
 */
async function submitCartoonize(base64Image, userId) {
    let rawBase64 = base64Image;
    if (base64Image.includes(';base64,')) {
        rawBase64 = base64Image.split(';base64,')[1];
    }
    const buffer = Buffer.from(rawBase64, 'base64');

    const form = new FormData();
    form.append('file', buffer, { filename: 'avatar.jpg', contentType: 'image/jpeg' });

    console.log('[aiService] Mengirim gambar ke Anime API internal...');
    const generateRes = await axios.post(`${ANIME_API_BASE}/generate`, form, {
        headers: {
            ...form.getHeaders(),
            'X-API-Key': ANIME_API_KEY,
            'X-User-ID': userId
        }
    });

    const jobId = generateRes.data.job_id;
    if (!jobId) {
        throw new Error('Tidak mendapatkan job_id dari server Anime API');
    }

    console.log(`[aiService] Job berhasil dikirim. Job ID: ${jobId}`);
    return jobId;
}

/**
 * Cek status job dan kembalikan gambar jika sudah selesai
 * @param {string} jobId
 * @returns {Promise<{status: string, imageDataUri?: string}>}
 */
async function getCartoonizeStatus(jobId) {
    const statusRes = await axios.get(`${ANIME_API_BASE}/status/${jobId}`);
    const status = statusRes.data.status;

    if (status === 'done') {
        const imageUrl = statusRes.data.image_url;
        console.log(`[aiService] Job ${jobId} selesai! Mengunduh gambar dari ${imageUrl}...`);

        const imageRes = await axios.get(`${ANIME_API_BASE}${imageUrl}`, {
            responseType: 'arraybuffer'
        });

        const resultBase64 = Buffer.from(imageRes.data).toString('base64');
        const contentType = imageRes.headers['content-type'] || 'image/jpeg';
        return {
            status: 'done',
            imageDataUri: `data:${contentType};base64,${resultBase64}`
        };
    }

    return { status };
}

module.exports = {
    submitCartoonize,
    getCartoonizeStatus,
};
