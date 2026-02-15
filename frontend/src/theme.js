import { createTheme } from '@mui/material/styles';

const getTheme = (mode = 'dark') => {
    const isDark = mode === 'dark';

    return createTheme({
        palette: {
            mode,
            primary: {
                main: isDark ? '#8ab4f8' : '#1a73e8',
                light: isDark ? '#aecbfa' : '#4285f4',
                dark: isDark ? '#669df6' : '#1557b0',
            },
            secondary: {
                main: isDark ? '#f28b82' : '#d93025',
                light: isDark ? '#f6aca6' : '#ea4335',
                dark: isDark ? '#e06b64' : '#b31412',
            },
            background: {
                default: isDark ? '#1f1f1f' : '#f6f8fc',
                paper: isDark ? '#2d2d2d' : '#ffffff',
            },
            surface: {
                main: isDark ? '#303134' : '#edf2fc',
                light: isDark ? '#3c4043' : '#e3e8f0',
                dark: isDark ? '#202124' : '#d3d8e0',
            },
            text: {
                primary: isDark ? '#e8eaed' : '#1f1f1f',
                secondary: isDark ? '#9aa0a6' : '#5f6368',
                disabled: isDark ? '#5f6368' : '#9aa0a6',
            },
            divider: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
            error: { main: isDark ? '#f28b82' : '#d93025' },
            warning: { main: isDark ? '#fdd663' : '#f9ab00' },
            info: { main: isDark ? '#8ab4f8' : '#1a73e8' },
            success: { main: isDark ? '#81c995' : '#188038' },
            // Custom tokens for components
            custom: {
                // TopBar / Search
                appBar: isDark ? '#2d2d2d' : '#ffffff',
                searchBg: isDark ? 'rgba(255,255,255,0.08)' : '#edf2fc',
                searchBgFocused: isDark ? 'rgba(255,255,255,0.12)' : '#ffffff',
                searchBorder: isDark ? 'transparent' : 'rgba(0,0,0,0.12)',
                searchBorderFocused: isDark ? 'rgba(138,180,248,0.4)' : 'rgba(26,115,232,0.3)',
                // Sidebar
                sidebarBg: isDark ? '#1f1f1f' : '#f6f8fc',
                selectedBg: isDark ? '#c2e7ff22' : 'rgba(26,115,232,0.12)',
                selectedColor: isDark ? '#c2e7ff' : '#1a73e8',
                hoverBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                composeGradient: isDark
                    ? 'linear-gradient(135deg, #c2e7ff 0%, #8ab4f8 100%)'
                    : 'linear-gradient(135deg, #c2e7ff 0%, #a8d4ff 100%)',
                composeHoverGradient: isDark
                    ? 'linear-gradient(135deg, #d4eeff 0%, #aecbfa 100%)'
                    : 'linear-gradient(135deg, #d4eeff 0%, #c2e7ff 100%)',
                composeTextColor: '#001d35',
                // MessageList
                unreadBg: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(26,115,232,0.04)',
                selectedMsgBg: isDark ? 'rgba(194,231,255,0.08)' : 'rgba(26,115,232,0.08)',
                selectedMsgHoverBg: isDark ? 'rgba(194,231,255,0.12)' : 'rgba(26,115,232,0.12)',
                msgHoverBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                borderLight: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                borderLighter: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',
                // ComposeDialog
                composeBg: isDark ? '#2d2d2d' : '#ffffff',
                composeHeaderBg: isDark ? '#303134' : '#f1f3f4',
                // MessageView
                attachBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                attachBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
                attachHoverBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                replyBorder: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                replyHoverBorder: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                replyHoverBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                // Dialog / Settings
                dialogBg: isDark ? '#2d2d2d' : '#ffffff',
                dialogBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)',
                cardBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                cardBorder: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                aliasBg: isDark ? 'rgba(138,180,248,0.08)' : 'rgba(26,115,232,0.06)',
                aliasBorder: isDark ? 'rgba(138,180,248,0.15)' : 'rgba(26,115,232,0.15)',
                // Alerts
                successBg: isDark ? 'rgba(129,201,149,0.1)' : 'rgba(24,128,56,0.08)',
                successBorder: isDark ? 'rgba(129,201,149,0.3)' : 'rgba(24,128,56,0.2)',
                errorBg: isDark ? 'rgba(242,139,130,0.1)' : 'rgba(217,48,37,0.08)',
                errorBorder: isDark ? 'rgba(242,139,130,0.3)' : 'rgba(217,48,37,0.2)',
                // Empty state
                emptyBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                // Login
                loginBg: isDark
                    ? 'linear-gradient(135deg, #0d1117 0%, #161b22 30%, #1a1f2e 60%, #0d1117 100%)'
                    : 'linear-gradient(135deg, #e8eef6 0%, #dce3ed 30%, #cdd8e8 60%, #e8eef6 100%)',
                loginPaper: isDark ? 'rgba(45,45,45,0.85)' : 'rgba(255,255,255,0.95)',
                loginDomainColor: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
                // Editor placeholder
                placeholderColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                // Button gradient
                btnGradient: 'linear-gradient(135deg, #8ab4f8 0%, #669df6 100%)',
                btnHoverGradient: 'linear-gradient(135deg, #aecbfa 0%, #8ab4f8 100%)',
                // Chip bg
                chipBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                // Accent
                accent: isDark ? '#8ab4f8' : '#1a73e8',
                accentPastel: isDark ? '#c2e7ff' : '#d2e3fc',
                // Camera btn border
                cameraBtnBorder: isDark ? '#2d2d2d' : '#ffffff',
                // Tooltip
                tooltipBg: isDark ? '#3c4043' : '#202124',
                tooltipColor: isDark ? '#e8eaed' : '#ffffff',
                // Avatar text
                avatarText: isDark ? '#1f1f1f' : '#ffffff',
            },
        },
        typography: {
            fontFamily: '"Google Sans", "Roboto", -apple-system, BlinkMacSystemFont, sans-serif',
            h1: { fontWeight: 500 },
            h2: { fontWeight: 500 },
            h3: { fontWeight: 500 },
            h4: { fontWeight: 500 },
            h5: { fontWeight: 500 },
            h6: { fontWeight: 500 },
            subtitle1: { fontWeight: 400, fontSize: '0.875rem' },
            subtitle2: { fontWeight: 500, fontSize: '0.8125rem' },
            body1: { fontSize: '0.875rem' },
            body2: { fontSize: '0.8125rem' },
            button: { textTransform: 'none', fontWeight: 500 },
        },
        shape: {
            borderRadius: 16,
        },
        components: {
            MuiButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 20,
                        padding: '8px 24px',
                        fontSize: '0.875rem',
                    },
                    contained: {
                        boxShadow: 'none',
                        '&:hover': {
                            boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.15)',
                        },
                    },
                },
            },
            MuiIconButton: {
                styleOverrides: {
                    root: {
                        borderRadius: '50%',
                        transition: 'background-color 0.2s ease',
                    },
                },
            },
            MuiDrawer: {
                styleOverrides: {
                    paper: {
                        backgroundColor: isDark ? '#1f1f1f' : '#f6f8fc',
                        borderRight: 'none',
                    },
                },
            },
            MuiListItemButton: {
                styleOverrides: {
                    root: {
                        borderRadius: '0 25px 25px 0',
                        margin: '1px 0',
                        paddingLeft: 26,
                        '&.Mui-selected': {
                            backgroundColor: isDark ? '#c2e7ff22' : 'rgba(26,115,232,0.12)',
                            color: isDark ? '#c2e7ff' : '#1a73e8',
                            '&:hover': {
                                backgroundColor: isDark ? '#c2e7ff33' : 'rgba(26,115,232,0.18)',
                            },
                        },
                        '&:hover': {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        },
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                    },
                },
            },
            MuiTooltip: {
                styleOverrides: {
                    tooltip: {
                        backgroundColor: isDark ? '#3c4043' : '#202124',
                        color: isDark ? '#e8eaed' : '#ffffff',
                        fontSize: '0.75rem',
                        borderRadius: 4,
                    },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                    },
                },
            },
            MuiTextField: {
                styleOverrides: {
                    root: {
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 8,
                        },
                    },
                },
            },
        },
    });
};

export default getTheme;
