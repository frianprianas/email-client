import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor to add token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor for auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    login: (email, password) => api.post('/auth/login', { email, password }),
    logout: () => api.post('/auth/logout'),
    getMe: () => api.get('/auth/me'),
    updateProfile: (data) => api.put('/auth/profile', data),
    requestOtp: (phoneNumber, type = 'verification') => api.post('/auth/request-otp', { phoneNumber, type }),
    verifyOtp: (phoneNumber, otp) => api.post('/auth/verify-otp', { phoneNumber, otp }),
    changePassword: (data) => api.post('/auth/change-password', data),
};

// Mail API
export const mailAPI = {
    getMessages: (folder = 'INBOX', page = 1, limit = 50) =>
        api.get(`/mail/messages/${encodeURIComponent(folder)}`, { params: { page, limit } }),
    getMessage: (folder, uid) =>
        api.get(`/mail/message/${encodeURIComponent(folder)}/${uid}`),
    searchMessages: (query, folder = 'INBOX') =>
        api.get(`/mail/search/${encodeURIComponent(folder)}`, { params: { q: query } }),
    sendMail: (data) => api.post('/mail/send', data),
    saveDraft: (data) => api.post('/mail/draft', data),
    sendDraft: (data) => api.post('/mail/draft/send', data),
    toggleRead: (folder, uid, read) =>
        api.put(`/mail/message/${encodeURIComponent(folder)}/${uid}/read`, { read }),
    toggleStar: (folder, uid, starred) =>
        api.put(`/mail/message/${encodeURIComponent(folder)}/${uid}/star`, { starred }),
    moveMessage: (uid, from, to) =>
        api.put(`/mail/message/${uid}/move`, { from, to }),
    deleteMessage: (folder, uid) =>
        api.delete(`/mail/message/${encodeURIComponent(folder)}/${uid}`),
    getFolders: () => api.get('/mail/folders'),
};

// Contacts API
export const contactsAPI = {
    getAll: () => api.get('/contacts'),
    create: (data) => api.post('/contacts', data),
    delete: (id) => api.delete(`/contacts/${id}`),
};

// Alias API
export const aliasAPI = {
    getAliases: () => api.get('/alias'),
    createAlias: (alias) => api.post('/alias', { alias }),
    deleteAlias: (id) => api.delete(`/alias/${id}`),
};

// Templates API
export const templatesAPI = {
    getAll: () => api.get('/templates'),
    create: (data) => api.post('/templates', data),
    delete: (id) => api.delete(`/templates/${id}`),
};

// Snooze API
export const snoozeAPI = {
    snooze: (folder, uid, snoozeUntil) =>
        api.post(`/snooze/${encodeURIComponent(folder)}/${uid}`, { snoozeUntil }),
};

// Schedule API
export const scheduleAPI = {
    schedule: (data) => api.post('/schedule', data),
    list: () => api.get('/schedule'),
    cancel: (id) => api.delete(`/schedule/${id}`),
};

export default api;
