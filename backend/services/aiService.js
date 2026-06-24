const axios = require('axios');
const https = require('https');

const HF_HOSTNAME = 'api-inference.huggingface.co';

/**
 * Resolve a hostname to an IP address using Cloudflare DNS over HTTPS.
 * This bypasses standard DNS (UDP port 53) which may be blocked by Alibaba Cloud.
 * @param {string} hostname
 * @returns {Promise<string|null>} Resolved IP address or null if failed
 */
async function resolveViaDoh(hostname) {
    try {
        const res = await axios.get(
            `https://cloudflare-dns.com/dns-query?name=${hostname}&type=A`,
            {
                headers: { Accept: 'application/dns-json' },
                timeout: 8000,
            }
        );
        const answers = res.data && res.data.Answer;
        if (Array.isArray(answers)) {
            // Type 1 = A record (IPv4)
            const aRecord = answers.find((a) => a.type === 1);
            if (aRecord) return aRecord.data;
        }
    } catch (err) {
        console.warn('[aiService] DoH resolve failed, akan coba langsung:', err.message);
    }
    return null;
}

/**
 * Cartoonize an image using Hugging Face Inference API.
 * @param {string} base64Image - Base64 image string (with or without data URI prefix)
 * @param {string} style - 'cartoon' or 'anime'
 * @returns {Promise<string>} Returns base64 image data URI of the cartoonized image
 */
async function cartoonizeImage(base64Image, style) {
    const token = process.env.HF_ACCESS_TOKEN;
    if (!token) {
        throw new Error('HF_ACCESS_TOKEN belum dikonfigurasi di file .env backend.');
    }

    // Clean base64 string
    let rawBase64 = base64Image;
    if (base64Image.includes(';base64,')) {
        rawBase64 = base64Image.split(';base64,')[1];
    }

    const model = 'stabilityai/stable-diffusion-2-1';

    let prompt = '';
    const negativePrompt = 'ugly, deformed, disfigured, low quality, blurry, mutated, extra limbs';

    if (style === 'anime') {
        prompt = 'a beautiful 2D Japanese anime style character portrait, vibrant colors, detailed anime face, anime masterwork, masterpiece';
    } else {
        prompt = 'a 3D Disney Pixar style cartoon character, 3d render, cute animated movie character style, detailed, rich colors';
    }

    // --- Resolusi DNS via DoH untuk bypass blokir DNS Alibaba Cloud ---
    let requestUrl = `https://${HF_HOSTNAME}/models/${model}`;
    let httpsAgent = undefined;

    const resolvedIp = await resolveViaDoh(HF_HOSTNAME);
    if (resolvedIp) {
        console.log(`[aiService] DNS DoH berhasil: ${HF_HOSTNAME} -> ${resolvedIp}`);
        // Ganti hostname dengan IP langsung, tapi tetap kirim SNI yang benar agar SSL valid
        requestUrl = `https://${resolvedIp}/models/${model}`;
        httpsAgent = new https.Agent({
            servername: HF_HOSTNAME, // SNI: beritahu server SSL siapa kita
        });
    } else {
        console.warn('[aiService] DoH gagal, mencoba koneksi langsung (mungkin DNS normal bekerja).');
    }

    try {
        const response = await axios.post(
            requestUrl,
            {
                inputs: rawBase64,
                parameters: {
                    prompt: prompt,
                    negative_prompt: negativePrompt,
                    strength: 0.55,
                    guidance_scale: 7.5,
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    // Pastikan header Host dikirim dengan benar saat menggunakan IP langsung
                    Host: HF_HOSTNAME,
                },
                httpsAgent: httpsAgent,
                responseType: 'arraybuffer',
                timeout: 60000, // 60 detik
            }
        );

        // Jika response berupa JSON, berarti ada error dari API
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
            const errorJson = JSON.parse(Buffer.from(response.data).toString('utf-8'));
            if (errorJson.error && errorJson.error.includes('loading')) {
                const waitTime = Math.round(errorJson.estimated_time || 20);
                throw new Error(`Model AI sedang bersiap (loading). Silakan coba lagi dalam ${waitTime} detik.`);
            }
            throw new Error(errorJson.error || 'Terjadi kesalahan pada AI API');
        }

        const imageBuffer = Buffer.from(response.data);
        const outputBase64 = imageBuffer.toString('base64');
        return `data:image/jpeg;base64,${outputBase64}`;

    } catch (error) {
        console.error('[aiService] Hugging Face API error:', error.message);

        if (error.response && error.response.data) {
            try {
                const errorJson = JSON.parse(Buffer.from(error.response.data).toString('utf-8'));
                if (errorJson.error) {
                    if (errorJson.error.includes('loading')) {
                        const waitTime = Math.round(errorJson.estimated_time || 20);
                        throw new Error(`Model AI sedang bersiap (loading). Silakan coba lagi dalam ${waitTime} detik.`);
                    }
                    throw new Error(errorJson.error);
                }
            } catch (jsonErr) {
                // Abaikan error parsing JSON, lempar error asli
            }
        }

        throw error;
    }
}

module.exports = {
    cartoonizeImage,
};
