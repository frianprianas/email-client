import React, { useState, useEffect } from 'react';
import {
    Box, Typography, IconButton, Tooltip, Avatar, Chip,
    CircularProgress, Divider, Button
} from '@mui/material';
import {
    ArrowBack as BackIcon,
    StarBorder as StarBorderIcon,
    Star as StarIcon,
    Delete as DeleteIcon,
    Archive as ArchiveIcon,
    Reply as ReplyIcon,
    ReplyAll as ReplyAllIcon,
    Forward as ForwardIcon,
    MoreVert as MoreIcon,
    Print as PrintIcon,
    OpenInNew as OpenIcon,
    AttachFile as AttachIcon,
    Download as DownloadIcon,
    MarkunreadMailbox as UnreadIcon,
    MoveToInbox as MoveToInboxIcon,
    AutoAwesome as AutoAwesomeIcon,
    Snooze as SnoozeIcon
} from '@mui/icons-material';
import { Menu, MenuItem } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format, parseISO, addDays, addHours, setHours, setMinutes, nextMonday } from 'date-fns';
import { useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { mailAPI, snoozeAPI } from '../api';

const getAvatarColor = (name) => {
    const colors = [
        '#8ab4f8', '#81c995', '#f28b82', '#fdd663',
        '#c58af9', '#78d9ec', '#fcad70', '#ff8bcb'
    ];
    return colors[(name || '?').charCodeAt(0) % colors.length];
};

const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
};

