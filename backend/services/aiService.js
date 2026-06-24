const axios = require('axios');
const https = require('https');

const HF_HOSTNAME = 'api-inference.huggingface.co';

/**
 * Resolve hostname via DNS over HTTPS using IP-based DoH endpoints
 * (no DNS resolution needed for the DoH server itself).
 * Tries Cloudflare (1.1.1.1) then Google (8.8.8.8).
 */
async function resolveViaDoh(hostname) {
    const providers = [
        {
            // Cloudflare DoH via IP - tidak perlu DNS untuk resolve cloudflare
            url: `https://1.1.1.1/dns-query?name=${hostname}&type=A`,
            headers: { Accept: 'application/dns-json' },
        },
        {
            // Google DoH via IP - tidak perlu DNS untuk resolve google
            url: `https://8.8.8.8/resolve?name=${hostname}&type=A`,
            headers: { Accept: 'application/dns-json' },
        },
    ];

    for (const provider of providers) {
        try {
            console.log(`[aiService] Mencoba DoH ke: ${provider.url}`);
            const res = await axios.get(provider.url, {
                headers: provider.headers,
                timeout: 8000,
                // Izinkan self-signed/IP certificate (1.1.1.1 & 8.8.8.8 punya cert valid)
                httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            });
            const answers = res.data && res.data.Answer;
            if (Array.isArray(answers)) {
                const aRecord = answers.find((a) => a.type === 1); // Type 1 = A record
                if (aRecord && aRecord.data) {
                    console.log(`[aiService] DoH berhasil: ${hostname} -> ${aRecord.data}`);
                    return aRecord.data;
                }
            }
        } catch (err) {
            console.warn(`[aiService] DoH ke ${provider.url} gagal:`, err.message);
        }
    }

    console.warn('[aiService] Semua DoH gagal, coba koneksi langsung...');
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

    // Bersihkan string base64
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

    // Resolusi DNS lewat DoH (IP-based, tanpa butuh DNS)
    let requestUrl = `https://${HF_HOSTNAME}/models/${model}`;
    let httpsAgent = undefined;

    const resolvedIp = await resolveViaDoh(HF_HOSTNAME);
    if (resolvedIp) {
        // Sambungkan langsung ke IP, tapi kirim SNI yang benar agar SSL tetap valid
        requestUrl = `https://${resolvedIp}/models/${model}`;
        httpsAgent = new https.Agent({
            servername: HF_HOSTNAME,
        });
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
                    Host: HF_HOSTNAME,
                },
                httpsAgent: httpsAgent,
                responseType: 'arraybuffer',
                timeout: 60000,
            }
        );

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
                // Abaikan error parsing, lempar error asli
            }
        }

        throw error;
    }
}

module.exports = {
    cartoonizeImage,
};
