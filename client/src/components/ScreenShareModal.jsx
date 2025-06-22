import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Grid,
  Card,
  CardActionArea,
  CardMedia,
  CardContent,
  CircularProgress
} from '@mui/material';
import {
  ScreenShare,
  Window,
  Close,
  Monitor
} from '@mui/icons-material';
import { getSources, captureSource } from '../utils/desktopCapture';

const styles = {
  dialog: {
    '& .MuiDialog-paper': {
      backgroundColor: '#2f3136',
      color: '#ffffff',
      borderRadius: '8px',
      minWidth: '800px',
      maxWidth: '1000px'
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
  description: {
    color: '#b9bbbe',
    fontSize: '0.9rem',
    marginBottom: '16px'
  },
  sourceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '16px',
    width: '100%',
    padding: '8px'
  },
  sourceCard: {
    backgroundColor: '#36393f',
    borderRadius: '8px',
    transition: 'transform 0.2s ease-in-out',
    '&:hover': {
      transform: 'scale(1.02)',
      backgroundColor: '#40444b'
    }
  },
  sourceCardContent: {
    padding: '12px',
    '&:last-child': {
      paddingBottom: '12px'
    }
  },
  sourceName: {
    color: '#ffffff',
    fontSize: '0.9rem',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  sourceType: {
    color: '#b9bbbe',
    fontSize: '0.8rem'
  },
  thumbnail: {
    width: '100%',
    height: '135px',
    objectFit: 'cover',
    backgroundColor: '#202225',
    borderRadius: '4px'
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '32px',
    color: '#b9bbbe'
  },
  noSources: {
    textAlign: 'center',
    padding: '32px',
    color: '#b9bbbe'
  },
  sourceIcon: {
    width: '16px',
    height: '16px',
    marginRight: '8px'
  }
};

const ScreenShareModal = ({ open, onClose, onSelect }) => {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      loadSources();
    }
  }, [open]);

  const loadSources = async () => {
    try {
      setLoading(true);
      setError(null);
      const availableSources = await getSources();
      
      if (availableSources === null) {
        // Если не Electron или ошибка получения источников,
        // используем стандартный getDisplayMedia
        const stream = await captureSource();
        onSelect(stream);
        onClose();
        return;
      }

      setSources(availableSources);
    } catch (err) {
      console.error('Error loading sources:', err);
      setError('Failed to load screen share sources');
    } finally {
      setLoading(false);
    }
  };

  const handleSourceSelect = async (source) => {
    try {
      const stream = await captureSource(source.id);
      onSelect(stream);
      onClose();
    } catch (error) {
      console.error('Error selecting source:', error);
      setError('Failed to start screen sharing');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      sx={styles.dialog}
      maxWidth="lg"
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

        {loading ? (
          <Box sx={styles.loading}>
            <CircularProgress size={32} />
          </Box>
        ) : error ? (
          <Typography sx={styles.noSources}>
            {error}
          </Typography>
        ) : sources.length === 0 ? (
          <Typography sx={styles.noSources}>
            No sources available
          </Typography>
        ) : (
          <Box sx={styles.sourceGrid}>
            {sources.map((source) => (
              <Card key={source.id} sx={styles.sourceCard}>
                <CardActionArea onClick={() => handleSourceSelect(source)}>
                  <CardMedia
                    component="img"
                    sx={styles.thumbnail}
                    image={source.thumbnail}
                    alt={source.name}
                  />
                  <CardContent sx={styles.sourceCardContent}>
                    <Typography sx={styles.sourceName}>
                      {source.type === 'screen' ? (
                        <Monitor sx={{ fontSize: 16 }} />
                      ) : (
                        <Window sx={{ fontSize: 16 }} />
                      )}
                      {source.name}
                    </Typography>
                    <Typography sx={styles.sourceType}>
                      {source.type === 'screen' ? 'Screen' : 'Window'}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ScreenShareModal; 