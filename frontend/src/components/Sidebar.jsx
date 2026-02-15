import React from 'react';
import {
    Box, List, ListItemButton, ListItemIcon, ListItemText,
    Typography, Badge, Button, Divider, Tooltip
} from '@mui/material';
import {
    Inbox as InboxIcon,
    StarBorder as StarIcon,
    AccessTime as SnoozedIcon,
    Send as SentIcon,
    Drafts as DraftsIcon,
    ExpandMore as ExpandIcon,
    LabelImportant as ImportantIcon,
    Delete as TrashIcon,
    Report as SpamIcon,
    AllInbox as AllMailIcon,
    Edit as ComposeIcon,
    Folder as FolderIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const folders = [
    { id: 'INBOX', label: 'Inbox', icon: InboxIcon, showBadge: true },
    { id: 'Starred', label: 'Starred', icon: StarIcon },
    { id: 'Snoozed', label: 'Snoozed', icon: SnoozedIcon },
    { id: 'Sent', label: 'Sent', icon: SentIcon },
    { id: 'Drafts', label: 'Drafts', icon: DraftsIcon },
    { divider: true },
    { id: 'Important', label: 'Important', icon: ImportantIcon },
    { id: 'All Mail', label: 'All Mail', icon: AllMailIcon },
    { id: 'Spam', label: 'Spam', icon: SpamIcon },
    { id: 'Trash', label: 'Trash', icon: TrashIcon },
];

const Sidebar = ({ currentFolder, onFolderChange, onCompose, unseenCount, miniDrawer }) => {
    const theme = useTheme();
    const c = theme.palette.custom;

    return (
        <Box sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            py: 1,
            overflow: 'hidden',
        }}>
            {/* Compose Button */}
            <Box sx={{ px: miniDrawer ? 1 : 2, mb: 2, mt: 1 }}>
                {miniDrawer ? (
                    <Tooltip title="Compose" placement="right">
                        <Button
                            onClick={onCompose}
                            sx={{
                                minWidth: 48,
                                width: 48,
                                height: 48,
                                borderRadius: '16px',
                                background: c.composeGradient,
                                color: c.composeTextColor,
                                boxShadow: '0 4px 16px rgba(194,231,255,0.2)',
                                '&:hover': {
                                    background: c.composeHoverGradient,
                                    boxShadow: '0 6px 24px rgba(194,231,255,0.3)',
                                },
                            }}
                        >
                            <ComposeIcon />
                        </Button>
                    </Tooltip>
                ) : (
                    <Button
                        onClick={onCompose}
                        startIcon={<ComposeIcon />}
                        sx={{
                            borderRadius: '16px',
                            px: 3,
                            py: 1.5,
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            background: c.composeGradient,
                            color: c.composeTextColor,
                            boxShadow: '0 4px 16px rgba(194,231,255,0.2)',
                            width: 'fit-content',
                            '&:hover': {
                                background: c.composeHoverGradient,
                                boxShadow: '0 6px 24px rgba(194,231,255,0.3)',
                                transform: 'translateY(-1px)',
                            },
                            transition: 'all 0.2s ease',
                        }}
                    >
                        Compose
                    </Button>
                )}
            </Box>

            {/* Folder List */}
            <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                <List disablePadding>
                    {folders.map((folder, index) => {
                        if (folder.divider) {
                            return <Divider key={`div-${index}`} sx={{ my: 1 }} />;
                        }

                        const Icon = folder.icon;
                        const isSelected = currentFolder === folder.id;
                        const badgeCount = folder.showBadge ? unseenCount : 0;

                        if (miniDrawer) {
                            return (
                                <Tooltip key={folder.id} title={folder.label} placement="right">
                                    <ListItemButton
                                        selected={isSelected}
                                        onClick={() => onFolderChange(folder.id)}
                                        sx={{
                                            justifyContent: 'center',
                                            px: 2,
                                            py: 1,
                                            mx: 0.5,
                                            borderRadius: '50%',
                                            minHeight: 48,
                                        }}
                                    >
                                        <Badge
                                            badgeContent={badgeCount}
                                            color="error"
                                            max={999}
                                            sx={{
                                                '& .MuiBadge-badge': {
                                                    fontSize: '0.625rem',
                                                    height: 16,
                                                    minWidth: 16,
                                                }
                                            }}
                                        >
                                            <Icon
                                                sx={{
                                                    fontSize: 20,
                                                    color: isSelected ? c.selectedColor : 'text.secondary',
                                                }}
                                            />
                                        </Badge>
                                    </ListItemButton>
                                </Tooltip>
                            );
                        }

                        return (
                            <ListItemButton
                                key={folder.id}
                                selected={isSelected}
                                onClick={() => onFolderChange(folder.id)}
                                sx={{
                                    py: 0.5,
                                    minHeight: 32,
                                    mr: 2,
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 40 }}>
                                    <Icon
                                        sx={{
                                            fontSize: 20,
                                            color: isSelected ? c.selectedColor : 'text.secondary',
                                        }}
                                    />
                                </ListItemIcon>
                                <ListItemText
                                    primary={folder.label}
                                    primaryTypographyProps={{
                                        fontSize: '0.8125rem',
                                        fontWeight: isSelected ? 600 : 400,
                                        color: isSelected ? c.selectedColor : 'text.primary',
                                    }}
                                />
                                {badgeCount > 0 && (
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            fontWeight: 600,
                                            color: isSelected ? c.selectedColor : 'text.secondary',
                                            fontSize: '0.75rem',
                                        }}
                                    >
                                        {badgeCount}
                                    </Typography>
                                )}
                            </ListItemButton>
                        );
                    })}
                </List>
            </Box>
        </Box>
    );
};

export default Sidebar;
