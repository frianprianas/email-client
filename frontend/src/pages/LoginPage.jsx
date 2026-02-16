import React, { useState } from 'react';
import {
    Box, Paper, TextField, Button, Typography, Alert,
    InputAdornment, IconButton, CircularProgress, Fade
} from '@mui/material';
import {
    Email as EmailIcon,
    Lock as LockIcon,
    Visibility,
    VisibilityOff,
    LightMode as LightModeIcon,
    DarkMode as DarkModeIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../App';
import logo from '../assets/logo.png';

const MAIL_DOMAIN = 'smk.baktinusantara666.sch.id';

const LoginPage = () => {
    const { login, toggleTheme, themeMode } = useAuth();
    const theme = useTheme();
    const c = theme.palette.custom;
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const fullEmail = username.includes('@') ? username : `${username}@${MAIL_DOMAIN}`;
            await login(fullEmail, password);
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: c.loginBg,
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <IconButton
                onClick={toggleTheme}
                sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    color: theme.palette.text.secondary,
                    zIndex: 10
                }}
            >
                {themeMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>

            {/* ... background elements ... */}
            <Box sx={{
                position: 'absolute',
                top: '-20%',
                left: '-10%',
                width: '50%',
                height: '50%',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(138,180,248,0.08) 0%, transparent 70%)',
                filter: 'blur(60px)',
                animation: 'pulse 6s infinite',
            }} />
            <Box sx={{
                position: 'absolute',
                bottom: '-20%',
                right: '-10%',
                width: '60%',
                height: '60%',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(129,201,149,0.06) 0%, transparent 70%)',
                filter: 'blur(80px)',
                animation: 'pulse 8s infinite 2s',
            }} />

            <Fade in timeout={800}>
                <Paper
                    elevation={0}
                    sx={{
                        width: '100%',
                        maxWidth: 440,
                        mx: 2,
                        p: 5,
                        borderRadius: 4,
                        background: c.loginPaper,
                        backdropFilter: 'blur(20px)',
                        border: `1px solid ${c.dialogBorder}`,
                        position: 'relative',
                        zIndex: 1,
                    }}
                >
                    {/* ... Logo Section ... */}
                    <Box sx={{ textAlign: 'center', mb: 4 }}>
                        <Box
                            component="img"
                            src={logo}
                            alt="Baknus 666 Mail Server"
                            sx={{
                                width: 120,
                                height: 'auto',
                                mb: 2,
                                filter: 'drop-shadow(0 4px 16px rgba(138,180,248,0.25))',
                            }}
                        />
                        <Typography
                            variant="h4"
                            sx={{
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #8ab4f8, #c2e7ff)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                mb: 0.5,
                            }}
                        >
                            BaknusMail
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            SMK Bakti Nusantara 666 Mail Server
                        </Typography>
                    </Box>

                    {error && (
                        <Alert
                            severity="error"
                            sx={{
                                mb: 3,
                                borderRadius: 2,
                                backgroundColor: c.errorBg,
                                border: `1px solid ${c.errorBorder}`,
                            }}
                            onClose={() => setError('')}
                        >
                            {error}
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit}>
                        <TextField
                            fullWidth
                            label="Username or Email"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            sx={{ mb: 2.5 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <EmailIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                                    </InputAdornment>
                                ),
                                endAdornment: !username.includes('@') ? (
                                    <InputAdornment position="end">
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: c.loginDomainColor,
                                                whiteSpace: 'nowrap',
                                                userSelect: 'none',
                                                fontSize: '0.85rem',
                                            }}
                                        >
                                            @{MAIL_DOMAIN}
                                        </Typography>
                                    </InputAdornment>
                                ) : null,
                            }}
                            placeholder="username"
                        />

                        <TextField
                            fullWidth
                            label="Password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            sx={{ mb: 3 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <LockIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() => setShowPassword(!showPassword)}
                                            edge="end"
                                            size="small"
                                        >
                                            {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disabled={loading}
                            sx={{
                                py: 1.5,
                                borderRadius: 3,
                                fontSize: '1rem',
                                fontWeight: 600,
                                background: c.btnGradient,
                                boxShadow: '0 4px 16px rgba(138,180,248,0.3)',
                                '&:hover': {
                                    background: c.btnHoverGradient,
                                    boxShadow: '0 6px 24px rgba(138,180,248,0.4)',
                                },
                                '&:disabled': {
                                    background: 'rgba(138,180,248,0.3)',
                                },
                            }}
                        >
                            {loading ? (
                                <CircularProgress size={24} sx={{ color: '#fff' }} />
                            ) : (
                                'Sign In'
                            )}
                        </Button>
                    </form>

                    <Typography
                        variant="caption"
                        sx={{
                            display: 'block',
                            textAlign: 'center',
                            mt: 3,
                            color: 'text.disabled',
                        }}
                    >
                        Develoved by IT Support SMK Baknus 666
                    </Typography>
                </Paper>
            </Fade>
        </Box>
    );
};

export default LoginPage;
