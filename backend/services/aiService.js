const axios = require('axios');
const FormData = require('form-data');

const ANIME_API_BASE = 'http://100.90.62.5:8001';
const ANIME_API_KEY = 'RAHASIA_BAKNUSMAIL';
const VALIDATION_API_BASE = 'http://100.90.62.5:8002';

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

/**
 * Kirim gambar ke Validation API
 */
async function submitValidation(base64Image, userId) {
    let rawBase64 = base64Image;
    if (base64Image.includes(';base64,')) {
        rawBase64 = base64Image.split(';base64,')[1];
    }
    const buffer = Buffer.from(rawBase64, 'base64');

    const form = new FormData();
    form.append('user_id', userId);
    form.append('photo', buffer, { filename: 'validation.jpg', contentType: 'image/jpeg' });

    console.log('[aiService] Mengirim gambar ke Validation API internal...');
    const res = await axios.post(`${VALIDATION_API_BASE}/validate-photo`, form, {
        headers: {
            ...form.getHeaders()
        }
    });

    return res.data;
}

/**
 * Cek status job dari Validation API
 */
async function getValidationStatus(jobId) {
    const res = await axios.get(`${VALIDATION_API_BASE}/validate-photo/${jobId}`);
    return res.data;
}

/**
 * Validasi foto profil menggunakan AI Online (Gemini 2.5 Flash via Aivene API)
 */
async function validatePhotoOnline(base64Image) {
    const apiKey = process.env.API_ONLINE || process.env.AIVENE_API_KEY;
    if (!apiKey) {
        throw new Error('API Key Online (API_ONLINE) belum dikonfigurasi di server.');
    }

    let dataUri = base64Image;
    if (!dataUri.startsWith('data:')) {
        dataUri = `data:image/jpeg;base64,${base64Image}`;
    }

    const promptText = `Analisis foto ini untuk foto profil pengguna. Pastikan foto memenuhi 4 kriteria utama berikut:
1. Foto harus memperlihatkan 1 orang manusia (sendiri).
2. Orang dalam foto TIDAK sedang MEROKOK.
3. TIDAK ADA unsur pornografi, keseksian berlebihan, atau konten vulgar (NSFW).
4. TIDAK MENGACUNGKAN JARI TENGAH atau gestur tangan/simbol yang kasar dan tidak sopan.

Kembalikan balasan HANYA dalam bentuk JSON murni tanpa format markdown tambahan (tanpa \`\`\`json) dengan format:
{"approved": true, "reason": "Foto profil memenuhi syarat."}
atau jika menolak:
{"approved": false, "reason": "Jelaskan alasan penolakan secara mendetail (misal: Terdeteksi lebih dari 1 orang / Terdeteksi merokok / Terdeteksi gestur jari tengah)"}`;

    console.log('[aiService] Mengirim gambar ke AI Online (Gemini 2.5 Flash)...');
    
    try {
        const response = await axios.post(
            'https://api.aivene.com/v1/chat/completions',
            {
                model: 'gemini-2.5-flash',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: promptText },
                            {
                                type: 'image_url',
                                image_url: { url: dataUri }
                            }
                        ]
                    }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                timeout: 45000
            }
        );

        const replyContent = response.data?.choices?.[0]?.message?.content || '';
        let cleanJsonString = replyContent.trim();
        if (cleanJsonString.startsWith('```')) {
            cleanJsonString = cleanJsonString.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        }

        let parsedResult;
        try {
            parsedResult = JSON.parse(cleanJsonString);
        } catch (e) {
            console.error('[aiService] Gagal parse JSON AI Online:', replyContent);
            const lower = replyContent.toLowerCase();
            if (lower.includes('"approved": true') || lower.includes('"approved":true')) {
                parsedResult = { approved: true, reason: 'Foto profil disetujui.' };
            } else {
                parsedResult = { approved: false, reason: replyContent || 'Foto tidak memenuhi ketentuan.' };
            }
        }

        return {
            status: 'done',
            result: parsedResult
        };
    } catch (error) {
        console.error('[aiService] Error validasi AI Online:', error.response?.data || error.message);
        throw new Error(error.response?.data?.error?.message || error.message || 'Gagal memproses validasi dengan AI Online.');
    }
}

/**
 * Anime/Cartoonize foto profil menggunakan AI Online (Gemini 2.5 Flash Image via Aivene API)
 * Alur:
 * 1. Gunakan gemini-2.5-flash untuk mendeskripsikan foto profil user (karena model ini mendukung analisis gambar).
 * 2. Ambil deskripsi tersebut, gabungkan dengan gaya yang diinginkan (Jepang / Amerika).
 * 3. Kirim prompt teks tersebut ke gemini-2.5-flash-image untuk menghasilkan gambar baru (karena model ini hanya mendukung input teks).
 */
