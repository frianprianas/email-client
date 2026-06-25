const axios = require('axios');
const FormData = require('form-data');

const ANIME_API_BASE = 'http://100.90.62.5:8001';
const ANIME_API_KEY = 'RAHASIA_BAKNUSMAIL';

/**
 * Kirim gambar ke Anime API dan dapatkan job_id (tidak menunggu selesai)
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
 * Cek status job - hanya kembalikan status & image_url, TIDAK download gambar
 */
async function getCartoonizeStatus(jobId) {
    const statusRes = await axios.get(`${ANIME_API_BASE}/status/${jobId}`);
    const data = statusRes.data;
    console.log(`[aiService] Status job ${jobId}:`, JSON.stringify(data));

    const status = data.status;

    if (status === 'done' || status === 'completed' || status === 'finished') {
        // Kembalikan path gambar agar bisa di-proxy terpisah
        return {
            status: 'done',
            imagePath: data.image_url || data.output || data.result || null
        };
    }

    if (status === 'failed' || status === 'error') {
        return { status: 'error' };
    }

    // Masih pending/processing
    return { status: status || 'processing' };
}

/**
 * Download gambar dari Anime API dan kembalikan sebagai base64 data URI
 * (dipisahkan agar bisa di-retry mandiri)
 */
async function downloadCartoonizeImage(imagePath) {
    console.log(`[aiService] Mengunduh gambar dari ${ANIME_API_BASE}${imagePath}...`);
    const imageRes = await axios.get(`${ANIME_API_BASE}${imagePath}`, {
        responseType: 'arraybuffer',
        timeout: 30000
    });

    const resultBase64 = Buffer.from(imageRes.data).toString('base64');
    const contentType = imageRes.headers['content-type'] || 'image/jpeg';
    return `data:${contentType};base64,${resultBase64}`;
}

module.exports = {
    submitCartoonize,
    getCartoonizeStatus,
    downloadCartoonizeImage,
};
