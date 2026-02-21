import React, { useState, useEffect, useRef } from 'react';
import {
    Dialog, DialogTitle, DialogContent, Box, Typography,
    TextField, Button, IconButton, CircularProgress, Alert,
    Divider, Chip, Tooltip, InputAdornment, Avatar, Snackbar
} from '@mui/material';
import {
    Close as CloseIcon,
    AlternateEmail as AliasIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    ContentCopy as CopyIcon,
    Check as CheckIcon,
    Draw as SignatureIcon,
    Save as SaveIcon,
    Person as PersonIcon,
    Edit as EditIcon,
    CameraAlt as CameraIcon,
    RemoveCircle as RemoveIcon,
    WhatsApp as WhatsAppIcon,
    PhoneIphone as PhoneIcon,
    Lock as LockIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { aliasAPI, authAPI } from '../api';
import { useAuth } from '../App';

const MAIL_DOMAIN = 'smk.baktinusantara666.sch.id';

const SettingsDialog = ({ open, onClose }) => {
    const { user, updateUser } = useAuth();
    const theme = useTheme();
    const c = theme.palette.custom;
    const [aliases, setAliases] = useState([]);
    const [newAlias, setNewAlias] = useState('');
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [copied, setCopied] = useState(false);

    // Signature state
    const [signature, setSignature] = useState('');
    const [savingSignature, setSavingSignature] = useState(false);

    // Profile state
    const [displayName, setDisplayName] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);
    const avatarInputRef = useRef(null);

    // Phone state
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [otpStep, setOtpStep] = useState(0); // 0: phone, 1: otp
    const [requestingOtp, setRequestingOtp] = useState(false);
    const [verifyingOtp, setVerifyingOtp] = useState(false);

    // Password change state
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordOtp, setPasswordOtp] = useState('');
    const [pwOtpStep, setPwOtpStep] = useState(0); // 0: form, 1: otp
    const [changingPassword, setChangingPassword] = useState(false);
    const [showPw, setShowPw] = useState(false);
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    // Fetch aliases when dialog opens
    useEffect(() => {
        if (open) {
            fetchAliases();
            setSignature(user?.signature || '');
            setDisplayName(user?.displayName || '');
            setPhoneNumber(user?.phoneNumber || '');
            setOtpStep(0);
            setOtp('');
            setPwOtpStep(0);
            setNewPassword('');
            setConfirmPassword('');
            setPasswordOtp('');
        }
    }, [open, user]);

    const fetchAliases = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await aliasAPI.getAliases();
            setAliases(res.data.aliases || []);
        } catch (err) {
            setError('Failed to load aliases');
            console.error('Fetch aliases error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddAlias = async () => {
        if (!newAlias.trim()) return;

        setAdding(true);
        setError('');
        setSuccess('');
        try {
            const res = await aliasAPI.createAlias(newAlias.trim());
            setSuccess(res.data.message || 'Alias created!');
            setNewAlias('');
            fetchAliases();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create alias');
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteAlias = async (id) => {
        setDeleting(id);
        setError('');
        setSuccess('');
        try {
            await aliasAPI.deleteAlias(id);
            setSuccess('Alias deleted successfully');
            setAliases(prev => prev.filter(a => a.id !== id));
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete alias');
        } finally {
            setDeleting(null);
        }
    };

    const handleCopyAlias = (address) => {
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddAlias();
        }
    };

    const handleSaveSignature = async () => {
        setSavingSignature(true);
        setError('');
        setSuccess('');
        try {
            const res = await authAPI.updateProfile({ signature });
            updateUser(res.data.user);
            setSuccess('Signature saved!');
        } catch (err) {
            setError('Failed to save signature');
        } finally {
            setSavingSignature(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!displayName.trim()) return;
        setSavingProfile(true);
        setError('');
        setSuccess('');
        try {
            const res = await authAPI.updateProfile({ displayName: displayName.trim() });
            updateUser(res.data.user);
            setSuccess('Profile updated!');
        } catch (err) {
            setError('Failed to update profile');
        } finally {
            setSavingProfile(false);
        }
    };

    const getInitials = (name) => {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        return parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : name.charAt(0).toUpperCase();
    };

    const getAvatarColor = (name) => {
        const colors = ['#8ab4f8', '#81c995', '#f28b82', '#fdd663', '#c58af9', '#78d9ec', '#fcad70'];
        const index = (name || '').charCodeAt(0) % colors.length;
        return colors[index];
    };

    const handleAvatarUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setError('Image must be less than 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (ev) => {
            // Resize image to 128x128
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const size = 128;
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');

                // Crop to square (center)
                const minDim = Math.min(img.width, img.height);
                const sx = (img.width - minDim) / 2;
                const sy = (img.height - minDim) / 2;
                ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

                const base64 = canvas.toDataURL('image/jpeg', 0.8);

                setSavingProfile(true);
                setError('');
                setSuccess('');
                try {
                    const res = await authAPI.updateProfile({ avatar: base64 });
                    updateUser(res.data.user);
                    setSuccess('Avatar updated!');
                } catch (err) {
                    setError('Failed to upload avatar');
                } finally {
                    setSavingProfile(false);
                }
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);

        // Reset input
        e.target.value = '';
    };

    const handleRemoveAvatar = async () => {
        setSavingProfile(true);
        setError('');
        setSuccess('');
        try {
            const res = await authAPI.updateProfile({ avatar: '' });
            updateUser(res.data.user);
            setSuccess('Avatar removed!');
        } catch (err) {
            setError('Failed to remove avatar');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleRequestOtp = async (type = 'verification') => {
        const target = type === 'verification' ? phoneNumber.trim() : user?.phoneNumber;
        if (!target) return;

        setRequestingOtp(true);
        setError('');
        setSuccess('');
        try {
            const res = await authAPI.requestOtp(target, type);
            setSuccess(res.data.message);
            if (type === 'verification') {
                setOtpStep(1);
            } else {
                setPwOtpStep(1);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Gagal mengirim OTP');
        } finally {
            setRequestingOtp(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp.trim()) return;
        setVerifyingOtp(true);
        setError('');
        setSuccess('');
        try {
            const res = await authAPI.verifyOtp(phoneNumber.trim(), otp.trim());
            updateUser(res.data.user);
            setSuccess('Nomor WA berhasil diverifikasi!');
            setOtpStep(0);
            setOtp('');
        } catch (err) {
            setError(err.response?.data?.error || 'OTP tidak valid');
        } finally {
            setVerifyingOtp(false);
        }
    };

    const handleResetPhone = () => {
        setOtpStep(0);
        setOtp('');
    };

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            setError('Konfirmasi password tidak cocok');
            return;
        }
        if (newPassword.length < 8) {
            setError('Password minimal 8 karakter');
            return;
        }
        if (!passwordOtp) {
            setError('Kode OTP harus diisi');
            return;
        }

        setChangingPassword(true);
        setError('');
        setSuccess('');
        try {
            const res = await authAPI.changePassword({
                newPassword,
                confirmPassword,
                otp: passwordOtp
            });
            setSuccess(res.data.message);
            setToastMessage('Password berhasil diperbarui!');
            setShowSuccessToast(true);
            setPwOtpStep(0);
            setNewPassword('');
            setConfirmPassword('');
            setPasswordOtp('');
        } catch (err) {
            setError(err.response?.data?.error || 'Gagal mengubah password');
        } finally {
            setChangingPassword(false);
        }
    };

    return (
        <>
            <Dialog
                open={open}
                onClose={onClose}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        bgcolor: 'background.paper',
                        border: `1px solid ${c.dialogBorder}`,
                        backgroundImage: 'none',
                    },
                }}
            >
                <DialogTitle sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    pb: 1,
                }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.125rem' }}>
                        Settings
                    </Typography>
                    <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={{ px: 3, pb: 3 }}>
                    {/* Alerts */}
                    {error && (
                        <Alert
                            severity="error"
                            onClose={() => setError('')}
                            sx={{
                                mb: 2,
                                borderRadius: 2,
                                bgcolor: c.errorBg,
                                border: `1px solid ${c.errorBorder}`,
                            }}
                        >
                            {error}
                        </Alert>
                    )}
                    {success && (
                        <Alert
                            severity="success"
                            onClose={() => setSuccess('')}
                            sx={{
                                mb: 2,
                                borderRadius: 2,
                                bgcolor: c.successBg,
                                border: `1px solid ${c.successBorder}`,
                            }}
                        >
                            {success}
                        </Alert>
                    )}

                    {/* Profile Section */}
                    <Box sx={{ mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                            <PersonIcon sx={{ color: c.accent, fontSize: 20 }} />
                            <Typography variant="subtitle2" sx={{ color: c.accent, fontWeight: 600 }}>
                                Profile
                            </Typography>
                        </Box>

                        <Box sx={{
                            p: 2.5,
                            borderRadius: 2,
                            bgcolor: c.cardBg,
                            border: `1px solid ${c.cardBorder}`,
                        }}>
                            {/* Avatar & Email */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
                                {/* Clickable Avatar */}
                                <Box sx={{ position: 'relative' }}>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        ref={avatarInputRef}
                                        onChange={handleAvatarUpload}
                                        style={{ display: 'none' }}
                                    />
                                    <Avatar
                                        src={user?.avatar || undefined}
                                        sx={{
                                            width: 64,
                                            height: 64,
                                            bgcolor: getAvatarColor(displayName || user?.email),
                                            fontSize: '1.5rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'opacity 0.2s',
                                            '&:hover': { opacity: 0.8 },
                                        }}
                                        onClick={() => avatarInputRef.current?.click()}
                                    >
                                        {getInitials(displayName || user?.email)}
                                    </Avatar>
                                    {/* Camera overlay */}
                                    <Box
                                        onClick={() => avatarInputRef.current?.click()}
                                        sx={{
                                            position: 'absolute',
                                            bottom: -2,
                                            right: -2,
                                            width: 24,
                                            height: 24,
                                            borderRadius: '50%',
                                            bgcolor: c.accent,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            border: `2px solid ${c.cameraBtnBorder}`,
                                            '&:hover': { opacity: 0.85 },
                                        }}
                                    >
                                        <CameraIcon sx={{ fontSize: 14, color: c.avatarText }} />
                                    </Box>
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                        {user?.email}
                                    </Typography>
                                    <Typography variant="caption" color="text.disabled">
                                        Click avatar to upload photo (max 2MB)
                                    </Typography>
                                    {user?.avatar && (
                                        <Box>
                                            <Button
                                                size="small"
                                                onClick={handleRemoveAvatar}
                                                startIcon={<RemoveIcon sx={{ fontSize: 14 }} />}
                                                sx={{
                                                    mt: 0.5,
                                                    fontSize: '0.7rem',
                                                    color: 'error.main',
                                                    textTransform: 'none',
                                                    p: 0,
                                                    minWidth: 'auto',
                                                    '&:hover': { bgcolor: 'transparent', opacity: 0.8 },
                                                }}
                                            >
                                                Remove photo
                                            </Button>
                                        </Box>
                                    )}
                                </Box>
                            </Box>

                            {/* Display Name */}
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                <TextField
                                    size="small"
                                    label="Display Name"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    fullWidth
                                    placeholder="e.g. John Doe"
                                    sx={{
                                        '& .MuiOutlinedInput-root': { borderRadius: 2 },
                                    }}
                                />
                                <Button
                                    variant="contained"
                                    onClick={handleSaveProfile}
                                    disabled={savingProfile || !displayName.trim() || displayName.trim() === user?.displayName}
                                    startIcon={savingProfile ? <CircularProgress size={16} /> : <SaveIcon />}
                                    size="small"
                                    sx={{
                                        borderRadius: 2,
                                        px: 2,
                                        minHeight: 40,
                                        background: c.btnGradient,
                                        '&:hover': {
                                            background: c.btnHoverGradient,
                                        },
                                        textTransform: 'none',
                                        fontWeight: 500,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    Save
                                </Button>
                            </Box>
                        </Box>
                    </Box>

                    <Divider sx={{ mb: 3 }} />

                    {/* Password Change Section */}
                    <Box sx={{ mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                            <LockIcon sx={{ color: c.accent, fontSize: 20 }} />
                            <Typography variant="subtitle2" sx={{ color: c.accent, fontWeight: 600 }}>
                                Ganti Password Email
                            </Typography>
                        </Box>

                        <Box sx={{
                            p: 2.5,
                            borderRadius: 2,
                            bgcolor: c.cardBg,
                            border: `1px solid ${c.cardBorder}`,
                        }}>
                            {!user?.isPhoneVerified ? (
                                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                                    Harap verifikasi nomor WhatsApp terlebih dahulu untuk dapat mengganti password.
                                </Alert>
                            ) : (
                                <Box>
                                    {pwOtpStep === 0 ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <TextField
                                                size="small"
                                                label="Password Baru"
                                                type={showPw ? 'text' : 'password'}
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                fullWidth
                                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                                InputProps={{
                                                    endAdornment: (
                                                        <InputAdornment position="end">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => setShowPw(!showPw)}
                                                                edge="end"
                                                            >
                                                                {showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                                            </IconButton>
                                                        </InputAdornment>
                                                    ),
                                                }}
                                            />
                                            <TextField
                                                size="small"
                                                label="Konfirmasi Password Baru"
                                                type={showPw ? 'text' : 'password'}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                fullWidth
                                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                            />
                                            <Button
                                                variant="contained"
                                                onClick={() => handleRequestOtp('password_change')}
                                                disabled={requestingOtp || !newPassword || !confirmPassword}
                                                startIcon={requestingOtp ? <CircularProgress size={16} /> : <WhatsAppIcon />}
                                                sx={{
                                                    borderRadius: 2,
                                                    background: '#25D366',
                                                    '&:hover': { background: '#128C7E' },
                                                    textTransform: 'none',
                                                    fontWeight: 600
                                                }}
                                            >
                                                Kirim OTP ke WhatsApp
                                            </Button>
                                        </Box>
                                    ) : (
                                        <Box>
                                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                                                Masukkan kode OTP yang dikirim ke <strong>{user?.phoneNumber}</strong> untuk mengonfirmasi perubahan password.
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                <TextField
                                                    size="small"
                                                    label="Kode OTP"
                                                    value={passwordOtp}
                                                    onChange={(e) => setPasswordOtp(e.target.value)}
                                                    fullWidth
                                                    placeholder="6 digit"
                                                    disabled={changingPassword}
                                                    autoFocus
                                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                                />
                                                <Button
                                                    variant="contained"
                                                    onClick={handleChangePassword}
                                                    disabled={changingPassword || !passwordOtp}
                                                    startIcon={changingPassword ? <CircularProgress size={16} /> : <SaveIcon />}
                                                    sx={{
                                                        borderRadius: 2,
                                                        px: 3,
                                                        background: c.btnGradient,
                                                        '&:hover': { background: c.btnHoverGradient },
                                                        textTransform: 'none',
                                                        fontWeight: 600,
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    Ganti Password
                                                </Button>
                                            </Box>
                                            <Button
                                                size="small"
                                                onClick={() => setPwOtpStep(0)}
                                                sx={{ mt: 1, textTransform: 'none', fontSize: '0.75rem', p: 0 }}
                                            >
                                                Batal
                                            </Button>
                                        </Box>
                                    )}
                                    <Typography variant="caption" color="text.disabled" sx={{ mt: 1.5, display: 'block' }}>
                                        Penting: Penggantian password hanya diperbolehkan satu kali dalam 24 jam.
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>

                    <Divider sx={{ mb: 3 }} />

                    {/* WhatsApp Section */}
                    <Box sx={{ mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                            <WhatsAppIcon sx={{ color: '#25D366', fontSize: 20 }} />
                            <Typography variant="subtitle2" sx={{ color: c.accent, fontWeight: 600 }}>
                                WhatsApp Verification
                            </Typography>
                        </Box>

                        <Box sx={{
                            p: 2.5,
                            borderRadius: 2,
                            bgcolor: c.cardBg,
                            border: `1px solid ${c.cardBorder}`,
                        }}>
                            {user?.isPhoneVerified ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Box sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        bgcolor: 'success.main',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white'
                                    }}>
                                        <CheckIcon />
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {user.phoneNumber}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 500 }}>
                                            Verified WhatsApp Number
                                        </Typography>
                                    </Box>
                                    <Button
                                        size="small"
                                        onClick={() => {
                                            setOtpStep(0);
                                            setPhoneNumber('');
                                            // We don't have a direct "unverify" but we can let them change it
                                        }}
                                        sx={{ ml: 'auto', textTransform: 'none', fontSize: '0.75rem' }}
                                    >
                                        Change
                                    </Button>
                                </Box>
                            ) : (
                                <Box>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        Verifikasi nomor WhatsApp Anda untuk menerima notifikasi penting.
                                    </Typography>

                                    {otpStep === 0 ? (
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <TextField
                                                size="small"
                                                label="Nomor WhatsApp"
                                                value={phoneNumber}
                                                onChange={(e) => setPhoneNumber(e.target.value)}
                                                fullWidth
                                                placeholder="Contoh: 08123456789"
                                                disabled={requestingOtp}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': { borderRadius: 2 },
                                                }}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <PhoneIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                                                        </InputAdornment>
                                                    ),
                                                }}
                                            />
                                            <Button
                                                variant="contained"
                                                onClick={handleRequestOtp}
                                                disabled={requestingOtp || !phoneNumber.trim()}
                                                startIcon={requestingOtp ? <CircularProgress size={16} /> : <WhatsAppIcon />}
                                                size="small"
                                                sx={{
                                                    borderRadius: 2,
                                                    px: 2,
                                                    minHeight: 40,
                                                    background: '#25D366',
                                                    '&:hover': {
                                                        background: '#128C7E',
                                                    },
                                                    textTransform: 'none',
                                                    fontWeight: 500,
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                Verifikasi
                                            </Button>
                                        </Box>
                                    ) : (
                                        <Box>
                                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                                                Masukkan kode OTP yang dikirim ke <strong>{phoneNumber}</strong>
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                <TextField
                                                    size="small"
                                                    label="Kode OTP"
                                                    value={otp}
                                                    onChange={(e) => setOtp(e.target.value)}
                                                    fullWidth
                                                    placeholder="6 digit"
                                                    disabled={verifyingOtp}
                                                    autoFocus
                                                    sx={{
                                                        '& .MuiOutlinedInput-root': { borderRadius: 2 },
                                                    }}
                                                />
                                                <Button
                                                    variant="contained"
                                                    onClick={handleVerifyOtp}
                                                    disabled={verifyingOtp || !otp.trim()}
                                                    startIcon={verifyingOtp ? <CircularProgress size={16} /> : <CheckIcon />}
                                                    size="small"
                                                    sx={{
                                                        borderRadius: 2,
                                                        px: 2,
                                                        minHeight: 40,
                                                        background: c.btnGradient,
                                                        '&:hover': {
                                                            background: c.btnHoverGradient,
                                                        },
                                                        textTransform: 'none',
                                                        fontWeight: 500,
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    Verify
                                                </Button>
                                            </Box>
                                            <Button
                                                size="small"
                                                onClick={handleResetPhone}
                                                sx={{ mt: 1, textTransform: 'none', fontSize: '0.75rem', p: 0 }}
                                            >
                                                Ganti Nomor
                                            </Button>
                                        </Box>
                                    )}
                                </Box>
                            )}
                        </Box>
                    </Box>

                    <Divider sx={{ mb: 3 }} />

                    {/* Email Alias Section */}
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                            <AliasIcon sx={{ color: c.accent, fontSize: 20 }} />
                            <Typography variant="subtitle2" sx={{ color: c.accent, fontWeight: 600 }}>
                                Email Alias
                            </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Add an alias email address. Emails sent to this alias will be delivered to your inbox.
                            You can have maximum <strong>1 alias</strong>.
                        </Typography>

                        {/* Current Aliases */}
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                                <CircularProgress size={28} sx={{ color: c.accent }} />
                            </Box>
                        ) : (
                            <>
                                {aliases.length > 0 && (
                                    <Box sx={{ mb: 2 }}>
                                        {aliases.map((alias) => (
                                            <Box
                                                key={alias.id}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    p: 1.5,
                                                    borderRadius: 2,
                                                    bgcolor: c.aliasBg,
                                                    border: `1px solid ${c.aliasBorder}`,
                                                    mb: 1,
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <AliasIcon sx={{ color: c.accent, fontSize: 18 }} />
                                                    <Box>
                                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                            {alias.address}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.disabled">
                                                            → {alias.goto}
                                                        </Typography>
                                                    </Box>
                                                    <Chip
                                                        label={alias.active ? 'Active' : 'Inactive'}
                                                        size="small"
                                                        sx={{
                                                            ml: 1,
                                                            height: 20,
                                                            fontSize: '0.6875rem',
                                                            bgcolor: alias.active
                                                                ? c.successBg
                                                                : c.chipBg,
                                                            color: alias.active ? 'success.main' : 'text.disabled',
                                                        }}
                                                    />
                                                </Box>
                                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                    <Tooltip title={copied ? 'Copied!' : 'Copy alias'}>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleCopyAlias(alias.address)}
                                                            sx={{ color: 'text.secondary' }}
                                                        >
                                                            {copied ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Delete alias">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleDeleteAlias(alias.id)}
                                                            disabled={deleting === alias.id}
                                                            sx={{ color: 'error.main' }}
                                                        >
                                                            {deleting === alias.id
                                                                ? <CircularProgress size={16} />
                                                                : <DeleteIcon fontSize="small" />}
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </Box>
                                        ))}
                                    </Box>
                                )}

                                {/* Add Alias Form - only show if no alias yet */}
                                {aliases.length === 0 && (
                                    <Box sx={{
                                        display: 'flex',
                                        gap: 1,
                                        alignItems: 'flex-start',
                                    }}>
                                        <TextField
                                            size="small"
                                            value={newAlias}
                                            onChange={(e) => setNewAlias(e.target.value.replace(/[@\s]/g, ''))}
                                            onKeyPress={handleKeyPress}
                                            placeholder="username"
                                            disabled={adding}
                                            sx={{
                                                flex: 1,
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                },
                                            }}
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                color: 'text.disabled',
                                                                whiteSpace: 'nowrap',
                                                                fontSize: '0.8rem',
                                                                userSelect: 'none',
                                                            }}
                                                        >
                                                            @{MAIL_DOMAIN}
                                                        </Typography>
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />
                                        <Button
                                            variant="contained"
                                            onClick={handleAddAlias}
                                            disabled={adding || !newAlias.trim()}
                                            startIcon={adding ? <CircularProgress size={16} /> : <AddIcon />}
                                            sx={{
                                                borderRadius: 2,
                                                px: 2.5,
                                                minHeight: 40,
                                                background: c.btnGradient,
                                                '&:hover': {
                                                    background: c.btnHoverGradient,
                                                },
                                                textTransform: 'none',
                                                fontWeight: 500,
                                            }}
                                        >
                                            Add
                                        </Button>
                                    </Box>
                                )}

                                {aliases.length === 0 && !loading && (
                                    <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
                                        No alias set. Add one above to receive emails on an alternative address.
                                    </Typography>
                                )}
                            </>
                        )}
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    {/* Signature Section */}
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                            <SignatureIcon sx={{ color: c.accent, fontSize: 20 }} />
                            <Typography variant="subtitle2" sx={{ color: c.accent, fontWeight: 600 }}>
                                Email Signature
                            </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Create a signature that will be automatically added to your outgoing emails.
                        </Typography>

                        <TextField
                            multiline
                            minRows={3}
                            maxRows={6}
                            fullWidth
                            value={signature}
                            onChange={(e) => setSignature(e.target.value)}
                            placeholder="e.g. Best regards,&#10;John Doe&#10;SMK Bakti Nusantara 666"
                            sx={{
                                mb: 1.5,
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 2,
                                    fontSize: '0.875rem',
                                },
                            }}
                        />

                        <Button
                            variant="contained"
                            onClick={handleSaveSignature}
                            disabled={savingSignature}
                            startIcon={savingSignature ? <CircularProgress size={16} /> : <SaveIcon />}
                            size="small"
                            sx={{
                                borderRadius: 2,
                                px: 2.5,
                                background: c.btnGradient,
                                '&:hover': {
                                    background: c.btnHoverGradient,
                                },
                                textTransform: 'none',
                                fontWeight: 500,
                            }}
                        >
                            Save Signature
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>

            <Snackbar
                open={showSuccessToast}
                autoHideDuration={4000}
                onClose={() => setShowSuccessToast(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setShowSuccessToast(false)}
                    severity="success"
                    variant="filled"
                    sx={{
                        width: '100%',
                        borderRadius: 2,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                >
                    {toastMessage}
                </Alert>
            </Snackbar>
        </>
    );
};

export default SettingsDialog;