async function cartoonizeOnline(base64Image, style = 'japanese') {
    const apiKey = process.env.API_BANANA || process.env.API_ONLINE;
    if (!apiKey) {
        throw new Error('API Key Banana (API_BANANA) atau Online (API_ONLINE) belum dikonfigurasi di server.');
    }

    let dataUri = base64Image;
    if (!dataUri.startsWith('data:')) {
        dataUri = `data:image/jpeg;base64,${base64Image}`;
    }

    console.log('[aiService] Langkah 1: Menganalisis wajah foto menggunakan Gemini 2.5 Flash...');
    
    let description = 'an Asian man with short hair';
    try {
        const analyzeRes = await axios.post(
            'https://api.aivene.com/v1/chat/completions',
            {
                model: 'gemini-2.5-flash',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { 
                                type: 'text', 
                                text: 'Describe the person in this profile photo for an image generation prompt. Include gender, approximate age, hairstyle/haircut and color, facial shape, facial features (eyes, eyebrows, nose), clothing type and color, expression (smiling, neutral, etc.), and background. Keep the description concise but highly specific, about 1-2 sentences. Avoid quality buzzwords.' 
                            },
                            {
                                type: 'image_url',
                                image_url: { url: dataUri }
                            }
                        ]
                    }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                timeout: 30000
            }
        );

        const analyzeContent = analyzeRes.data?.choices?.[0]?.message?.content || '';
        if (analyzeContent) {
            description = analyzeContent.trim();
            console.log('[aiService] Deskripsi foto berhasil didapatkan:', description);
        }
    } catch (err) {
        console.warn('[aiService] Gagal menganalisis foto, menggunakan deskripsi fallback:', err.message);
    }

    // Gabungkan dengan prompt gaya animasi
    const stylePrompt = style === 'american'
        ? `American animation style, Pixar or Disney 3D cartoon character, close-up portrait of ${description}. Friendly expression, detailed animation textures, soft lighting.`
        : `Japanese anime drawing style, modern anime/manga key visual, close-up portrait of ${description}. Clean lines, vibrant anime colors, highly detailed.`;

    console.log(`[aiService] Langkah 2: Mengirim prompt ke Gemini 2.5 Flash Image untuk menggambar gaya ${style}...`);

    try {
        const response = await axios.post(
            'https://api.aivene.com/v1/chat/completions',
            {
                model: 'gemini-2.5-flash-image',
                messages: [
                    {
                        role: 'user',
                        content: stylePrompt
                    }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                timeout: 60000
            }
        );

        const message = response.data?.choices?.[0]?.message;
        const replyContent = message?.content || '';
        console.log('[aiService] Respons AI Online Cartoonize (text content):', replyContent);

        let finalImageUri = '';

        // Case 1: Cek array images kustom yang dikembalikan oleh proxy Aivene
        if (message?.images && message.images.length > 0) {
            const imgObj = message.images[0];
            const urlVal = imgObj.image_url?.url || imgObj.url;
            if (urlVal && urlVal.startsWith('data:image')) {
                console.log('[aiService] Berhasil mendapatkan base64 data URI langsung dari message.images[0]');
                return urlVal;
            } else if (urlVal && urlVal.startsWith('http')) {
                finalImageUri = urlVal;
            }
        }

        // Case 2: Cari URL HTTP di dalam content teks sebagai fallback
        if (!finalImageUri) {
            const urlRegex = /(https?:\/\/[^\s\)\"\'\>]+)/i;
            const match = replyContent.match(urlRegex);
            if (match) {
                finalImageUri = match[1];
            }
        }

        if (!finalImageUri) {
            console.error('[aiService] Gagal memparsing gambar dari respons:', JSON.stringify(response.data));
            throw new Error('Gagal mendapatkan URL gambar hasil animasi dari respons AI.');
        }

        console.log('[aiService] Mengunduh gambar hasil animasi dari:', finalImageUri);

        // Download gambar tersebut dan ubah menjadi base64 data URI
        const imageRes = await axios.get(finalImageUri, {
            responseType: 'arraybuffer',
            timeout: 30000
        });

        const resultBase64 = Buffer.from(imageRes.data).toString('base64');
        const contentType = imageRes.headers['content-type'] || 'image/jpeg';
        return `data:${contentType};base64,${resultBase64}`;
    } catch (error) {
        console.error('[aiService] Error cartoonize AI Online:', error.response?.data || error.message);
        throw new Error(error.response?.data?.error?.message || error.message || 'Gagal memproses animasi dengan AI Online.');
    }
}


module.exports = {
    submitCartoonize,
    getCartoonizeStatus,
    downloadCartoonizeImage,
    submitValidation,
    getValidationStatus,
    validatePhotoOnline,
    cartoonizeOnline,
};


