const axios = require('axios');

/**
 * Cartoonize an image using Hugging Face Inference API
 * @param {string} base64Image - Base64 image string (with or without data URI prefix)
 * @param {string} style - 'cartoon' or 'anime'
 * @returns {Promise<string>} - Returns base64 image data URI of the cartoonized image
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

    // Recommended model for Image-to-Image styling
    // We use stabilityai/stable-diffusion-2-1 as it is widely supported in HF Serverless API
    const model = 'stabilityai/stable-diffusion-2-1';
    const url = `https://api-inference.huggingface.co/models/${model}`;

    let prompt = '';
    let negativePrompt = 'ugly, deformed, disfigured, low quality, blurry, mutated, extra limbs';
    
    if (style === 'anime') {
        prompt = 'a beautiful 2D Japanese anime style character portrait, vibrant colors, detailed anime face, anime masterwork, masterpiece';
    } else {
        prompt = 'a 3D Disney Pixar style cartoon character, 3d render, cute animated movie character style, detailed, rich colors';
    }

    try {
        const response = await axios.post(
            url,
            {
                inputs: rawBase64,
                parameters: {
                    prompt: prompt,
                    negative_prompt: negativePrompt,
                    strength: 0.55, // Strength of change (0.0 = no change, 1.0 = completely new image)
                    guidance_scale: 7.5,
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer', // Important to receive binary image back
                timeout: 30000 // 30 seconds timeout
            }
        );

        // Check if the response is actually JSON (which means an error occurred, like model loading)
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
            const errorJson = JSON.parse(Buffer.from(response.data).toString('utf-8'));
            if (errorJson.error && errorJson.error.includes('loading')) {
                const waitTime = Math.round(errorJson.estimated_time || 20);
                throw new Error(`Model AI sedang bersiap (loading). Silakan coba lagi dalam ${waitTime} detik.`);
            }
            throw new Error(errorJson.error || 'Terjadi kesalahan pada AI API');
        }

        // Convert the binary image back to Base64 data URI
        const imageBuffer = Buffer.from(response.data);
        const outputBase64 = imageBuffer.toString('base64');
        
        // Assume output format matches input, default to jpeg
        return `data:image/jpeg;base64,${outputBase64}`;

    } catch (error) {
        console.error('Hugging Face API error:', error.message);
        
        // Handle Axios errors with response data
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
                // If parsing fails, throw original or general error
            }
        }
        
        throw error;
    }
}

module.exports = {
    cartoonizeImage
};
