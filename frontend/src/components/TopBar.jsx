import React, { useState } from 'react';
import {
    AppBar, Toolbar, IconButton, Box, Typography,
    InputBase, Avatar, Menu, MenuItem, Divider, Tooltip,
    ListItemIcon, ListItemText
} from '@mui/material';
import {
    Menu as MenuIcon,
    Search as SearchIcon,
    Close as CloseIcon,
    Settings as SettingsIcon,
    Logout as LogoutIcon,
    HelpOutline as HelpIcon,
    DarkMode as DarkModeIcon,
    LightMode as LightModeIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../App';
import logo from '../assets/logo.png';
import SettingsDialog from './SettingsDialog';

const TopBar = ({ onMenuClick, onSearch, searchQuery }) => {
    const { user, logout, themeMode, toggleTheme } = useAuth();
    const theme = useTheme();
    const c = theme.palette.custom;
    const [searchValue, setSearchValue] = useState(searchQuery || '');
    const [searchFocused, setSearchFocused] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const [settingsOpen, setSettingsOpen] = useState(false);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        onSearch(searchValue);
    };

    const handleClearSearch = () => {
        setSearchValue('');
        onSearch('');
    };

    const getInitials = (name) => {
        if (!name) return '?';
        return name.charAt(0).toUpperCase();
    };

    const getAvatarColor = (name) => {
        const colors = ['#8ab4f8', '#81c995', '#f28b82', '#fdd663', '#c58af9', '#78d9ec', '#fcad70'];
        const index = (name || '').charCodeAt(0) % colors.length;
        return colors[index];
    };

    return (
        <AppBar
            position="fixed"
            elevation={0}
            sx={{
                backgroundColor: c.appBar,
                borderBottom: `1px solid ${c.borderLight}`,
                zIndex: (theme) => theme.zIndex.drawer + 1,
            }}
        >
            <Toolbar sx={{ gap: 1, px: { xs: 1, sm: 2 } }}>
                {/* Menu Button */}
                <IconButton
                    onClick={onMenuClick}
                    sx={{ color: 'text.secondary', mr: 0.5 }}
                >
                    <MenuIcon />
                </IconButton>

                {/* Logo */}
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mr: { xs: 1, sm: 3 },
                    minWidth: 'fit-content',
                }}>
                    <Box
                        component="img"
                        src={logo}
                        alt="BaknusMail"
                        sx={{
                            width: 36,
                            height: 'auto',
                        }}
                    />
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 500,
                            color: 'text.primary',
                            fontSize: '1.125rem',
                            display: { xs: 'none', sm: 'block' },
                            letterSpacing: '-0.01em',
                        }}
                    >
                        BaknusMail
                    </Typography>
                </Box>

                {/* Search Bar */}
                <Box
                    component="form"
                    onSubmit={handleSearchSubmit}
                    sx={{
                        flex: 1,
                        maxWidth: 720,
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: searchFocused ? c.searchBgFocused : c.searchBg,
                        borderRadius: '28px',
                        px: 1.5,
                        py: 0.25,
                        border: searchFocused ? `1px solid ${c.searchBorderFocused}` : `1px solid ${c.searchBorder}`,
                        transition: 'all 0.2s ease',
                        boxShadow: searchFocused ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                        '&:hover': {
                            backgroundColor: c.searchBgFocused,
                        },
                    }}
                >
                    <IconButton type="submit" size="small" sx={{ color: 'text.secondary' }}>
                        <SearchIcon fontSize="small" />
                    </IconButton>
                    <InputBase
                        placeholder="Search in mail"
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                        sx={{
                            flex: 1,
                            ml: 1,
                            color: 'text.primary',
                            fontSize: '1rem',
                            '& .MuiInputBase-input::placeholder': {
                                color: 'text.secondary',
                                opacity: 1,
                            },
                        }}
                    />
                    {searchValue && (
                        <IconButton onClick={handleClearSearch} size="small" sx={{ color: 'text.secondary' }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    )}
                </Box>

                {/* Right Actions */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
                    {/* Theme Toggle */}
                    <Tooltip title={themeMode === 'dark' ? 'Light mode' : 'Dark mode'}>
                        <IconButton onClick={toggleTheme} sx={{ color: 'text.secondary' }}>
                            {themeMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Support">
                        <IconButton sx={{ color: 'text.secondary' }}>
                            <HelpIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Settings">
                        <IconButton onClick={() => setSettingsOpen(true)} sx={{ color: 'text.secondary' }}>
                            <SettingsIcon />
                        </IconButton>
                    </Tooltip>

                    {/* User Avatar */}
                    <Tooltip title={user?.email || ''}>
                        <IconButton
                            onClick={(e) => setAnchorEl(e.currentTarget)}
                            sx={{ ml: 0.5 }}
                        >
                            <Avatar
                                src={user?.avatar || undefined}
                                sx={{
                                    width: 32,
                                    height: 32,
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    bgcolor: getAvatarColor(user?.displayName || user?.email),
                                }}
                            >
                                {getInitials(user?.displayName || user?.email)}
                            </Avatar>
                        </IconButton>
                    </Tooltip>
                </Box>

                {/* User Menu */}
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={() => setAnchorEl(null)}
                    PaperProps={{
                        sx: {
                            width: 280,
                            mt: 1,
                            borderRadius: 3,
                            bgcolor: 'background.paper',
                            border: `1px solid ${c.dialogBorder}`,
                        },
                    }}
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                >
                    <Box sx={{ px: 2, py: 1.5, textAlign: 'center' }}>
                        <Avatar
                            src={user?.avatar || undefined}
                            sx={{
                                width: 56,
                                height: 56,
                                mx: 'auto',
                                mb: 1,
                                fontSize: '1.5rem',
                                fontWeight: 600,
                                bgcolor: getAvatarColor(user?.displayName || user?.email),
                            }}
                        >
                            {getInitials(user?.displayName || user?.email)}
                        </Avatar>
                        <Typography variant="subtitle1" fontWeight={500}>
                            {user?.displayName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {user?.email}
                        </Typography>
                    </Box>
                    <Divider />
                    <MenuItem onClick={() => { setAnchorEl(null); setSettingsOpen(true); }}>
                        <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>Settings</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={toggleTheme}>
                        <ListItemIcon>
                            {themeMode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
                        </ListItemIcon>
                        <ListItemText>{themeMode === 'dark' ? 'Light mode' : 'Dark mode'}</ListItemText>
                    </MenuItem>
                    <MenuItem
                        onClick={() => { setAnchorEl(null); logout(); }}
                        sx={{ color: 'error.main' }}
                    >
                        <ListItemIcon><LogoutIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
                        <ListItemText>Sign out</ListItemText>
                    </MenuItem>
                </Menu>

                {/* Settings Dialog */}
                <SettingsDialog
                    open={settingsOpen}
                    onClose={() => setSettingsOpen(false)}
                />
            </Toolbar>
        </AppBar>
    );
};

export default TopBar;
