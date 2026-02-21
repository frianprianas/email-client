import React from 'react';
import {
    Box, Container, Typography, Paper, Grid, Accordion,
    AccordionSummary, AccordionDetails, Breadcrumbs, Link,
    Divider, List, ListItem, ListItemIcon, ListItemText,
    IconButton, Button
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    NavigateNext as NavigateNextIcon,
    ArrowBack as ArrowBackIcon,
    Help as HelpIcon,
    Mail as MailIcon,
    Lock as LockIcon,
    Settings as SettingsIcon,
    WhatsApp as WhatsAppIcon,
    AlternateEmail as AliasIcon,
    Schedule as ScheduleIcon,
    AccessTime as SnoozeIcon,
    Smartphone as SmartphoneIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';

const HelpPage = () => {
    const theme = useTheme();
    const c = theme.palette.custom;
    const navigate = useNavigate();

    const sections = [
        {
            title: 'Memulai (Getting Started)',
            icon: <MailIcon color="primary" />,
            content: [
                {
                    q: 'Bagaimana cara login ke BaknusMail?',
                    a: 'Gunakan username atau alamat email sekolah lengkap anda (@smk.baktinusantara666.sch.id) dan password email yang sudah diberikan oleh IT Support.'
                },
                {
                    q: 'Apa itu BaknusMail?',
                    a: 'BaknusMail adalah layanan email internal SMK Bakti Nusantara 666 yang dirancang untuk mempermudah komunikasi akademik dan profesional bagi staf dan guru.'
                }
            ]
        },
        {
            title: 'Keamanan & Profil',
            icon: <LockIcon sx={{ color: '#f28b82' }} />,
            content: [
                {
                    q: 'Bagaimana cara mengganti password?',
                    a: 'Klik menu "Settings" (ikon gerigi) di pojok kiri bawah, lalu pilih bagian "Ganti Password Email". Anda harus melakukan verifikasi WhatsApp terlebih dahulu sebelum dapat mengganti password.'
                },
                {
                    q: 'Kenapa saya harus verifikasi WhatsApp?',
                    a: 'Verifikasi WhatsApp digunakan untuk sistem keamanan dua langkah (2FA) saat anda ingin mengubah password atau melakukan tindakan sensitif lainnya.'
                },
                {
                    q: 'Berapa kali saya bisa mengganti password?',
                    a: 'Demi keamanan, penggantian password dibatasi maksimal 1 kali dalam 24 jam.'
                }
            ]
        },
        {
            title: 'Fitur Lanjutan Email',
            icon: <ScheduleIcon sx={{ color: '#8ab4f8' }} />,
            content: [
                {
                    q: 'Apa itu fitur Schedule (Jadwal)?',
                    a: 'Fitur ini memungkinkan anda menulis email sekarang dan menjadwalkannya untuk terkirim secara otomatis di waktu yang akan datang.'
                },
                {
                    q: 'Bagaimana cara menggunakan fitur Snooze?',
                    a: 'Jika anda ingin menunda membalas email, gunakan fitur Snooze. Email akan hilang sementara dari Inbox dan muncul kembali sebagai email baru pada waktu yang anda tentukan.'
                },
                {
                    q: 'Apa itu Email Alias?',
                    a: 'Alias adalah alamat email tambahan yang mengarah ke kotak masuk yang sama. Anda bisa membuat 1 alias untuk penggunaan profesional atau departemen tertentu.'
                }
            ]
        },
        {
            title: 'Pengaturan Sesi & Perangkat',
            icon: <SmartphoneIcon sx={{ color: '#81c995' }} />,
            content: [
                {
                    q: 'Bagaimana cara mengatur durasi login (Session)?',
                    a: 'Buka "Settings" > "Session Settings". Anda bisa memilih agar akun tetap masuk (logged in) selama 1 hingga 30 hari.'
                },
                {
                    q: 'Bisakah saya menggunakan aplikasi Gmail di HP?',
                    a: 'Ya, anda bisa menggunakan aplikasi Gmail atau Outlook di HP dengan pengaturan IMAP manual. Gunakan host: mail.baktinusantara666.sch.id dan port 993 (SSL).'
                }
            ]
        }
    ];

    return (
        <Box sx={{
            minHeight: '100vh',
            bgcolor: theme.palette.background.default,
            color: theme.palette.text.primary,
            pb: 8
        }}>
            {/* Header */}
            <Box sx={{
                background: `linear-gradient(135deg, ${c.btnGradient})`,
                color: '#fff',
                py: 6,
                mb: 4,
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}>
                <Container maxWidth="lg">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <IconButton
                            onClick={() => navigate(-1)}
                            sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
                        >
                            <ArrowBackIcon />
                        </IconButton>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>
                            Panduan Penggunaan
                        </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 400, maxWidth: 600 }}>
                        Pusat bantuan dan instruksi penggunaan BaknusMail Client v2.0
                    </Typography>
                </Container>
            </Box>

            <Container maxWidth="lg">
                <Grid container spacing={4}>
                    {/* Left Side: Summary Cards */}
                    <Grid item xs={12} md={4}>
                        <Paper sx={{
                            p: 3,
                            borderRadius: 4,
                            bgcolor: c.cardBg,
                            border: `1px solid ${c.cardBorder}`,
                        }}>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                                Kontak Bantuan
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                Jika anda mengalami kendala teknis atau lupa password, silakan hubungi tim IT Support.
                            </Typography>
                            <List disablePadding>
                                <ListItem disableGutters>
                                    <ListItemIcon sx={{ minWidth: 40 }}>
                                        <WhatsAppIcon sx={{ color: '#25D366' }} />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="WhatsApp Support"
                                        secondary="0812-3456-7890"
                                    />
                                </ListItem>
                                <ListItem disableGutters>
                                    <ListItemIcon sx={{ minWidth: 40 }}>
                                        <MailIcon color="primary" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="Email Support"
                                        secondary="it@baktinusantara666.sch.id"
                                    />
                                </ListItem>
                            </List>
                            <Divider sx={{ my: 3 }} />
                            <Box sx={{ p: 2, bgcolor: 'rgba(138,180,248,0.1)', borderRadius: 2 }}>
                                <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, display: 'block', mb: 1 }}>
                                    TIPS KEAMANAN
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Jangan pernah memberikan password anda kepada siapapun, termasuk tim IT kami. Kami tidak akan pernah meminta password anda.
                                </Typography>
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Right Side: Accordions */}
                    <Grid item xs={12} md={8}>
                        <Box sx={{ mb: 4 }}>
                            {sections.map((section, idx) => (
                                <Box key={idx} sx={{ mb: 4 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                        {section.icon}
                                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                            {section.title}
                                        </Typography>
                                    </Box>
                                    {section.content.map((item, qIdx) => (
                                        <Accordion
                                            key={qIdx}
                                            sx={{
                                                bgcolor: 'background.paper',
                                                border: `1px solid ${c.borderLighter}`,
                                                boxShadow: 'none',
                                                '&:before': { display: 'none' },
                                                mb: 1,
                                                borderRadius: '12px !important',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                <Typography sx={{ fontWeight: 500, fontSize: '0.95rem' }}>
                                                    {item.q}
                                                </Typography>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ borderTop: `1px solid ${c.borderLighter}`, bgcolor: c.cardBg }}>
                                                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                                                    {item.a}
                                                </Typography>
                                            </AccordionDetails>
                                        </Accordion>
                                    ))}
                                </Box>
                            ))}
                        </Box>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
};

export default HelpPage;
