const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Toonify (cartoonize) an image using Gemini 1.5 Flash (Vision) and Pollinations.ai
 * @param {string} base64Image - Base64 image string (with or without data URI prefix)
 * @param {string} style - 'american' or 'anime'
 * @returns {Promise<string>} - Returns base64 image data URI of the toonified image
 */
async function cartoonizeImage(base64Image, style = 'american') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY belum dikonfigurasi di file .env backend.');
    }

    // Bersihkan data URI prefix jika ada
    let rawBase64 = base64Image;
    let mimeType = 'image/jpeg';
    if (base64Image.includes(';base64,')) {
        const parts = base64Image.split(';base64,');
        mimeType = parts[0].replace('data:', '') || 'image/jpeg';
        rawBase64 = parts[1];
    }

    try {
        console.log('[aiService] Menganalisa gambar dengan Gemini 3.5 Flash...');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

        const prompt = "Describe the person in this image concisely for an image generation prompt. Include gender, hair color, eye color, skin tone, prominent facial features, and clothing. Keep it under 30 words.";
        
        const imagePart = {
            inlineData: {
                data: rawBase64,
                mimeType
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const description = result.response.text().trim();
        console.log('[aiService] Deskripsi Gemini:', description);

        // Buat prompt untuk generator gambar
        let stylePrompt = "in vibrant American cartoon style, 2d, flat colors, thick outlines, expressive, cartoon network style";
        if (style === 'anime') {
            stylePrompt = "in high quality Japanese anime style, studio ghibli, detailed eyes, aesthetic, vibrant colors";
        }

        const fullPrompt = `A portrait of ${description}, ${stylePrompt}, profile picture, centered, good lighting`;
        console.log('[aiService] Mengirim prompt ke Pollinations.ai...');

        // Pollinations.ai adalah layanan gratis tanpa API key
        const encodedPrompt = encodeURIComponent(fullPrompt);
        const seed = Math.floor(Math.random() * 1000000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true&seed=${seed}`;

        const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 60000,
        });

        const resultBase64 = Buffer.from(imageResponse.data).toString('base64');
        const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
        return `data:${contentType};base64,${resultBase64}`;

    } catch (error) {
        console.error('[aiService] Gemini/Pollinations error:', error.message);
        throw new Error('Gagal memproses gambar dengan Gemini AI: ' + error.message);
    }
}

module.exports = {
    cartoonizeImage,
};
