import React, { useState, useEffect, useRef } from 'react';
import {
    Dialog, Box, Typography, IconButton, TextField, Autocomplete,
    Button, CircularProgress, Tooltip, Divider, Chip, Slide
} from '@mui/material';
import {
    Close as CloseIcon,
    Minimize as MinimizeIcon,
    OpenInFull as MaximizeIcon,
    CloseFullscreen as RestoreIcon,
    Send as SendIcon,
    AttachFile as AttachIcon,
    Delete as DiscardIcon,
    FormatBold as BoldIcon,
    FormatItalic as ItalicIcon,
    FormatUnderlined as UnderlineIcon,
    InsertLink as LinkIcon,
    InsertEmoticon as EmojiIcon,
    Image as ImageIcon,
    Save as SaveIcon,
    TextSnippet as TemplateIcon,
    DeleteOutline as DeleteOutlineIcon,
    Schedule as ScheduleIcon,
    ArrowDropDown as ArrowDropDownIcon
} from '@mui/icons-material';
import { Menu, MenuItem, ListItemText, ListItemIcon, Popover, ButtonGroup } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { mailAPI, contactsAPI, templatesAPI, scheduleAPI } from '../api';
import { addHours, addDays, setHours, setMinutes, nextMonday, format } from 'date-fns';
import { useAuth } from '../App';

