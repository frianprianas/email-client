import React, { useState } from 'react';
import {
    Box, Typography, Checkbox, IconButton, Tooltip,
    LinearProgress, Divider, Menu, MenuItem, ListItemIcon,
    ListItemText
} from '@mui/material';
import {
    StarBorder as StarBorderIcon,
    Star as StarIcon,
    Delete as DeleteIcon,
    Archive as ArchiveIcon,
    MarkunreadMailbox as UnreadIcon,
    DraftsOutlined as ReadIcon,
    Refresh as RefreshIcon,
    NavigateBefore as PrevIcon,
    NavigateNext as NextIcon,
    MoreVert as MoreIcon,
    AttachFile as AttachIcon,
    LabelImportant as ImportantIcon,
    LabelImportantOutlined as ImportantOutlineIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { format, isToday, isThisYear, parseISO } from 'date-fns';

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    if (isToday(date)) {
        return format(date, 'h:mm a');
    }
    if (isThisYear(date)) {
        return format(date, 'MMM d');
    }
    return format(date, 'MM/dd/yy');
};

const getSnippet = (subject) => {
    if (!subject) return '';
    return subject.length > 60 ? subject.substring(0, 60) + '...' : subject;
};

const getAvatarColor = (name) => {
    const colors = [
        '#8ab4f8', '#81c995', '#f28b82', '#fdd663',
        '#c58af9', '#78d9ec', '#fcad70', '#ff8bcb',
        '#a8dab5', '#f0b37e'
    ];
    const code = (name || '?').charCodeAt(0);
    return colors[code % colors.length];
};

