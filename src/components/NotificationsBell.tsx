import { useState } from 'react';
import {
  Badge, Box, Button, Divider, IconButton, List, ListItem, ListItemText,
  Popover, Stack, Tooltip, Typography, alpha,
} from '@mui/material';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { useNotifications, type NotificationRecord } from './Notifier';

const SEVERITY_COLOR: Record<string, string> = {
  success: '#00E676',
  info:    '#4FC3F7',
  warning: '#FFB300',
  error:   '#FF5252',
};

function severityIcon(s: NotificationRecord['severity']) {
  switch (s) {
    case 'success': return <CheckCircleOutlineIcon fontSize="small" />;
    case 'warning': return <WarningAmberOutlinedIcon fontSize="small" />;
    case 'error':   return <ErrorOutlineOutlinedIcon fontSize="small" />;
    default:        return <InfoOutlinedIcon fontSize="small" />;
  }
}

function timeAgo(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'just now';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function NotificationsBell() {
  const { history, unread, markAllRead, remove, clear } = useNotifications();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = !!anchorEl;

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    if (unread > 0) markAllRead();
  };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton onClick={handleOpen} size="small" aria-label={`Notifications (${unread} unread)`}>
          <Badge
            badgeContent={unread}
            color="error"
            overlap="circular"
            max={99}
          >
            {unread > 0
              ? <NotificationsActiveOutlinedIcon fontSize="small" />
              : <NotificationsNoneOutlinedIcon fontSize="small" />}
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 360, maxWidth: '90vw', mt: 0.5 } }}
      >
        <Stack
          direction="row"
          alignItems="center"
          sx={{
            px: 2, py: 1.25,
            position: 'sticky', top: 0, zIndex: 1,
            bgcolor: 'background.paper',
            borderBottom: (t) => `1px solid ${t.palette.divider}`,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
            Notifications
          </Typography>
          {history.length > 0 && (
            <Button size="small" onClick={clear} sx={{ minWidth: 0 }}>Clear all</Button>
          )}
        </Stack>

        {history.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center', px: 2 }}>
            <NotificationsNoneOutlinedIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              You're all caught up
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Save, error, and status messages will land here.
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ p: 0, maxHeight: 420, overflow: 'auto' }}>
            {history.map((n) => {
              const color = SEVERITY_COLOR[n.severity] || SEVERITY_COLOR.info;
              return (
                <ListItem
                  key={n.id}
                  alignItems="flex-start"
                  sx={{
                    px: 2, py: 1.25,
                    borderBottom: (t) => `1px solid ${t.palette.divider}`,
                    bgcolor: n.read ? 'transparent' : (t) => alpha(color, t.palette.mode === 'dark' ? 0.06 : 0.05),
                    '&:last-of-type': { borderBottom: 0 },
                  }}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => remove(n.id)}
                      aria-label="Dismiss notification"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <Box sx={{
                    width: 28, height: 28, borderRadius: 1, mr: 1.25,
                    display: 'grid', placeItems: 'center',
                    flexShrink: 0,
                    bgcolor: (t) => alpha(color, t.palette.mode === 'dark' ? 0.18 : 0.14),
                    color,
                  }}>
                    {severityIcon(n.severity)}
                  </Box>
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontWeight: n.read ? 500 : 600, pr: 3 }}>
                        {n.message}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {timeAgo(n.at)}
                      </Typography>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </Popover>
    </>
  );
}
