import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Card, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Chip, IconButton,
    CircularProgress, Alert, Tooltip, Avatar, InputBase, Paper
} from '@mui/material';
import {
    Search as SearchIcon,
    Refresh as RefreshIcon,
    AdminPanelSettings as AdminIcon,
    Email as EmailIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { authAPI } from '../api';

const AdminMailboxList = () => {
    const theme = useTheme();
    const c = theme.palette.custom;
    const [mailboxes, setMailboxes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchMailboxes = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await authAPI.getAdminMailboxes();
            setMailboxes(res.data.mailboxes || []);
        } catch (err) {
            console.error('Error fetching admin mailboxes:', err);
            setError(err.response?.data?.error || 'Gagal mengambil daftar email dari server.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMailboxes();
    }, []);

    const filteredMailboxes = mailboxes.filter(mb => {
        const query = searchQuery.toLowerCase();
        return (
            (mb.name && mb.name.toLowerCase().includes(query)) ||
            (mb.email && mb.email.toLowerCase().includes(query)) ||
            (mb.tags && mb.tags.some(tag => tag.toLowerCase().includes(query)))
        );
    });

    const getAvatarColor = (name) => {
        const colors = ['#8ab4f8', '#81c995', '#f28b82', '#fdd663', '#c58af9', '#78d9ec', '#fcad70'];
        const index = (name || '').charCodeAt(0) % colors.length;
        return colors[index];
    };

    return (
        <Box className="fade-in" sx={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            p: { xs: 2, md: 3 },
            overflow: 'hidden',
            bgcolor: 'background.paper'
        }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <AdminIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 600, fontFamily: '"Google Sans", sans-serif' }}>
                            Admin Panel: Daftar Email
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Daftar akun mailbox terdaftar beserta nama, email, dan tag
                        </Typography>
                    </Box>
                </Box>
                <Tooltip title="Refresh daftar">
                    <IconButton onClick={fetchMailboxes} disabled={loading} sx={{ color: 'text.secondary' }}>
                        <RefreshIcon className={loading ? 'spin-animation' : ''} />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Search Bar */}
            <Paper
                elevation={0}
                sx={{
                    p: '2px 4px',
                    display: 'flex',
                    alignItems: 'center',
                    mb: 3,
                    bgcolor: c.searchBg,
                    borderRadius: 3,
                    border: `1px solid ${c.searchBorder}`,
                    width: '100%',
                    maxWidth: 500,
                    transition: 'all 0.15s ease',
                    '&:focus-within': {
                        bgcolor: c.searchBgFocused,
                        borderColor: 'primary.main',
                        boxShadow: '0 0 0 2px rgba(138,180,248,0.2)'
                    }
                }}
            >
                <IconButton sx={{ p: '10px', color: 'text.secondary' }} disabled>
                    <SearchIcon />
                </IconButton>
                <InputBase
                    sx={{ ml: 1, flex: 1, color: 'text.primary', fontSize: '0.875rem' }}
                    placeholder="Cari nama, email, atau tag..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </Paper>

            {/* Error Message */}
            {error && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Main Table Content */}
            <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                        <CircularProgress size={40} />
                    </Box>
                ) : filteredMailboxes.length === 0 ? (
                    <Box sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        flex: 1,
                        bgcolor: c.emptyBg,
                        borderRadius: 4,
                        p: 3,
                        textAlign: 'center',
                        border: `1px dashed ${c.borderLight}`
                    }}>
                        <EmailIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                        <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                            Tidak ada email yang ditemukan
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                            Silakan ubah kata kunci pencarian Anda
                        </Typography>
                    </Box>
                ) : (
                    <TableContainer sx={{
                        maxHeight: '100%',
                        borderRadius: 3,
                        border: `1px solid ${c.borderLight}`,
                        bgcolor: 'background.paper',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                        overflowY: 'auto'
                    }}>
                        <Table stickyHeader aria-label="mailbox directory table">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ bgcolor: 'surface.main', fontWeight: 600, borderBottom: `1px solid ${c.borderLight}` }}>Nama</TableCell>
                                    <TableCell sx={{ bgcolor: 'surface.main', fontWeight: 600, borderBottom: `1px solid ${c.borderLight}` }}>Email</TableCell>
                                    <TableCell sx={{ bgcolor: 'surface.main', fontWeight: 600, borderBottom: `1px solid ${c.borderLight}` }}>Tag</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredMailboxes.map((mb, idx) => (
                                    <TableRow
                                        key={mb.email || idx}
                                        sx={{
                                            '&:hover': { bgcolor: c.msgHoverBg },
                                            transition: 'background-color 0.2s',
                                            '& td': { borderBottom: `1px solid ${c.borderLighter}` }
                                        }}
                                    >
                                        <TableCell sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <Avatar
                                                sx={{
                                                    width: 32,
                                                    height: 32,
                                                    bgcolor: getAvatarColor(mb.name || mb.email),
                                                    fontSize: '0.875rem',
                                                    fontWeight: 600,
                                                    color: '#ffffff'
                                                }}
                                            >
                                                {(mb.name || mb.email).charAt(0).toUpperCase()}
                                            </Avatar>
                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                {mb.name || '-'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {mb.email}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {mb.tags && mb.tags.length > 0 ? (
                                                    mb.tags.map((tag, tagIdx) => {
                                                        const isTagAdmin = tag.toLowerCase() === 'admin';
                                                        return (
                                                            <Chip
                                                                key={tagIdx}
                                                                label={tag}
                                                                size="small"
                                                                sx={{
                                                                    fontWeight: isTagAdmin ? 600 : 400,
                                                                    background: isTagAdmin ? c.composeGradient : undefined,
                                                                    color: isTagAdmin ? c.composeTextColor : 'text.primary',
                                                                    border: isTagAdmin ? 'none' : `1px solid ${c.borderLight}`,
                                                                    fontSize: '0.75rem',
                                                                    height: 20
                                                                }}
                                                            />
                                                        );
                                                    })
                                                ) : (
                                                    <Typography variant="caption" color="text.disabled">-</Typography>
                                                )}
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>
        </Box>
    );
};

export default AdminMailboxList;
