import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Box
} from '@mui/material';
import {
  ScreenShare,
  Window,
  Tab,
  Close
} from '@mui/icons-material';

const styles = {
  dialog: {
    '& .MuiDialog-paper': {
      backgroundColor: '#2f3136',
      color: '#ffffff',
      borderRadius: '8px',
      minWidth: '400px'
    }
  },
  dialogTitle: {
    backgroundColor: '#202225',
    padding: '16px 24px',
    '& .MuiTypography-root': {
      fontSize: '1.1rem',
      fontWeight: 600
    }
  },
  dialogContent: {
    padding: '16px 24px'
  },
  list: {
    padding: 0
  },
  listItem: {
    borderRadius: '4px',
    margin: '4px 0',
    padding: '8px 16px',
    '&:hover': {
      backgroundColor: '#36393f',
      cursor: 'pointer'
    }
  },
  listItemIcon: {
    minWidth: '40px',
    '& .MuiSvgIcon-root': {
      color: '#b9bbbe'
    }
  },
  listItemText: {
    '& .MuiTypography-root': {
      color: '#dcddde'
    }
  },
  description: {
    color: '#b9bbbe',
    fontSize: '0.9rem',
    marginBottom: '16px'
  }
};

const ScreenShareModal = ({ open, onClose, onSelect }) => {
  const handleSelect = async (type) => {
    try {
      let displayMediaOptions = {
        video: {
          cursor: 'always',
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          aspectRatio: { ideal: 16/9 }
        },
        audio: false
      };

      // Добавляем специфичные настройки в зависимости от выбора
      if (type === 'screen') {
        displayMediaOptions.video = {
          ...displayMediaOptions.video,
          displaySurface: 'monitor'
        };
      } else if (type === 'window') {
        displayMediaOptions.video = {
          ...displayMediaOptions.video,
          displaySurface: 'window'
        };
      } else if (type === 'tab') {
        displayMediaOptions.video = {
          ...displayMediaOptions.video,
          displaySurface: 'browser'
        };
      }

      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      onSelect(stream);
      onClose();
    } catch (error) {
      console.error('Error starting screen share:', error);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      sx={styles.dialog}
    >
      <DialogTitle sx={styles.dialogTitle}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography>Share your screen</Typography>
          <Close 
            sx={{ cursor: 'pointer', color: '#b9bbbe' }} 
            onClick={onClose}
          />
        </Box>
      </DialogTitle>
      <DialogContent sx={styles.dialogContent}>
        <Typography sx={styles.description}>
          Choose what you want to share
        </Typography>
        <List sx={styles.list}>
          <ListItem sx={styles.listItem} onClick={() => handleSelect('screen')}>
            <ListItemIcon sx={styles.listItemIcon}>
              <ScreenShare />
            </ListItemIcon>
            <ListItemText 
              primary="Entire Screen" 
              secondary="Share your entire screen"
              sx={styles.listItemText}
            />
          </ListItem>
          <ListItem sx={styles.listItem} onClick={() => handleSelect('window')}>
            <ListItemIcon sx={styles.listItemIcon}>
              <Window />
            </ListItemIcon>
            <ListItemText 
              primary="Application Window" 
              secondary="Share a specific window"
              sx={styles.listItemText}
            />
          </ListItem>
          <ListItem sx={styles.listItem} onClick={() => handleSelect('tab')}>
            <ListItemIcon sx={styles.listItemIcon}>
              <Tab />
            </ListItemIcon>
            <ListItemText 
              primary="Browser Tab" 
              secondary="Share a browser tab"
              sx={styles.listItemText}
            />
          </ListItem>
        </List>
      </DialogContent>
    </Dialog>
  );
};

export default ScreenShareModal; 