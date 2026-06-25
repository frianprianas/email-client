const axios = require('axios');
const FormData = require('form-data');

/**
 * Toonify (cartoonize) an image using internal Anime API
 * @param {string} base64Image - Base64 image string (with or without data URI prefix)
 * @param {string} userId - User ID
 * @returns {Promise<string>} - Returns base64 image data URI of the toonified image
 */
async function cartoonizeImage(base64Image, userId) {
    // 1. Bersihkan data URI prefix jika ada dan convert ke buffer
    let rawBase64 = base64Image;
    if (base64Image.includes(';base64,')) {
        rawBase64 = base64Image.split(';base64,')[1];
    }
    const buffer = Buffer.from(rawBase64, 'base64');

    try {
        console.log('[aiService] Mengirim gambar ke server Anime API internal...');
        
        // 2. Siapkan FormData
        const form = new FormData();
        form.append('file', buffer, { filename: 'avatar.jpg', contentType: 'image/jpeg' });

        // 3. POST ke /generate
        const generateRes = await axios.post('http://100.90.62.5:8001/generate', form, {
            headers: {
                ...form.getHeaders(),
                'X-API-Key': 'RAHASIA_BAKNUSMAIL',
                'X-User-ID': userId
            }
        });

        const jobId = generateRes.data.job_id;
        if (!jobId) {
            throw new Error('Tidak mendapatkan job_id dari server');
        }

        console.log(`[aiService] Job ID diterima: ${jobId}. Memulai polling status...`);

        // 4. Polling status
        let status = 'pending';
        let imageUrl = '';
        
        while (status !== 'done') {
            await new Promise(resolve => setTimeout(resolve, 5000)); // tunggu 5 detik
            
            try {
                const statusRes = await axios.get(`http://100.90.62.5:8001/status/${jobId}`);
                status = statusRes.data.status;
                
                if (status === 'done') {
                    imageUrl = statusRes.data.image_url;
                    break;
                } else if (status === 'failed' || status === 'error') {
                    throw new Error(`Status dari server: ${status}`);
                }
            } catch (pollErr) {
                // Abaikan error 429 (Too Many Requests) akibat polling dan coba lagi di iterasi berikutnya
                if (pollErr.response && pollErr.response.status === 429) {
                    console.warn(`[aiService] Polling terlalu cepat (429 Too Many Requests), mencoba lagi...`);
                } else {
                    throw pollErr; // Jika error lain, lempar ke catch utama
                }
            }
        }

        console.log(`[aiService] Animasi selesai. Mengunduh hasil dari ${imageUrl}...`);

        // 5. Unduh hasil gambar
        const imageRes = await axios.get(`http://100.90.62.5:8001${imageUrl}`, {
            responseType: 'arraybuffer'
        });

        const resultBase64 = Buffer.from(imageRes.data).toString('base64');
        const contentType = imageRes.headers['content-type'] || 'image/jpeg';
        
        return `data:${contentType};base64,${resultBase64}`;

    } catch (error) {
        console.error('[aiService] Anime API error:', error.message);
        throw new Error('Gagal memproses gambar dengan Anime API: ' + error.message);
    }
}

module.exports = {
    cartoonizeImage,
};
