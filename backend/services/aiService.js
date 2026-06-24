const axios = require('axios');
const https = require('https');

const HF_HOSTNAME = 'api-inference.huggingface.co';

// Agent yang mengizinkan koneksi ke IP langsung (1.1.1.1, 8.8.8.8)
const dohAgent = new https.Agent({ rejectUnauthorized: false });

const DOH_BASES = [
    'https://1.1.1.1/dns-query',
    'https://8.8.8.8/resolve',
];

/**
 * Query DNS over HTTPS untuk tipe record tertentu.
 * @param {string} base - DoH base URL
 * @param {string} name - Hostname yang dicari
 * @param {string} type - Tipe record: 'A' atau 'CNAME'
 * @returns {Promise<Array>} - Array DNS answer records
 */
async function queryDoh(base, name, type) {
    const res = await axios.get(`${base}?name=${name}&type=${type}`, {
        headers: { Accept: 'application/dns-json' },
        timeout: 8000,
        httpsAgent: dohAgent,
    });
    return (res.data && Array.isArray(res.data.Answer)) ? res.data.Answer : [];
}

/**
 * Resolve hostname ke IP menggunakan DNS over HTTPS.
 * Mendukung CNAME chaining agar tidak perlu A record langsung.
 * @param {string} hostname
 * @returns {Promise<string|null>} - IP address atau null
 */
async function resolveViaDoh(hostname) {
    for (const base of DOH_BASES) {
        try {
            console.log(`[aiService] DoH query A record: ${hostname} via ${base}`);

            // 1. Coba A record langsung
            let answers = await queryDoh(base, hostname, 'A');

            // 2. Jika tidak ada A record, cari CNAME lalu resolve target-nya
            const hasARecord = answers.some((a) => a.type === 1);
            if (!hasARecord) {
                console.log(`[aiService] Tidak ada A record langsung, cek CNAME...`);
                const cnameAnswers = await queryDoh(base, hostname, 'CNAME');
                const cnameRecord = cnameAnswers.find((a) => a.type === 5); // type 5 = CNAME

                if (cnameRecord) {
                    // Hapus trailing dot dari nama CNAME
                    const cnameTarget = cnameRecord.data.replace(/\.$/, '');
                    console.log(`[aiService] CNAME ditemukan: ${hostname} -> ${cnameTarget}`);

                    // Resolve A record dari target CNAME
                    answers = await queryDoh(base, cnameTarget, 'A');
                }
            }

            // 3. Ambil IP dari A record yang ditemukan
            const aRecord = answers.find((a) => a.type === 1);
            if (aRecord && aRecord.data) {
                console.log(`[aiService] DoH berhasil: ${hostname} -> ${aRecord.data}`);
                return aRecord.data;
            }

            console.warn(`[aiService] Tidak ada IP ditemukan dari ${base}`);
        } catch (err) {
            console.warn(`[aiService] DoH gagal (${base}):`, err.message);
        }
    }

    console.warn('[aiService] Semua DoH gagal.');
    return null;
}

/**
 * Cartoonize an image using Hugging Face Inference API.
 * @param {string} base64Image - Base64 image string (with or without data URI prefix)
 * @param {string} style - 'cartoon' atau 'anime'
 * @returns {Promise<string>} - Base64 data URI gambar hasil cartoonize
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

    // Resolusi DNS via DoH - bypass blokir DNS Alibaba Cloud + handle CNAME chain
    let requestUrl = `https://${HF_HOSTNAME}/models/${model}`;
    let httpsAgent = undefined;

    const resolvedIp = await resolveViaDoh(HF_HOSTNAME);
    if (resolvedIp) {
        // Koneksi langsung ke IP dengan SNI yang benar agar SSL tetap valid
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
