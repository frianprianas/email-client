import { useState, useRef, useCallback, useEffect } from 'react';
import api from '../api';

export const usePhotoValidation = () => {
    const [isValidating, setIsValidating] = useState(false);
    const [validationError, setValidationError] = useState('');
    const [validationSuccess, setValidationSuccess] = useState('');
    const pollIntervalRef = useRef(null);
    const pollCountRef = useRef(0);

    const validatePhoto = useCallback(async (file, userId, mode = 'local') => {
        setIsValidating(true);
        setValidationError('');
        setValidationSuccess('');
        pollCountRef.current = 0;

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = async () => {
                try {
                    const base64Photo = reader.result;
                    
                    console.log(`[usePhotoValidation] Mengirim foto ke proxy backend (mode: ${mode})...`);

                    // Step 1: Upload Foto via Backend Proxy
                    const response = await api.post(`/auth/avatar/validate`, {
                        photo: base64Photo,
                        mode: mode
                    });

                    // Jika mode online atau server langsung mengembalikan status 'done'
                    if (response.data && response.data.status === 'done') {
                        setIsValidating(false);
                        let parsedResult = typeof response.data.result === 'string'
                            ? JSON.parse(response.data.result)
                            : response.data.result;

                        if (parsedResult && parsedResult.approved === true) {
                            setValidationSuccess('Foto berhasil diverifikasi (BaknusAI Online).');
                            resolve({ success: true, result: parsedResult });
                        } else {
                            const reason = parsedResult?.reason || 'Foto tidak memenuhi ketentuan. Silakan gunakan foto lain.';
                            setValidationError(reason);
                            resolve({ success: false, reason });
                        }
                        return;
                    }

                    // Periksa jika server mengembalikan success: false untuk polling lokal
                    if (!response.data || (!response.data.success && !response.data.job_id)) {
                        throw new Error('Gagal mengirim foto untuk validasi.');
                    }

                    const jobId = response.data.job_id;

                // Step 2 & 3: Polling Status
                const poll = async () => {
                    try {
                        pollCountRef.current += 1;
                        // Timeout setelah 60 iterasi (5 menit)
                        if (pollCountRef.current > 60) {
                            setIsValidating(false);
                            setValidationError('Server validasi tidak merespons dalam 5 menit. Silakan coba lagi.');
                            reject(new Error('timeout'));
                            return;
                        }

                        const statusRes = await api.get(`/auth/avatar/validate/status/${jobId}`);
                        const statusData = statusRes.data;

                        if (statusData.status === 'done') {
                            setIsValidating(false);
                            let parsedResult;
                            try {
                                parsedResult = typeof statusData.result === 'string' 
                                    ? JSON.parse(statusData.result) 
                                    : statusData.result;
                            } catch (e) {
                                setValidationError('Format hasil validasi tidak dikenali dari server AI.');
                                reject(new Error('parse_error'));
                                return;
                            }

                            if (parsedResult.approved === true) {
                                setValidationSuccess('Foto berhasil diverifikasi.');
                                resolve({ success: true, result: parsedResult });
                            } else {
                                const reason = parsedResult.reason || 'Foto tidak memenuhi ketentuan. Silakan gunakan foto lain.';
                                setValidationError(reason);
                                resolve({ success: false, reason });
                            }
                        } else {
                            // queued or processing -> wait 5 seconds and poll again
                            pollIntervalRef.current = setTimeout(poll, 5000);
                        }
                    } catch (err) {
                        setIsValidating(false);
                        const msg = err.response?.status === 429 
                            ? (err.response.data?.error || err.response.data?.message || 'Batas penggunaan harian telah tercapai.') 
                            : 'Gagal mengecek status validasi.';
                        setValidationError(msg);
                        reject(err);
                    }
                };

                // Mulai polling pertama kali setelah 5 detik
                pollIntervalRef.current = setTimeout(poll, 5000);

            } catch (err) {
                setIsValidating(false);
                let msg = 'Gagal mengirim foto ke server validasi.';
                if (err.response?.status === 429) {
                    msg = err.response.data?.error || err.response.data?.message || 'Batas penggunaan harian telah tercapai.';
                }
                setValidationError(msg);
                reject(err);
            }
        }; // end of reader.onloadend
    }); // end of Promise
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) {
                clearTimeout(pollIntervalRef.current);
            }
        };
    }, []);

    const clearValidation = useCallback(() => {
        if (pollIntervalRef.current) {
            clearTimeout(pollIntervalRef.current);
        }
        setIsValidating(false);
        setValidationError('');
        setValidationSuccess('');
    }, []);

    return {
        isValidating,
        validationError,
        validationSuccess,
        validatePhoto,
        clearValidation,
        setValidationError,
        setValidationSuccess
    };
};