const ComposeDialog = ({ open, onClose, onSend, onSaveDraft, initialData, showSnackbar }) => {
    const { user } = useAuth();
    const theme = useTheme();
    const c = theme.palette.custom;
    const [to, setTo] = useState([]);
    const [toInputValue, setToInputValue] = useState('');
    const [cc, setCc] = useState([]);
    const [ccInputValue, setCcInputValue] = useState('');
    const [bcc, setBcc] = useState([]);
    const [bccInputValue, setBccInputValue] = useState('');
    const [allContacts, setAllContacts] = useState([]);
    const [subject, setSubject] = useState('');
    const [showCc, setShowCc] = useState(false);
    const [showBcc, setShowBcc] = useState(false);
    const [sending, setSending] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [maximized, setMaximized] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const [draftUid, setDraftUid] = useState(null);
    const fileInputRef = useRef(null);
    const bodyRef = useRef(null);
    const bodyContentRef = useRef('');

    // Template state
    const [templates, setTemplates] = useState([]);
    const [templateAnchorEl, setTemplateAnchorEl] = useState(null);
    const [loadingTemplates, setLoadingTemplates] = useState(false);

    // Schedule state
    const [scheduleAnchorEl, setScheduleAnchorEl] = useState(null);
    const [customDate, setCustomDate] = useState('');
    const scheduleBtnRef = useRef(null);

    // Set initial content only when dialog opens or initialData changes
    useEffect(() => {
        if (open) {
            contactsAPI.getAll().then(res => {
                setAllContacts(res.data);
            }).catch(err => console.error('Failed to load contacts', err));
        }

        const formatRecipient = (r) => {
            if (!r) return '';
            if (typeof r === 'string') return r;
            // Handle {name, address} object from backend/MailLayout
            return r.name ? `${r.name} <${r.address}>` : r.address;
        };

        if (initialData) {
            // Map initial data to strings for the Autocomplete component
            setTo(initialData.to ? initialData.to.map(formatRecipient) : []);
            setSubject(initialData.subject || '');
            setDraftUid(initialData.draftUid || null);

            if (initialData.isDraft) {
                bodyContentRef.current = initialData.quotedHtml || '';
            } else {
                bodyContentRef.current = initialData.quotedHtml || '';
            }

            if (initialData.cc && initialData.cc.length > 0) {
                setCc(initialData.cc.map(formatRecipient));
                setShowCc(true);
            }

            if (initialData.bcc && initialData.bcc.length > 0) {
                setBcc(initialData.bcc.map(formatRecipient));
                setShowBcc(true);
            }
        } else {
            setTo([]);
            setCc([]);
            setBcc([]);
            setSubject('');
            // For new compose, add signature
            const sig = user?.signature;
            if (sig) {
                const sigHtml = sig.split('\n').map(l => l || '&nbsp;').join('<br>');
                bodyContentRef.current = `<br><br><div style="color:${theme.palette.text.secondary};border-top:1px solid ${c.borderLight};padding-top:8px;margin-top:8px">--<br>${sigHtml}</div>`;
            } else {
                bodyContentRef.current = '';
            }
            setShowCc(false);
            setShowBcc(false);
            setAttachments([]);
            setDraftUid(null);
        }
        // Set innerHTML directly on the DOM element
        if (bodyRef.current) {
            bodyRef.current.innerHTML = bodyContentRef.current;
        }
    }, [initialData, open]);

    // ... (rest of code)

    const getBodyContent = () => {
        return bodyRef.current ? bodyRef.current.innerHTML : bodyContentRef.current;
    };

    // ... existing refs
    const undoTimerRef = useRef(null);
    const [showUndoUI, setShowUndoUI] = useState(false);
    const [undoCount, setUndoCount] = useState(5);

    // ... existing useEffects

    // Helper to get all recipients (chips + currently typed input)
    const getRecipients = (list, inputValue) => {
        const recipients = [...list.map(extractEmail)];
        if (inputValue && inputValue.trim()) {
            recipients.push(inputValue.trim());
        }
        return [...new Set(recipients)]; // Remove duplicates
    };

    const hasContent = () => {
        const body = getBodyContent();
        const plainBody = body.replace(/<[^>]*>/g, '').trim();
        const allTo = getRecipients(to, toInputValue);
        return allTo.length > 0 || subject.trim() || plainBody;
    };

    // Helper to extract valid email string from Autocomplete value
    // Value can be "Name <email>" string OR just "email" string
    const extractEmail = (val) => {
        if (typeof val === 'string') return val;
        if (val && val.address) return val.name ? `${val.name} <${val.address}>` : val.address;
        return '';
    };

    const executeSend = async () => {
        setSending(true);
        setShowUndoUI(false);
        try {
            const toList = getRecipients(to, toInputValue);
            const ccList = getRecipients(cc, ccInputValue);
            const bccList = getRecipients(bcc, bccInputValue);

            const htmlContent = getBodyContent();

            // Use sendDraft if this was a draft, otherwise normal send
            const sendFn = draftUid ? mailAPI.sendDraft : mailAPI.sendMail;

            await sendFn({
                to: toList,
                cc: ccList.length ? ccList : undefined,
                bcc: bccList.length ? bccList : undefined,
                subject,
                html: htmlContent || '<p></p>',
                text: htmlContent.replace(/<[^>]*>/g, ''),
                attachments: attachments.map(att => ({
                    filename: att.name,
                    content: att.base64,
                    contentType: att.type
                })),
                inReplyTo: initialData?.inReplyTo,
                references: initialData?.references,
                draftUid: draftUid || undefined,
            });

            onSend();
        } catch (error) {
            console.error('Send failed:', error);
            showSnackbar('Failed to send message', 'error');
            setSending(false); // Only reset if failed, otherwise dialog closes
        }
    };

    const handleSend = () => {
        const toList = getRecipients(to, toInputValue);
        if (toList.length === 0) {
            showSnackbar('Please add at least one recipient', 'warning');
            return;
        }

        // Start Undo Flow
        setShowUndoUI(true);
        setUndoCount(5);

        // Timer for countdown
        const interval = setInterval(() => {
            setUndoCount(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Timer for actual execution
        undoTimerRef.current = setTimeout(() => {
            clearInterval(interval);
            executeSend();
        }, 5000);
    };

    const handleUndo = () => {
        if (undoTimerRef.current) {
            clearTimeout(undoTimerRef.current);
            undoTimerRef.current = null;
        }
        setShowUndoUI(false);
        setSending(false);
    };

    // Clean up timer on unmount
    useEffect(() => {
        return () => {
            if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        };
    }, []);

    const handleSaveDraft = async () => {
        setSavingDraft(true);
        try {
            const toList = getRecipients(to, toInputValue);
            const ccList = getRecipients(cc, ccInputValue);
            const bccList = getRecipients(bcc, bccInputValue);

            const htmlContent = getBodyContent();

            await mailAPI.saveDraft({
                to: toList.length ? toList : undefined,
                cc: ccList.length ? ccList : undefined,
                bcc: bccList.length ? bccList : undefined,
                subject,
                html: htmlContent || '',
                text: htmlContent ? htmlContent.replace(/<[^>]*>/g, '') : '',
                attachments: attachments.map(att => ({
                    filename: att.name,
                    content: att.base64,
                    contentType: att.type
                })),
                inReplyTo: initialData?.inReplyTo,
                references: initialData?.references,
                draftUid: draftUid || undefined,
            });

            if (onSaveDraft) {
                onSaveDraft();
            }
        } catch (error) {
            console.error('Save draft failed:', error);
            showSnackbar('Failed to save draft', 'error');
        } finally {
            setSavingDraft(false);
        }
    };

    const handleDiscard = () => {
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        onClose();
    };

    const handleCloseWithSave = async () => {
        if (undoTimerRef.current) {
            // If they close while undoing, we probably shouldn't send? 
            // Or maybe we should just let it send? 
            // Better to cancel send if they explicitly close the dialog.
            clearTimeout(undoTimerRef.current);
            onClose();
            return;
        }

        // If there's content, auto-save as draft before closing
        if (hasContent()) {
            await handleSaveDraft();
        } else {
            onClose();
        }
    };

    const handleAttach = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                setAttachments(prev => [...prev, {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    base64
                }]);
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    };

    // Template Handlers
    const handleTemplateClick = (event) => {
        setTemplateAnchorEl(event.currentTarget);
        fetchTemplates();
    };

    const handleCloseTemplateMenu = () => {
        setTemplateAnchorEl(null);
    };

    const fetchTemplates = async () => {
        setLoadingTemplates(true);
        try {
            const res = await templatesAPI.getAll();
            setTemplates(res.data);
        } catch (error) {
            console.error('Failed to fetch templates:', error);
            showSnackbar('Failed to load templates', 'error');
        } finally {
            setLoadingTemplates(false);
        }
    };

    const handleSaveAsTemplate = async () => {
        const name = prompt('Enter template name:');
        if (!name) return;

        try {
            const body = getBodyContent();
            await templatesAPI.create({
                name,
                subject,
                body,
                isHtml: true
            });
            showSnackbar('Template saved', 'success');
            fetchTemplates();
            handleCloseTemplateMenu();
        } catch (error) {
            console.error('Failed to save template:', error);
            showSnackbar('Failed to save template', 'error');
        }
    };

    const handleInsertTemplate = (template) => {
        if (template.subject && !subject) {
            setSubject(template.subject);
        }

        if (template.body) {
            const currentBody = getBodyContent();
            // Append with some spacing if body is not empty
            const newBody = currentBody + (currentBody ? '<br><br>' : '') + template.body;

            if (bodyRef.current) {
                bodyRef.current.innerHTML = newBody;
            }
            bodyContentRef.current = newBody;
        }
        handleCloseTemplateMenu();
    };

    const handleDeleteTemplate = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Delete this template?')) return;

        try {
            await templatesAPI.delete(id);
            showSnackbar('Template deleted', 'success');
            // Optimistic update
            setTemplates(prev => prev.filter(t => t.id !== id));
        } catch (error) {
            console.error('Failed to delete template:', error);
            showSnackbar('Failed to delete template', 'error');
        }
    };

    // Schedule Handlers
    const handleScheduleClick = (event) => {
        setScheduleAnchorEl(event.currentTarget);
    };

    const handleCloseSchedule = () => {
        setScheduleAnchorEl(null);
    };

    const handleScheduleSend = async (date) => {
        setSending(true);
        handleCloseSchedule();
        setShowUndoUI(false);
        try {
            const toList = getRecipients(to, toInputValue);
            const ccList = getRecipients(cc, ccInputValue);
            const bccList = getRecipients(bcc, bccInputValue);
            const htmlContent = getBodyContent();

            if (toList.length === 0) {
                showSnackbar('Please add at least one recipient', 'warning');
                setSending(false);
                return;
            }

            await scheduleAPI.schedule({
                to: toList,
                cc: ccList.length ? ccList : undefined,
                bcc: bccList.length ? bccList : undefined,
                subject,
                html: htmlContent || '<p></p>',
                text: htmlContent.replace(/<[^>]*>/g, ''),
                attachments: attachments.map(att => ({
                    filename: att.name,
                    content: att.base64,
                    contentType: att.type
                })),
                inReplyTo: initialData?.inReplyTo,
                references: initialData?.references,
                scheduledTime: date
            });

            showSnackbar(`Email scheduled for ${format(date, 'MMM d, h:mm a')}`, 'success');
            onSend(); // Close dialog
        } catch (error) {
            console.error('Schedule failed:', error);
            showSnackbar('Failed to schedule email', 'error');
            setSending(false);
        }
    };

    const getScheduleOptions = () => {
        const now = new Date();
        const tomorrow = setMinutes(setHours(addDays(now, 1), 8), 0);
        const tomorrowAfternoon = setMinutes(setHours(addDays(now, 1), 13), 0);
        const nextWeek = setMinutes(setHours(nextMonday(now), 8), 0);

        return [
            { label: 'Tomorrow morning', date: tomorrow },
            { label: 'Tomorrow afternoon', date: tomorrowAfternoon },
            { label: 'Monday morning', date: nextWeek }
        ];
    };

    if (!open) return null;

    const isDraftMode = initialData?.isDraft || draftUid;

    return (
        <Box
            sx={{
                position: 'fixed',
                bottom: 0,
                right: maximized ? 0 : 80,
                width: maximized ? '100%' : { xs: '100%', sm: 560 },
                height: maximized ? '100%' : { xs: '100%', sm: 520 },
                zIndex: 1400,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: maximized ? 0 : '12px 12px 0 0',
                overflow: 'hidden',
                boxShadow: theme.palette.mode === 'dark' ? '0 8px 40px rgba(0,0,0,0.5)' : '0 8px 40px rgba(0,0,0,0.15)',
                bgcolor: c.composeBg,
                border: `1px solid ${c.dialogBorder}`,
                animation: 'fadeIn 0.2s ease',
            }}
        >
            {/* Header */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                px: 2,
                py: 1,
                bgcolor: c.composeHeaderBg,
                cursor: 'pointer',
                borderBottom: `1px solid ${c.borderLight}`,
            }}>
                <Typography sx={{ flex: 1, fontSize: '0.875rem', fontWeight: 500 }}>
                    {isDraftMode ? 'Draft' :
                        initialData?.subject ? (
                            initialData.subject.startsWith('Re:') ? 'Reply' :
                                initialData.subject.startsWith('Fwd:') ? 'Forward' :
                                    'New Message'
                        ) : 'New Message'}
                </Typography>
                <IconButton size="small" onClick={() => setMaximized(!maximized)} sx={{ color: 'text.secondary' }}>
                    {maximized ? <RestoreIcon sx={{ fontSize: 16 }} /> : <MaximizeIcon sx={{ fontSize: 16 }} />}
                </IconButton>
                <IconButton size="small" onClick={handleCloseWithSave} sx={{ color: 'text.secondary' }}>
                    <CloseIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Box>

            {showUndoUI ? (
                <Box sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    bgcolor: 'rgba(0,0,0,0.02)'
                }}>
                    <CircularProgress variant="determinate" value={(5 - undoCount) * 20} size={60} thickness={4} sx={{ color: c.accent }} />
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>Sending...</Typography>
                        <Typography variant="body2" color="text.secondary">Sending in {undoCount}s</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            onClick={handleUndo}
                            startIcon={<CloseIcon />}
                            sx={{ borderRadius: 8, px: 4, borderColor: c.borderLight, color: 'text.primary' }}
                        >
                            Undo
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => {
                                clearTimeout(undoTimerRef.current);
                                executeSend();
                            }}
                            endIcon={<SendIcon />}
                            sx={{ borderRadius: 8, px: 4, background: c.btnGradient }}
                        >
                            Send Now
                        </Button>
                    </Box>
                </Box>
            ) : (
                <>
                    {/* To/Cc/Bcc Fields */}
                    <Box sx={{ px: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', py: 0.5, borderBottom: `1px solid ${c.borderLight}` }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mr: 1, minWidth: 28, fontSize: '0.8125rem' }}>To</Typography>
                            <Autocomplete
                                multiple
                                freeSolo
                                fullWidth
                                options={allContacts.map((c) => c.name ? `${c.name} <${c.email}>` : c.email)}
                                value={to}
                                onChange={(event, newValue) => setTo(newValue)}
                                inputValue={toInputValue}
                                onInputChange={(event, newInputValue) => setToInputValue(newInputValue)}
                                renderTags={(value, getTagProps) =>
                                    value.map((option, index) => {
                                        const { key, ...tagProps } = getTagProps({ index });
                                        return (
                                            <Chip
                                                key={key}
                                                variant="outlined"
                                                label={option}
                                                size="small"
                                                {...tagProps}
                                                sx={{ borderRadius: 1, height: 24, fontSize: '0.8125rem', mr: 0.5 }}
                                            />
                                        );
                                    })
                                }
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        variant="standard"
                                        placeholder={to.length === 0 ? "Recipients" : ""}
                                        InputProps={{ ...params.InputProps, disableUnderline: true }}
                                        sx={{
                                            '& .MuiInput-input': {
                                                fontSize: '0.875rem',
                                                color: 'text.primary',
                                                py: 0.5
                                            }
                                        }}
                                    />
                                )}
                            />
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                {!showCc && (
                                    <Typography
                                        variant="body2"
                                        sx={{ cursor: 'pointer', color: 'text.secondary', '&:hover': { color: 'text.primary' }, fontSize: '0.8125rem' }}
                                        onClick={() => setShowCc(true)}
                                    >
                                        Cc
                                    </Typography>
                                )}
                                {!showBcc && (
                                    <Typography
                                        variant="body2"
                                        sx={{ cursor: 'pointer', color: 'text.secondary', '&:hover': { color: 'text.primary' }, fontSize: '0.8125rem' }}
                                        onClick={() => setShowBcc(true)}
                                    >
                                        Bcc
                                    </Typography>
                                )}
                            </Box>
                        </Box>

                        {showCc && (
                            <Box sx={{ display: 'flex', alignItems: 'center', py: 0.5, borderBottom: `1px solid ${c.borderLight}` }}>
                                <Typography variant="body2" color="text.secondary" sx={{ mr: 1, minWidth: 28, fontSize: '0.8125rem' }}>Cc</Typography>
                                <Autocomplete
                                    multiple
                                    freeSolo
                                    fullWidth
                                    options={allContacts.map((c) => c.name ? `${c.name} <${c.email}>` : c.email)}
                                    value={cc}
                                    onChange={(event, newValue) => setCc(newValue)}
                                    inputValue={ccInputValue}
                                    onInputChange={(event, newInputValue) => setCcInputValue(newInputValue)}
                                    renderTags={(value, getTagProps) =>
                                        value.map((option, index) => {
                                            const { key, ...tagProps } = getTagProps({ index });
                                            return (
                                                <Chip
                                                    key={key}
                                                    variant="outlined"
                                                    label={option}
                                                    size="small"
                                                    {...tagProps}
                                                    sx={{ borderRadius: 1, height: 24, fontSize: '0.8125rem', mr: 0.5 }}
                                                />
                                            );
                                        })
                                    }
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            variant="standard"
                                            InputProps={{ ...params.InputProps, disableUnderline: true }}
                                            sx={{ '& .MuiInput-input': { fontSize: '0.875rem', py: 0.5 } }}
                                        />
                                    )}
                                />
                            </Box>
                        )}

                        {showBcc && (
                            <Box sx={{ display: 'flex', alignItems: 'center', py: 0.5, borderBottom: `1px solid ${c.borderLight}` }}>
                                <Typography variant="body2" color="text.secondary" sx={{ mr: 1, minWidth: 28, fontSize: '0.8125rem' }}>Bcc</Typography>
                                <Autocomplete
                                    multiple
                                    freeSolo
                                    fullWidth
                                    options={allContacts.map((c) => c.name ? `${c.name} <${c.email}>` : c.email)}
                                    value={bcc}
                                    onChange={(event, newValue) => setBcc(newValue)}
                                    inputValue={bccInputValue}
                                    onInputChange={(event, newInputValue) => setBccInputValue(newInputValue)}
                                    renderTags={(value, getTagProps) =>
                                        value.map((option, index) => {
                                            const { key, ...tagProps } = getTagProps({ index });
                                            return (
                                                <Chip
                                                    key={key}
                                                    variant="outlined"
                                                    label={option}
                                                    size="small"
                                                    {...tagProps}
                                                    sx={{ borderRadius: 1, height: 24, fontSize: '0.8125rem', mr: 0.5 }}
                                                />
                                            );
                                        })
                                    }
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            variant="standard"
                                            InputProps={{ ...params.InputProps, disableUnderline: true }}
                                            sx={{ '& .MuiInput-input': { fontSize: '0.875rem', py: 0.5 } }}
                                        />
                                    )}
                                />
                            </Box>
                        )}

                        {/* Subject */}
                        <Box sx={{ py: 0.75, borderBottom: `1px solid ${c.borderLight}` }}>
                            <TextField
                                fullWidth
                                variant="standard"
                                placeholder="Subject"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                InputProps={{ disableUnderline: true }}
                                sx={{ '& .MuiInput-input': { fontSize: '0.875rem', py: 0.5 } }}
                            />
                        </Box>
                    </Box>

                    {/* Body Editor - uncontrolled contentEditable */}
                    <Box
                        ref={bodyRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(e) => {
                            bodyContentRef.current = e.currentTarget.innerHTML;
                        }}
                        sx={{
                            flex: 1,
                            px: 2,
                            py: 1.5,
                            fontSize: '0.875rem',
                            color: 'text.primary',
                            overflowY: 'auto',
                            outline: 'none',
                            lineHeight: 1.6,
                            '&:empty:before': {
                                content: '"Type your message here..."',
                                color: c.placeholderColor,
                            },
                            '& a': { color: c.accent },
                        }}
                    />

                    {/* Attachments */}
                    {attachments.length > 0 && (
                        <Box sx={{ px: 2, py: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5, borderTop: `1px solid ${c.borderLight}` }}>
                            {attachments.map((att, i) => (
                                <Chip
                                    key={i}
                                    icon={<AttachIcon sx={{ fontSize: 14 }} />}
                                    label={`${att.name} (${formatFileSize(att.size)})`}
                                    onDelete={() => removeAttachment(i)}
                                    size="small"
                                    sx={{
                                        bgcolor: c.chipBg,
                                        borderRadius: 2,
                                        '& .MuiChip-label': { fontSize: '0.75rem' },
                                    }}
                                />
                            ))}
                        </Box>
                    )}

                    {/* Footer Actions */}
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 2,
                        py: 1,
                        borderTop: `1px solid ${c.borderLight}`,
                    }}>
                        <ButtonGroup variant="contained" ref={scheduleBtnRef} sx={{ borderRadius: '20px', boxShadow: 'none' }}>
                            <Button
                                onClick={handleSend}
                                disabled={sending || savingDraft}
                                startIcon={sending ? <CircularProgress size={16} /> : <SendIcon />}
                                sx={{
                                    borderTopLeftRadius: '20px',
                                    borderBottomLeftRadius: '20px',
                                    pl: 3,
                                    pr: 2,
                                    py: 0.75,
                                    fontSize: '0.875rem',
                                    fontWeight: 500,
                                    background: c.btnGradient,
                                    borderColor: 'rgba(255,255,255,0.2) !important',
                                    '&:hover': {
                                        background: c.btnHoverGradient,
                                    },
                                }}
                            >
                                Send
                            </Button>
                            <Button
                                size="small"
                                onClick={handleScheduleClick}
                                disabled={sending || savingDraft}
                                sx={{
                                    borderTopRightRadius: '20px',
                                    borderBottomRightRadius: '20px',
                                    pl: 1,
                                    pr: 1,
                                    py: 0.75,
                                    background: c.btnGradient,
                                    '&:hover': {
                                        background: c.btnHoverGradient,
                                    },
                                }}
                            >
                                <ArrowDropDownIcon />
                            </Button>
                        </ButtonGroup>

                        <Menu
                            anchorEl={scheduleAnchorEl}
                            open={Boolean(scheduleAnchorEl)}
                            onClose={handleCloseSchedule}
                            anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                            transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                        >
                            <Box sx={{ px: 2, py: 1, borderBottom: `1px solid ${c.borderLight}` }}>
                                <Typography variant="subtitle2" color="text.secondary">Schedule send</Typography>
                            </Box>
                            {getScheduleOptions().map((opt, i) => (
                                <MenuItem key={i} onClick={() => handleScheduleSend(opt.date)}>
                                    <ListItemText primary={opt.label} secondary={format(opt.date, 'MMM d, h:mm a')} />
                                </MenuItem>
                            ))}
                        </Menu>

                        <Box sx={{ display: 'flex', ml: 1, gap: 0 }}>
                            <Tooltip title="Save draft">
                                <IconButton
                                    size="small"
                                    onClick={handleSaveDraft}
                                    disabled={sending || savingDraft}
                                    sx={{ color: 'text.secondary' }}
                                >
                                    {savingDraft ? <CircularProgress size={16} /> : <SaveIcon fontSize="small" />}
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Attach files">
                                <IconButton size="small" onClick={handleAttach} sx={{ color: 'text.secondary' }}>
                                    <AttachIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Insert link">
                                <IconButton size="small" sx={{ color: 'text.secondary' }}>
                                    <LinkIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Insert emoji">
                                <IconButton size="small" sx={{ color: 'text.secondary' }}>
                                    <EmojiIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Templates">
                                <IconButton
                                    size="small"
                                    onClick={handleTemplateClick}
                                    sx={{ color: 'text.secondary' }}
                                >
                                    <TemplateIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>

                        <Menu
                            anchorEl={templateAnchorEl}
                            open={Boolean(templateAnchorEl)}
                            onClose={handleCloseTemplateMenu}
                            anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                            transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                        >
                            <MenuItem onClick={handleSaveAsTemplate}>
                                <ListItemIcon><SaveIcon fontSize="small" /></ListItemIcon>
                                <ListItemText>Save draft as template</ListItemText>
                            </MenuItem>
                            <Divider />
                            {loadingTemplates ? (
                                <MenuItem disabled><CircularProgress size={16} /></MenuItem>
                            ) : templates.length === 0 ? (
                                <MenuItem disabled><ListItemText>No templates found</ListItemText></MenuItem>
                            ) : (
                                templates.map(template => (
                                    <MenuItem key={template.id} onClick={() => handleInsertTemplate(template)}>
                                        <ListItemText primary={template.name} secondary={template.subject} />
                                        <IconButton size="small" onClick={(e) => handleDeleteTemplate(e, template.id)}>
                                            <DeleteOutlineIcon fontSize="small" />
                                        </IconButton>
                                    </MenuItem>
                                ))
                            )}
                        </Menu>

                        <Box sx={{ flex: 1 }} />

                        <Tooltip title="Discard draft">
                            <IconButton size="small" onClick={handleDiscard} sx={{ color: 'text.secondary' }}>
                                <DiscardIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </>
            )}

            {/* Hidden file input */}
            <input

                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={handleFileChange}
            />
        </Box>
    );
};

export default ComposeDialog;