const MessageList = ({
    messages,
    loading,
    currentFolder,
    onMessageSelect,
    onToggleStar,
    onToggleRead,
    onDelete,
    onArchive,
    onRefresh,
    totalMessages,
    currentPage,
    totalPages,
    onPageChange
}) => {
    const theme = useTheme();
    const c = theme.palette.custom;
    const [selected, setSelected] = useState([]);
    const [hoveredId, setHoveredId] = useState(null);

    const handleSelectAll = (checked) => {
        if (checked) {
            setSelected(messages.map(m => m.uid));
        } else {
            setSelected([]);
        }
    };

    const handleSelect = (uid, e) => {
        e.stopPropagation();
        setSelected(prev =>
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    };

    const folderDisplayName = {
        'INBOX': 'Inbox',
        'Sent': 'Sent',
        'Drafts': 'Drafts',
        'Trash': 'Trash',
        'Spam': 'Spam',
        'Starred': 'Starred',
        'Important': 'Important',
        'All Mail': 'All Mail',
        'Archive': 'Archive',
        'Snoozed': 'Snoozed',
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
            {/* Toolbar */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                px: 1,
                py: 0.5,
                borderBottom: `1px solid ${c.borderLight}`,
                minHeight: 48,
            }}>
                <Checkbox
                    size="small"
                    checked={selected.length === messages.length && messages.length > 0}
                    indeterminate={selected.length > 0 && selected.length < messages.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    sx={{ color: 'text.disabled' }}
                />

                {selected.length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                        <Tooltip title="Archive">
                            <IconButton size="small" onClick={() => selected.forEach(uid => {
                                const msg = messages.find(m => m.uid === uid);
                                if (msg) onArchive(msg);
                            })}>
                                <ArchiveIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => selected.forEach(uid => {
                                const msg = messages.find(m => m.uid === uid);
                                if (msg) onDelete(msg);
                            })}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Mark as read">
                            <IconButton size="small" onClick={() => selected.forEach(uid => {
                                const msg = messages.find(m => m.uid === uid);
                                if (msg) onToggleRead(msg);
                            })}>
                                <ReadIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                        <Tooltip title="Refresh">
                            <IconButton size="small" onClick={onRefresh}>
                                <RefreshIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}

                <Box sx={{ flex: 1 }} />

                {/* Pagination */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                        {totalMessages > 0 ? (
                            `${((currentPage - 1) * 50) + 1}-${Math.min(currentPage * 50, totalMessages)} of ${totalMessages}`
                        ) : (
                            'No messages'
                        )}
                    </Typography>
                    <IconButton
                        size="small"
                        disabled={currentPage <= 1}
                        onClick={() => onPageChange(currentPage - 1)}
                    >
                        <PrevIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        disabled={currentPage >= totalPages}
                        onClick={() => onPageChange(currentPage + 1)}
                    >
                        <NextIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Box>

            {/* Loading indicator */}
            {loading && <LinearProgress sx={{ height: 2 }} />}

            {/* Message List */}
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
                {!loading && messages.length === 0 && (
                    <Box sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        py: 8,
                        color: 'text.secondary',
                    }}>
                        <Box sx={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            bgcolor: c.emptyBg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 2,
                        }}>
                            <ArchiveIcon sx={{ fontSize: 40, opacity: 0.3 }} />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 400, mb: 0.5 }}>
                            No messages in {folderDisplayName[currentFolder] || currentFolder}
                        </Typography>
                        <Typography variant="body2" color="text.disabled">
                            Messages that appear here will show up in this view
                        </Typography>
                    </Box>
                )}

                {messages.map((msg, index) => {
                    const isSelected = selected.includes(msg.uid);
                    const isHovered = hoveredId === msg.uid;

                    // In Sent/Drafts folder, show recipient (To) instead of sender (From)
                    const isSentFolder = currentFolder === 'Sent' || currentFolder === 'Drafts';
                    const displayPerson = isSentFolder
                        ? (msg.to?.[0] || {})
                        : (msg.from?.[0] || {});

                    const personName = displayPerson.name || displayPerson.address || 'Unknown';
                    const displayName = isSentFolder
                        ? `To: ${personName}`
                        : personName;
                    const displayInitial = (displayPerson.name || displayPerson.address || '?').charAt(0).toUpperCase();

                    return (
                        <Box
                            key={msg.uid}
                            onClick={() => onMessageSelect(msg)}
                            onMouseEnter={() => setHoveredId(msg.uid)}
                            onMouseLeave={() => setHoveredId(null)}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                px: 1,
                                py: 0.5,
                                cursor: 'pointer',
                                borderBottom: `1px solid ${c.borderLighter}`,
                                backgroundColor: isSelected
                                    ? c.selectedMsgBg
                                    : msg.isRead
                                        ? 'transparent'
                                        : c.unreadBg,
                                '&:hover': {
                                    backgroundColor: isSelected
                                        ? c.selectedMsgHoverBg
                                        : c.msgHoverBg,
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                },
                                transition: 'background-color 0.15s ease',
                                minHeight: 44,
                            }}
                        >
                            {/* Checkbox */}
                            <Checkbox
                                size="small"
                                checked={isSelected}
                                onClick={(e) => handleSelect(msg.uid, e)}
                                sx={{
                                    color: 'text.disabled',
                                    p: 0.5,
                                    opacity: isSelected || isHovered ? 1 : 0.5,
                                }}
                            />

                            {/* Star */}
                            <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); onToggleStar(msg); }}
                                sx={{
                                    p: 0.5,
                                    color: msg.isStarred ? '#fdd663' : 'text.disabled',
                                }}
                            >
                                {msg.isStarred ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                            </IconButton>

                            {/* Avatar */}
                            <Box sx={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                bgcolor: getAvatarColor(personName),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mr: 1.5,
                                flexShrink: 0,
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                color: '#fff',
                            }}>
                                {displayInitial}
                            </Box>

                            {/* Sender / Recipient */}
                            <Typography
                                sx={{
                                    width: { xs: 80, sm: 120, md: 180 },
                                    flexShrink: 0,
                                    fontSize: '0.8125rem',
                                    fontWeight: msg.isRead ? 400 : 700,
                                    color: msg.isRead ? 'text.secondary' : 'text.primary',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    mr: 2,
                                }}
                            >
                                {displayName}
                            </Typography>

                            {/* Subject & Snippet */}
                            <Box sx={{
                                flex: 1,
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: 0.5,
                            }}>
                                <Typography
                                    sx={{
                                        fontSize: '0.8125rem',
                                        fontWeight: msg.isRead ? 400 : 600,
                                        color: msg.isRead ? 'text.secondary' : 'text.primary',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                        maxWidth: '60%',
                                    }}
                                >
                                    {msg.subject}
                                </Typography>
                            </Box>

                            {/* Attachment indicator */}
                            {msg.hasAttachments && (
                                <AttachIcon sx={{ fontSize: 16, color: 'text.disabled', mx: 0.5 }} />
                            )}

                            {/* Action buttons on hover */}
                            {isHovered ? (
                                <Box sx={{ display: 'flex', gap: 0, flexShrink: 0 }}>
                                    <Tooltip title="Archive">
                                        <IconButton
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); onArchive(msg); }}
                                            sx={{ color: 'text.secondary' }}
                                        >
                                            <ArchiveIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                        <IconButton
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); onDelete(msg); }}
                                            sx={{ color: 'text.secondary' }}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title={msg.isRead ? 'Mark as unread' : 'Mark as read'}>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); onToggleRead(msg); }}
                                            sx={{ color: 'text.secondary' }}
                                        >
                                            {msg.isRead ? <UnreadIcon fontSize="small" /> : <ReadIcon fontSize="small" />}
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            ) : (
                                // Date
                                <Typography
                                    sx={{
                                        fontSize: '0.75rem',
                                        fontWeight: msg.isRead ? 400 : 600,
                                        color: msg.isRead ? 'text.disabled' : 'text.primary',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                        ml: 1,
                                    }}
                                >
                                    {formatDate(msg.date)}
                                </Typography>
                            )}
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
};

export default MessageList;
