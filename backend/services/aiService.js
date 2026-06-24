const axios = require('axios');
const FormData = require('form-data');

/**
 * Toonify (cartoonize) an image using DeepAI Toonify API.
 * DeepAI is accessible from most networks including Alibaba Cloud.
 * @param {string} base64Image - Base64 image string (with or without data URI prefix)
 * @returns {Promise<string>} - Returns base64 image data URI of the toonified image
 */
async function cartoonizeImage(base64Image) {
    const apiKey = process.env.DEEPAI_API_KEY;
    if (!apiKey) {
        throw new Error('DEEPAI_API_KEY belum dikonfigurasi di file .env backend.');
    }

    // Bersihkan data URI prefix jika ada
    let rawBase64 = base64Image;
    let mimeType = 'image/jpeg';
    if (base64Image.includes(';base64,')) {
        const parts = base64Image.split(';base64,');
        mimeType = parts[0].replace('data:', '') || 'image/jpeg';
        rawBase64 = parts[1];
    }

    // Konversi base64 ke Buffer untuk dikirim sebagai file
    const imageBuffer = Buffer.from(rawBase64, 'base64');

    // Buat form-data untuk DeepAI (multipart upload)
    const form = new FormData();
    form.append('image', imageBuffer, {
        filename: 'avatar.jpg',
        contentType: mimeType,
    });

    try {
        console.log('[aiService] Mengirim gambar ke DeepAI Toonify...');
        const response = await axios.post(
            'https://api.deepai.org/api/toonify',
            form,
            {
                headers: {
                    'api-key': apiKey,
                    ...form.getHeaders(),
                },
                timeout: 60000, // 60 detik
            }
        );

        const outputUrl = response.data && response.data.output_url;
        if (!outputUrl) {
            throw new Error('DeepAI tidak mengembalikan URL gambar. Coba lagi nanti.');
        }

        console.log('[aiService] DeepAI berhasil, mengunduh hasil gambar...');

        // Unduh gambar hasil dari URL yang diberikan DeepAI
        const imageResponse = await axios.get(outputUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
        });

        const resultBase64 = Buffer.from(imageResponse.data).toString('base64');
        const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
        return `data:${contentType};base64,${resultBase64}`;

    } catch (error) {
        console.error('[aiService] DeepAI error:', error.message);

        if (error.response) {
            const status = error.response.status;
            if (status === 401) {
                throw new Error('DEEPAI_API_KEY tidak valid. Periksa konfigurasi API key Anda.');
            }
            if (status === 402) {
                throw new Error('Kuota DeepAI habis. Silakan cek akun deepai.org Anda.');
            }
            const errData = error.response.data;
            if (errData && errData.err) {
                throw new Error(`DeepAI error: ${errData.err}`);
            }
        }

        throw error;
    }
}

module.exports = {
    cartoonizeImage,
};
