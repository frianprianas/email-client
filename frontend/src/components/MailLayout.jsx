import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box, Drawer, useMediaQuery, useTheme, Snackbar, Alert
} from '@mui/material';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { mailAPI } from '../api';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import MessageList from './MessageList';
import MessageView from './MessageView';
import ComposeDialog from './ComposeDialog';

const DRAWER_WIDTH = 256;

const MailLayout = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const navigate = useNavigate();
    const location = useLocation();

    const [drawerOpen, setDrawerOpen] = useState(!isMobile);
    const [currentFolder, setCurrentFolder] = useState('INBOX');
    const [messages, setMessages] = useState([]);
    const [totalMessages, setTotalMessages] = useState(0);
    const [unseenCount, setUnseenCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [composeOpen, setComposeOpen] = useState(false);
    const [composeData, setComposeData] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    const [miniDrawer, setMiniDrawer] = useState(false);
    const prevUnseenRef = useRef(null);
    const pollTimerRef = useRef(null);

    const showSnackbar = useCallback((message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
    }, []);

    const fetchMessages = useCallback(async (folder = currentFolder, page = 1) => {
        setLoading(true);
        try {
            const res = await mailAPI.getMessages(folder, page, 50);
            setMessages(res.data.messages || []);
            setTotalMessages(res.data.total || 0);
            setUnseenCount(res.data.unseen || 0);
            setTotalPages(res.data.totalPages || 0);
            setCurrentPage(page);
        } catch (error) {
            console.error('Failed to fetch messages:', error);
            showSnackbar('Failed to load messages', 'error');
        } finally {
            setLoading(false);
        }
    }, [currentFolder, showSnackbar]);

    useEffect(() => {
        fetchMessages(currentFolder, 1);
    }, [currentFolder]);

    // Auto-poll for new emails every 30 seconds
    useEffect(() => {
        // Request browser notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        const pollNewMails = async () => {
            try {
                const res = await mailAPI.getMessages('INBOX', 1, 50);
                const newUnseen = res.data.unseen || 0;

                if (prevUnseenRef.current !== null && newUnseen > prevUnseenRef.current) {
                    const diff = newUnseen - prevUnseenRef.current;
                    showSnackbar(`📬 ${diff} new email${diff > 1 ? 's' : ''} received!`, 'info');

                    // Browser notification if tab is not focused
                    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
                        new Notification('BaknusMail', {
                            body: `You have ${diff} new email${diff > 1 ? 's' : ''}`,
                            icon: '/baknus-logo.png',
                        });
                    }

                    // Auto-refresh if viewing INBOX
                    if (currentFolder === 'INBOX') {
                        setMessages(res.data.messages || []);
                        setTotalMessages(res.data.total || 0);
                        setTotalPages(res.data.totalPages || 0);
                    }
                }

                prevUnseenRef.current = newUnseen;
                setUnseenCount(newUnseen);
            } catch (err) {
                // Silent fail on poll
            }
        };

        pollTimerRef.current = setInterval(pollNewMails, 30000);

        return () => {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        };
    }, [currentFolder, showSnackbar]);

    const handleFolderChange = (folder) => {
        setCurrentFolder(folder);
        setSelectedMessage(null);
        setSearchQuery('');
        navigate('/');
        if (isMobile) setDrawerOpen(false);
    };

    const handleSearch = async (query) => {
        setSearchQuery(query);
        if (!query.trim()) {
            fetchMessages(currentFolder, 1);
            return;
        }
        setLoading(true);
        try {
            const res = await mailAPI.searchMessages(query, currentFolder);
            setMessages(res.data.messages || []);
            setTotalMessages(res.data.total || 0);
        } catch (error) {
            console.error('Search failed:', error);
            showSnackbar('Search failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleMessageSelect = async (message) => {
        // If in Drafts folder, open compose dialog with draft data
        if (currentFolder === 'Drafts') {
            try {
                const res = await mailAPI.getMessage('Drafts', message.uid);
                const draft = res.data;
                handleCompose({
                    to: draft.to || [],
                    cc: draft.cc || [],
                    bcc: draft.bcc || [],
                    subject: draft.subject || '',
                    quotedHtml: draft.html || draft.text || '',
                    isDraft: true,
                    draftUid: message.uid,
                    // Preserve reply/forward threading
                    inReplyTo: draft.inReplyTo || undefined,
                    references: draft.references || undefined,
                });
            } catch (error) {
                console.error('Failed to load draft:', error);
                showSnackbar('Failed to load draft', 'error');
            }
            return;
        }
        setSelectedMessage(message);
        navigate(`/message/${currentFolder}/${message.uid}`);
    };

    const handleBackToList = () => {
        setSelectedMessage(null);
        navigate('/');
    };

    const handleCompose = (data = null) => {
        setComposeData(data);
        setComposeOpen(true);
    };

    const handleSendComplete = () => {
        setComposeOpen(false);
        setComposeData(null);
        showSnackbar('Message sent!', 'success');
        if (currentFolder === 'Sent' || currentFolder === 'Drafts') {
            fetchMessages(currentFolder, 1);
        }
    };

    const handleSaveDraft = () => {
        setComposeOpen(false);
        setComposeData(null);
        showSnackbar('Draft saved', 'success');
        if (currentFolder === 'Drafts') {
            fetchMessages('Drafts', 1);
        }
    };

    const handleToggleStar = async (msg) => {
        try {
            const newStarred = !msg.isStarred;
            await mailAPI.toggleStar(currentFolder, msg.uid, newStarred);
            setMessages(prev => prev.map(m =>
                m.uid === msg.uid ? { ...m, isStarred: newStarred } : m
            ));
        } catch (error) {
            showSnackbar('Failed to update star', 'error');
        }
    };

    const handleToggleRead = async (msg) => {
        try {
            const newRead = !msg.isRead;
            await mailAPI.toggleRead(currentFolder, msg.uid, newRead);
            setMessages(prev => prev.map(m =>
                m.uid === msg.uid ? { ...m, isRead: newRead } : m
            ));
        } catch (error) {
            showSnackbar('Failed to update message', 'error');
        }
    };

    const handleDeleteMessage = async (msg) => {
        try {
            await mailAPI.deleteMessage(currentFolder, msg.uid);
            setMessages(prev => prev.filter(m => m.uid !== msg.uid));
            if (selectedMessage?.uid === msg.uid) {
                setSelectedMessage(null);
                navigate('/');
            }
            showSnackbar(
                currentFolder === 'Trash' ? 'Message deleted permanently' : 'Message moved to Trash',
                'success'
            );
        } catch (error) {
            showSnackbar('Failed to delete message', 'error');
        }
    };

    const handleArchive = async (msg) => {
        try {
            await mailAPI.moveMessage(msg.uid, currentFolder, 'Archive');
            setMessages(prev => prev.filter(m => m.uid !== msg.uid));
            if (selectedMessage?.uid === msg.uid) {
                setSelectedMessage(null);
                navigate('/');
            }
            showSnackbar('Message archived', 'success');
        } catch (error) {
            showSnackbar('Failed to archive message', 'error');
        }
    };

    const handleRefresh = () => {
        fetchMessages(currentFolder, currentPage);
        showSnackbar('Refreshing...', 'info');
    };

    const drawerContent = (
        <Sidebar
            currentFolder={currentFolder}
            onFolderChange={handleFolderChange}
            onCompose={() => handleCompose()}
            unseenCount={unseenCount}
            miniDrawer={miniDrawer}
        />
    );

    return (
        <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
            {/* Top Bar */}
            <TopBar
                onMenuClick={() => {
                    if (isMobile) {
                        setDrawerOpen(!drawerOpen);
                    } else {
                        setMiniDrawer(!miniDrawer);
                    }
                }}
                onSearch={handleSearch}
                searchQuery={searchQuery}
            />

            {/* Sidebar Drawer */}
            {isMobile ? (
                <Drawer
                    variant="temporary"
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    sx={{
                        '& .MuiDrawer-paper': {
                            width: DRAWER_WIDTH,
                            mt: '64px',
                        },
                    }}
                >
                    {drawerContent}
                </Drawer>
            ) : (
                <Drawer
                    variant="permanent"
                    open
                    sx={{
                        width: miniDrawer ? 72 : DRAWER_WIDTH,
                        flexShrink: 0,
                        '& .MuiDrawer-paper': {
                            width: miniDrawer ? 72 : DRAWER_WIDTH,
                            mt: '64px',
                            transition: 'width 0.2s ease',
                            overflowX: 'hidden',
                        },
                    }}
                >
                    {drawerContent}
                </Drawer>
            )}

            {/* Main Content */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    mt: '64px',
                    height: 'calc(100vh - 64px)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    ml: isMobile ? 0 : (miniDrawer ? '72px' : `${DRAWER_WIDTH}px`),
                    transition: 'margin-left 0.2s ease',
                }}
            >
                <Box sx={{
                    flexGrow: 1,
                    overflow: 'hidden',
                    bgcolor: 'background.paper',
                    borderRadius: isMobile ? 0 : '16px 0 0 0',
                    display: 'flex',
                }}>
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <MessageList
                                    messages={messages}
                                    loading={loading}
                                    currentFolder={currentFolder}
                                    onMessageSelect={handleMessageSelect}
                                    onToggleStar={handleToggleStar}
                                    onToggleRead={handleToggleRead}
                                    onDelete={handleDeleteMessage}
                                    onArchive={handleArchive}
                                    onRefresh={handleRefresh}
                                    totalMessages={totalMessages}
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={(page) => fetchMessages(currentFolder, page)}
                                />
                            }
                        />
                        <Route
                            path="/message/:folder/:uid"
                            element={
                                <MessageView
                                    folder={currentFolder}
                                    onBack={handleBackToList}
                                    onReply={(data) => handleCompose(data)}
                                    onDelete={handleDeleteMessage}
                                    onArchive={handleArchive}
                                    onToggleStar={handleToggleStar}
                                    showSnackbar={showSnackbar}
                                />
                            }
                        />
                    </Routes>
                </Box>
            </Box>

            {/* Compose Dialog */}
            <ComposeDialog
                open={composeOpen}
                onClose={() => { setComposeOpen(false); setComposeData(null); }}
                onSend={handleSendComplete}
                onSaveDraft={handleSaveDraft}
                initialData={composeData}
                showSnackbar={showSnackbar}
            />

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
                <Alert
                    onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{ borderRadius: 2 }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default MailLayout;