const MessageView = ({ folder, onBack, onReply, onDelete, onArchive, onMoveToInbox, onToggleStar, showSnackbar }) => {
    const { uid } = useParams();
    const theme = useTheme();
    const c = theme.palette.custom;
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMessage = async () => {
            setLoading(true);
            try {
                const res = await mailAPI.getMessage(folder, uid);
                setMessage(res.data);
                // Reset summary when message changes
                setSummary(null);
            } catch (error) {
                console.error('Failed to fetch message:', error);
                showSnackbar('Failed to load message', 'error');
            } finally {
                setLoading(false);
            }
        };

        if (uid) fetchMessage();
    }, [uid, folder]);

    const [summary, setSummary] = useState(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [snoozeAnchorEl, setSnoozeAnchorEl] = useState(null);

    const handleSnoozeClick = (event) => setSnoozeAnchorEl(event.currentTarget);
    const handleCloseSnooze = () => setSnoozeAnchorEl(null);

    const handleSnoozeConfirm = async (date) => {
        try {
            await snoozeAPI.snooze(folder, uid, date);
            showSnackbar('Email snoozed', 'success');
            onBack(); // Go back to list
        } catch (error) {
            console.error('Snooze failed:', error);
            showSnackbar('Failed to snooze email', 'error');
        } finally {
            handleCloseSnooze();
        }
    };

    const getSnoozeOptions = () => {
        const now = new Date();
        const tomorrow = setMinutes(setHours(addDays(now, 1), 8), 0); // 8 AM tomorrow
        const laterToday = addHours(now, 4);
        const nextWeek = setMinutes(setHours(nextMonday(now), 8), 0); // 8 AM next Monday

        return [
            { label: 'Later today (+4h)', date: laterToday },
            { label: 'Tomorrow morning (8:00 AM)', date: tomorrow },
            { label: 'Next week (Mon 8:00 AM)', date: nextWeek }
        ];
    };


    const handleSummarize = () => {
        setIsSummarizing(true);
        // Mock AI delay
        setTimeout(() => {
            const cleanText = message.text || message.html?.replace(/<[^>]*>/g, '') || '';
            const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 10).slice(0, 2);

            setSummary({
                text: sentences.join('. ') + '.',
                points: [
                    "Action required by Friday",
                    "Review attached documents"
                ]
            });
            setIsSummarizing(false);
        }, 1500);
    };

    const smartReplies = [
        "Received, thank you.",
        "I'll look into it.",
        "Can you provide more details?"
    ];

    const handleReply = () => {
        if (!message) return;
        onReply({
            to: message.from.map(f => f.address),
            subject: message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`,
            inReplyTo: message.headers?.messageId,
            references: message.headers?.references,
            quotedHtml: `<br/><br/><div style="border-left:2px solid ${c.accent};padding-left:12px;margin-left:0;color:${theme.palette.text.secondary}">
        On ${message.date ? format(new Date(message.date), 'EEE, MMM d, yyyy \'at\' h:mm a') : ''}, ${message.from?.[0]?.name || message.from?.[0]?.address} wrote:<br/>
        ${message.html || message.text}
      </div>`
        });
    };

    const handleReplyAll = () => {
        if (!message) return;
        const allRecipients = [
            ...message.from.map(f => f.address),
            ...(message.to || []).map(t => t.address),
            ...(message.cc || []).map(c => c.address),
        ].filter((v, i, a) => a.indexOf(v) === i);

        onReply({
            to: allRecipients,
            subject: message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`,
            inReplyTo: message.headers?.messageId,
            references: message.headers?.references,
            quotedHtml: `<br/><br/><div style="border-left:2px solid ${c.accent};padding-left:12px;margin-left:0;color:${theme.palette.text.secondary}">
        On ${message.date ? format(new Date(message.date), 'EEE, MMM d, yyyy \'at\' h:mm a') : ''}, ${message.from?.[0]?.name || message.from?.[0]?.address} wrote:<br/>
        ${message.html || message.text}
      </div>`
        });
    };

    const handleForward = () => {
        if (!message) return;
        onReply({
            to: [],
            subject: message.subject.startsWith('Fwd:') ? message.subject : `Fwd: ${message.subject}`,
            quotedHtml: `<br/><br/>---------- Forwarded message ---------<br/>
        From: ${message.from?.[0]?.name || ''} &lt;${message.from?.[0]?.address}&gt;<br/>
        Date: ${message.date ? format(new Date(message.date), 'EEE, MMM d, yyyy \'at\' h:mm a') : ''}<br/>
        Subject: ${message.subject}<br/>
        To: ${(message.to || []).map(t => `${t.name || ''} &lt;${t.address}&gt;`).join(', ')}<br/><br/>
        ${message.html || message.text}`
        });
    };

    const handleDownloadAttachment = (attachment) => {
        const byteCharacters = atob(attachment.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: attachment.contentType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.filename;
        link.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                <CircularProgress sx={{ color: c.accent }} />
            </Box>
        );
    }

    if (!message) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                <Typography color="text.secondary">Message not found</Typography>
            </Box>
        );
    }

    const senderName = message.from?.[0]?.name || message.from?.[0]?.address || 'Unknown';
    const senderEmail = message.from?.[0]?.address || '';

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }} className="fade-in">
            {/* Toolbar */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                px: 1,
                py: 0.5,
                borderBottom: `1px solid ${c.borderLight}`,
                gap: 0.5,
                minHeight: 48,
            }}>
                <Tooltip title="Back">
                    <IconButton size="small" onClick={onBack}>
                        <BackIcon />
                    </IconButton>
                </Tooltip>
                {(folder === 'Spam' || folder === 'Trash') && (
                    <Tooltip title="Move to Inbox">
                        <IconButton size="small" onClick={() => onMoveToInbox(message)}>
                            <MoveToInboxIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
                <Tooltip title="Archive">
                    <IconButton size="small" onClick={() => onArchive(message)}>
                        <ArchiveIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Snooze">
                    <IconButton size="small" onClick={handleSnoozeClick}>
                        <SnoozeIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => onDelete(message)}>
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Mark as unread">
                    <IconButton size="small" onClick={() => {
                        const msgData = { uid: parseInt(uid), isRead: true };
                        import('../api').then(mod => {
                            mod.mailAPI.toggleRead(folder, uid, false).then(() => {
                                showSnackbar('Marked as unread', 'success');
                            });
                        });
                    }}>
                        <UnreadIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Print">
                    <IconButton size="small" onClick={() => window.print()}>
                        <PrintIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>

            <Menu
                anchorEl={snoozeAnchorEl}
                open={Boolean(snoozeAnchorEl)}
                onClose={handleCloseSnooze}
            >
                <Box sx={{ px: 2, py: 1, borderBottom: `1px solid ${c.borderLight}` }}>
                    <Typography variant="subtitle2" color="text.secondary">Snooze until...</Typography>
                </Box>
                {getSnoozeOptions().map((opt, i) => (
                    <MenuItem key={i} onClick={() => handleSnoozeConfirm(opt.date)}>
                        {opt.label}
                    </MenuItem>
                ))}
            </Menu>

            {/* Message Content */}
            <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, sm: 4, md: 6 }, py: 3 }}>
                {/* Subject */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
                    <Typography
                        variant="h5"
                        sx={{
                            flex: 1,
                            fontWeight: 400,
                            fontSize: { xs: '1.25rem', sm: '1.5rem' },
                            color: 'text.primary',
                            lineHeight: 1.3,
                        }}
                    >
                        {message.subject}
                    </Typography>
                    <IconButton
                        onClick={() => onToggleStar({ uid: parseInt(uid), isStarred: false })}
                        sx={{ ml: 1, color: '#fdd663', flexShrink: 0 }}
                    >
                        <StarBorderIcon />
                    </IconButton>
                </Box>

                {/* Sender Info */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
                    <Avatar
                        sx={{
                            width: 40,
                            height: 40,
                            bgcolor: getAvatarColor(senderName),
                            fontSize: '1rem',
                            fontWeight: 600,
                            mr: 1.5,
                            mt: 0.5,
                        }}
                    >
                        {senderName.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                                {senderName}
                            </Typography>
                            <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.75rem' }}>
                                &lt;{senderEmail}&gt;
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                to {(message.to || []).map(t => t.name || t.address).join(', ')}
                            </Typography>
                        </Box>
                    </Box>
                    <Typography
                        variant="body2"
                        color="text.disabled"
                        sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap', ml: 2 }}
                    >
                        {message.date ? format(new Date(message.date), 'MMM d, yyyy, h:mm a') : ''}
                    </Typography>
                </Box>

                {/* AI Summary Section */}
                <Box sx={{ mb: 3 }}>
                    {!summary && !isSummarizing ? (
                        <Button
                            startIcon={<AutoAwesomeIcon />}
                            onClick={handleSummarize}
                            size="small"
                            sx={{
                                color: c.accent,
                                bgcolor: c.chipBg,
                                borderRadius: 4,
                                textTransform: 'none',
                                fontSize: '0.8125rem',
                                '&:hover': { bgcolor: c.chipHoverBg }
                            }}
                        >
                            Summarize with AI
                        </Button>
                    ) : (
                        <Box sx={{
                            p: 2,
                            borderRadius: 2,
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(138, 180, 248, 0.1)' : '#f0f7ff',
                            border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(138, 180, 248, 0.2)' : '#d0e1fd'}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <AutoAwesomeIcon sx={{ fontSize: 16, color: c.accent }} />
                                <Typography variant="subtitle2" color={c.accent}>AI Summary</Typography>
                                {isSummarizing && <CircularProgress size={12} thickness={5} sx={{ color: c.accent }} />}
                            </Box>

                            {summary ? (
                                <>
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        Key Points:
                                    </Typography>
                                    <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { mb: 0.5 } }}>
                                        {summary.points.map((pt, i) => (
                                            <li key={i}>
                                                <Typography variant="body2">{pt}</Typography>
                                            </li>
                                        ))}
                                    </Box>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                                        {summary.text}
                                    </Typography>
                                </>
                            ) : (
                                <Typography variant="body2" color="text.secondary">Generating summary...</Typography>
                            )}
                        </Box>
                    )}
                </Box>

                {/* HTML Body */}
                <Box
                    sx={{
                        '& a': { color: c.accent },
                        '& img': { maxWidth: '100%', height: 'auto' },
                        '& table': { maxWidth: '100%', overflowX: 'auto' },
                        fontSize: '0.875rem',
                        lineHeight: 1.6,
                        color: 'text.primary',
                        mb: 3,
                    }}
                    dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(message.html || message.text?.replace(/\n/g, '<br/>') || '', {
                            ADD_TAGS: ['style'],
                            ADD_ATTR: ['target'],
                        })
                    }}
                />

                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                        <Divider sx={{ mb: 2 }} />
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <AttachIcon sx={{ fontSize: 16 }} />
                            {message.attachments.length} Attachment{message.attachments.length > 1 ? 's' : ''}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {message.attachments.map((att, i) => (
                                <Box
                                    key={i}
                                    onClick={() => handleDownloadAttachment(att)}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        px: 2,
                                        py: 1,
                                        borderRadius: 2,
                                        border: `1px solid ${c.attachBorder}`,
                                        cursor: 'pointer',
                                        '&:hover': {
                                            bgcolor: c.attachHoverBg,
                                            borderColor: c.accent,
                                        },
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    <AttachIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                    <Box>
                                        <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                                            {att.filename}
                                        </Typography>
                                        <Typography variant="caption" color="text.disabled">
                                            {formatFileSize(att.size)}
                                        </Typography>
                                    </Box>
                                    <DownloadIcon sx={{ fontSize: 16, color: 'text.disabled', ml: 1 }} />
                                </Box>
                            ))}
                        </Box>
                    </Box>
                )}

                {/* Smart Replies */}
                <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {smartReplies.map((reply, index) => (
                        <Chip
                            key={index}
                            icon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
                            label={reply}
                            onClick={() => onReply({
                                to: message.from.map(f => f.address),
                                subject: message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`,
                                inReplyTo: message.headers?.messageId,
                                references: message.headers?.references,
                                // Pre-fill with smart reply
                                quotedHtml: `<p>${reply}</p><br/><br/><div style="border-left:2px solid ${c.accent};padding-left:12px;margin-left:0;color:${theme.palette.text.secondary}">
                                On ${message.date ? format(new Date(message.date), 'EEE, MMM d, yyyy \'at\' h:mm a') : ''}, ${message.from?.[0]?.name || message.from?.[0]?.address} wrote:<br/>
                                ${message.html || message.text}
                              </div>`
                            })}
                            sx={{
                                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                border: `1px solid ${c.borderLight}`,
                                cursor: 'pointer',
                                '&:hover': {
                                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                                    borderColor: c.accent
                                }
                            }}
                        />
                    ))}
                </Box>

                {/* Reply Actions */}
                <Divider sx={{ my: 3 }} />
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                        variant="outlined"
                        startIcon={<ReplyIcon />}
                        onClick={handleReply}
                        sx={{
                            borderRadius: '20px',
                            borderColor: c.replyBorder,
                            color: 'text.primary',
                            textTransform: 'none',
                            '&:hover': {
                                borderColor: c.replyHoverBorder,
                                bgcolor: c.replyHoverBg,
                            },
                        }}
                    >
                        Reply
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<ReplyAllIcon />}
                        onClick={handleReplyAll}
                        sx={{
                            borderRadius: '20px',
                            borderColor: c.replyBorder,
                            color: 'text.primary',
                            textTransform: 'none',
                            '&:hover': {
                                borderColor: c.replyHoverBorder,
                                bgcolor: c.replyHoverBg,
                            },
                        }}
                    >
                        Reply all
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<ForwardIcon />}
                        onClick={handleForward}
                        sx={{
                            borderRadius: '20px',
                            borderColor: c.replyBorder,
                            color: 'text.primary',
                            textTransform: 'none',
                            '&:hover': {
                                borderColor: c.replyHoverBorder,
                                bgcolor: c.replyHoverBg,
                            },
                        }}
                    >
                        Forward
                    </Button>
                </Box>
            </Box>
        </Box >
    );
};

export default MessageView;
