import React, { useState, useEffect, useRef, useMemo, useCallback, useContext } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  AppBar,
  Toolbar,
  IconButton,
  ListItemIcon,
  Divider,
  Slider,
  Switch,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Mic,
  MicOff,
  VolumeUp,
  VolumeOff,
  Person,
  Tag,
  PhoneDisabled,
  ScreenShare,
  StopScreenShare,
  VolumeOffRounded,
  Videocam,
  VideocamOff,
  VolumeUpRounded,
  Hearing,
  NoiseAware,
  NoiseControlOff,
  ExpandMore,
  HeadsetOff,
  Headset
} from '@mui/icons-material';
import { Device } from 'mediasoup-client';
import { io } from 'socket.io-client';
import { NoiseSuppressionManager } from './utils/noiseSuppression';
import voiceDetectorWorklet from './utils/voiceDetector.worklet.js?url';


const config = {
  server: {
    url: 'https://4931257-dv98943.twc1.net'
  },
  iceServers: [
    {
      urls: ['stun:185.119.59.23:3478']
    },
    // {
    //   urls: ['stun:stun.l.google.com:19302']
    // },
    {
      urls: ['turn:185.119.59.23:3478?transport=udp'],
      username: 'test',
      credential: 'test123'
    },
    {
      urls: ['turn:185.119.59.23:3478?transport=tcp'],
      username: 'test',
      credential: 'test123'
    },
    // {
    //   urls: ['stun:stun1.l.google.com:19302']
    // },
    // {
    //   urls: ['stun:stun2.l.google.com:19302']
    // }
  ],
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 2,
    volume: 1.0,
    latency: 0,
    suppressLocalAudioPlayback: true,
    advanced: [
      {
        echoCancellationType: 'system',
        noiseSuppression: { level: 'high' },
        autoGainControl: { level: 'high' },
        googEchoCancellation: true,
        googEchoCancellation2: true,
        googAutoGainControl: true,
        googAutoGainControl2: true,
        googNoiseSuppression: true,
        googNoiseSuppression2: true,
        googHighpassFilter: true,
        googTypingNoiseDetection: true,
        googAudioMirroring: false,
        googDucking: true,
        googNoiseReduction: true,
        googExperimentalAutoGainControl: true,
        googExperimentalNoiseSuppression: true,
        googBeamforming: true,
        googArrayGeometry: true,
        googAudioNetworkAdaptator: true,
        googDAEchoCancellation: true,
        googExperimentalEchoCancellation: true
      }
    ]
  }
};

// Add Discord-like styles
const styles = {
  root: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#36393f',
    color: '#dcddde',
    '@keyframes pulse': {
      '0%': {
        boxShadow: '0 0 0 2px rgba(59, 165, 92, 0.8)'
      },
      '50%': {
        boxShadow: '0 0 0 4px rgba(59, 165, 92, 0.4)'
      },
      '100%': {
        boxShadow: '0 0 0 2px rgba(59, 165, 92, 0.8)'
      }
    }
  },
  appBar: {
    backgroundColor: '#202225',
    boxShadow: 'none',
    borderBottom: '1px solid #292b2f'
  },
  toolbar: {
    minHeight: '48px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    '@media (max-width: 600px)': {
      padding: '0 8px',
    }
  },
  channelName: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#ffffff',
    '& .MuiSvgIcon-root': {
      color: '#72767d'
    },
    '@media (max-width: 600px)': {
      fontSize: '0.9rem',
    }
  },
  container: {
    flex: 1,
    padding: '16px',
    backgroundColor: '#313338',
    display: 'flex',
    flexDirection: 'column',
    '@media (max-width: 600px)': {
      padding: '8px',
    }
  },
  videoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '8px',
    padding: '16px',
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  videoItem: {
    backgroundColor: '#2B2D31',
    borderRadius: '8px',
    overflow: 'hidden',
    position: 'relative',
    aspectRatio: '16/9',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'box-shadow 0.3s ease-in-out',
    '&.speaking': {
      '&::after': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        border: '2px solid #3ba55c',
        borderRadius: '8px',
        animation: 'pulse 2s infinite',
        pointerEvents: 'none',
        zIndex: 1
      }
    }
  },
  '@keyframes pulse': {
    '0%': {
      boxShadow: '0 0 0 0 rgba(59, 165, 92, 0.4)'
    },
    '70%': {
      boxShadow: '0 0 0 10px rgba(59, 165, 92, 0)'
    },
    '100%': {
      boxShadow: '0 0 0 0 rgba(59, 165, 92, 0)'
    }
  },
  userAvatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#404249',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontSize: '32px',
    fontWeight: 500,
    marginBottom: '12px'
  },
  userName: {
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  userStatus: {
    fontSize: '14px',
    color: '#949BA4',
    marginTop: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  micIcon: {
    padding: '8px',
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: '50%',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: 'rgba(0,0,0,0.7)',
      transform: 'scale(1.1)'
    },
    '&:active': {
      transform: 'scale(0.95)'
    }
  },
  mutedMicIcon: {
    backgroundColor: 'rgba(237, 66, 69, 0.1)',
    '&:hover': {
      backgroundColor: 'rgba(237, 66, 69, 0.2)',
      transform: 'scale(1.1)'
    },
    '& .MuiSvgIcon-root': {
      color: '#ed4245'
    }
  },
  speakingMicIcon: {
    '& .MuiSvgIcon-root': {
      color: '#3ba55c'
    }
  },
  silentMicIcon: {
    '& .MuiSvgIcon-root': {
      color: '#B5BAC1'
    }
  },
  paper: {
    backgroundColor: '#2f3136',
    color: '#dcddde',
    boxShadow: 'none',
    border: '1px solid #202225'
  },
  listItem: {
    borderRadius: '4px',
    margin: '2px 0',
    '&:hover': {
      backgroundColor: '#32353b'
    },
    '@media (max-width: 600px)': {
      padding: '8px',
    }
  },
  username: {
    color: '#ffffff',
    fontSize: '1rem',
    '@media (max-width: 600px)': {
      fontSize: '0.9rem',
    }
  },
  controls: {
    display: 'flex',
    gap: '8px'
  },
  iconButton: {
    color: '#ffffff',
    '&:hover': {
      backgroundColor: '#40444b'
    }
  },
  joinPaper: {
    backgroundColor: '#2f3136',
    color: '#dcddde',
    padding: '24px',
    '@media (max-width: 600px)': {
      padding: '16px',
    }
  },
  textField: {
    '& .MuiOutlinedInput-root': {
      color: '#dcddde',
      '& fieldset': {
        borderColor: '#40444b'
      },
      '&:hover fieldset': {
        borderColor: '#72767d'
      },
      '&.Mui-focused fieldset': {
        borderColor: '#5865f2'
      }
    },
    '& .MuiInputLabel-root': {
      color: '#72767d'
    }
  },
  joinButton: {
    backgroundColor: '#5865f2',
    color: '#ffffff',
    '&:hover': {
      backgroundColor: '#4752c4'
    }
  },
  divider: {
    backgroundColor: '#40444b',
    margin: '8px 0'
  },
  bottomBar: {
    backgroundColor: '#000000',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000
  },
  controlsGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  controlsContainer: {
    display: 'flex',
    gap: '16px'
  },
  controlGroup: {
    backgroundColor: '#212121',
    borderRadius: '24px',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: '#202225',
    '@media (max-width: 600px)': {
      padding: '4px',
      gap: '4px',
    }
  },
  leaveButton: {
    backgroundColor: '#dc3545',
    color: '#ffffff',
    borderRadius: '24px',
    padding: '8px 16px',
    '&:hover': {
      backgroundColor: '#c82333'
    },
    minWidth: '120px'
  },
  volumeControl: {
    width: 100,
    marginLeft: 2,
    marginRight: 2,
    '@media (max-width: 600px)': {
      width: 60,
    }
  },
  screenShareContainer: {
    position: 'relative',
    width: '100%',
    height: '300px',
    backgroundColor: '#202225',
    marginBottom: '16px',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  screenVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain'
  },
  screenShareGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '16px',
    padding: '16px',
    maxHeight: '400px',
    overflowY: 'auto'
  },
  volumeIcon: {
    padding: '8px',
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    borderRadius: '50%',
    transition: 'all 0.2s ease',
    zIndex: 10,
    '&.muted': {
      backgroundColor: 'rgba(237, 66, 69, 0.1) !important',
      animation: 'mutePulse 2s infinite !important',
      '&:hover': {
        backgroundColor: 'rgba(237, 66, 69, 0.2) !important',
        transform: 'scale(1.1)'
      },
      '& .MuiSvgIcon-root': {
        color: '#ed4245'
      }
    },
    '&.speaking': {
      backgroundColor: 'transparent',
      animation: 'none !important',
      '& .MuiSvgIcon-root': {
        color: '#3ba55c'
      }
    },
    '&.silent': {
      backgroundColor: 'transparent',
      animation: 'none !important',
      '& .MuiSvgIcon-root': {
        color: '#B5BAC1'
      }
    }
  },
  '@keyframes mutePulse': {
    '0%': {
      boxShadow: '0 0 0 0 rgba(237, 66, 69, 0.4)'
    },
    '70%': {
      boxShadow: '0 0 0 10px rgba(237, 66, 69, 0)'
    },
    '100%': {
      boxShadow: '0 0 0 0 rgba(237, 66, 69, 0)'
    }
  },
  // Обновим стили
  screenShareItem: {
    position: 'relative',
    width: '100%',
    height: '100%',
    backgroundColor: '#202225',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  screenShareUserName: {
    position: 'absolute',
    bottom: '12px',
    left: '12px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 500,
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    zIndex: 2
  },
};

const setAudioOutput = async (audio, useEarpiece = true) => {
  try {
    // Проверяем поддержку выбора устройства вывода
    if (typeof audio.setSinkId !== 'undefined') {
      // На Android телефонный динамик имеет пустой sinkId
      await audio.setSinkId(useEarpiece ? '' : 'default');
      console.log('Audio output set to:', useEarpiece ? 'earpiece' : 'speaker');
    } else {
      console.log('setSinkId not supported');
    }
  } catch (error) {
    console.error('Error setting audio output:', error);
  }
};

// Создаем контекст для состояния мьюта
const MuteContext = React.createContext({
  muteStates: new Map(),
  setMuteState: () => {}
});

// Создаем провайдер для состояния мьюта
const MuteProvider = React.memo(({ children, socket }) => {
  const [muteStates, setMuteStates] = useState(new Map());
  
  const setMuteState = useCallback((peerId, isMuted) => {
    console.log('Setting mute state in context:', { peerId, isMuted });
    setMuteStates(prev => {
      const newStates = new Map(prev);
      newStates.set(peerId, Boolean(isMuted));
      return newStates;
    });
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handlePeerMuteStateChanged = ({ peerId, isMuted }) => {
      console.log('MuteProvider: Peer mute state changed:', { peerId, isMuted });
      setMuteState(peerId, Boolean(isMuted));

      // Если пользователь замьючен, убираем состояние speaking
      if (isMuted) {
        socket.emit('speaking', { speaking: false });
      }
    };

    const handlePeerJoined = ({ peerId, isMuted }) => {
      console.log('MuteProvider: New peer joined:', { peerId, isMuted });
      setMuteState(peerId, Boolean(isMuted));
    };

    socket.on('peerMuteStateChanged', handlePeerMuteStateChanged);
    socket.on('peerJoined', handlePeerJoined);

    return () => {
      socket.off('peerMuteStateChanged', handlePeerMuteStateChanged);
      socket.off('peerJoined', handlePeerJoined);
    };
  }, [socket, setMuteState]);

  const value = useMemo(() => ({
    muteStates,
    setMuteState
  }), [muteStates, setMuteState]);

  return (
    <MuteContext.Provider value={value}>
      {children}
    </MuteContext.Provider>
  );
});

// Создаем хук для использования состояния мьюта
const useMuteState = (peerId) => {
  const context = useContext(MuteContext);
  if (!context) {
    throw new Error('useMuteState must be used within a MuteProvider');
  }
  return [context.muteStates.get(peerId) || false, (isMuted) => context.setMuteState(peerId, isMuted)];
};

// Компонент индикатора мьюта
const MuteIndicator = React.memo(({ peerId }) => {
  const [isMuted] = useMuteState(peerId);
  
  if (!isMuted) return null;
  
  return (
    <div style={{
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: '4px',
      borderRadius: '50%',
      color: '#ffffff'
    }}>
      <VolumeOffRounded fontSize="small" />
    </div>
  );
});

// Оптимизированный компонент для видео (не перерисовывается при изменении состояния)
const VideoPlayer = React.memo(({ stream }) => {
  const videoRef = useRef();
  const [isHidden, setIsHidden] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const mountedRef = useRef(true);
  const cleanupTimeoutRef = useRef(null);
  const setupAttemptRef = useRef(false);
  
  useEffect(() => {
    mountedRef.current = true;
    setIsHidden(false);
    setIsRemoved(false);
    setVideoError(null);

    if (!stream) {
      console.log('No stream available, cleaning up video');
      cleanupVideo();
      return;
    }

    const setupVideo = async () => {
      if (setupAttemptRef.current) {
        console.log('Setup already in progress, skipping');
        return;
      }

      if (!mountedRef.current || !videoRef.current) {
        console.log('Component not mounted or video ref not available');
        return;
      }

      try {
        setupAttemptRef.current = true;
        console.log('Setting up video with new stream');
        
        if (videoRef.current.srcObject) {
          const oldTracks = videoRef.current.srcObject.getTracks();
          oldTracks.forEach(track => {
            track.stop();
          });
          videoRef.current.srcObject = null;
          videoRef.current.load();
        }

        // Устанавливаем минимальные задержки для буферизации
        videoRef.current.playsInline = true;
        videoRef.current.autoplay = true;
        videoRef.current.latencyHint = 'interactive';
        
        // Отключаем ненужные операции с видео
        videoRef.current.disableRemotePlayback = true;
        videoRef.current.preservesPitch = false;

        // Устанавливаем поток
        videoRef.current.srcObject = stream;

        // Настраиваем обработку треков для синхронизации
        stream.getTracks().forEach(track => {
          if (track.kind === 'audio') {
            track.enabled = true;
            // Устанавливаем приоритет для аудио
            track.contentHint = 'speech';
          } else if (track.kind === 'video') {
            track.enabled = true;
            // Оптимизируем настройки видео
            track.contentHint = 'motion';
          }
          
          track.onended = () => {
            console.log('Track ended:', track.id);
            cleanupVideo();
          };
        });

        // Запускаем воспроизведение с минимальной задержкой
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          try {
            await playPromise;
            // Устанавливаем минимальную задержку после успешного запуска
            videoRef.current.playbackRate = 1.0;
            console.log('Video playback started successfully');
          } catch (error) {
            if (error.name === 'AbortError') {
              console.log('Playback aborted, stream might have been removed');
              cleanupVideo();
              return;
            }
            throw error;
          }
        }
      } catch (error) {
        console.error('Error setting up video:', error);
        setVideoError(error.message);
        cleanupVideo();
      } finally {
        setupAttemptRef.current = false;
      }
    };

    // Уменьшаем задержку инициализации
    setupVideo();

    return () => {
      console.log('Cleaning up video component');
      mountedRef.current = false;
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
      cleanupVideo();
    };
  }, [stream]);

  const cleanupVideo = useCallback(() => {
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        
        if (videoRef.current.srcObject) {
          const tracks = videoRef.current.srcObject.getTracks();
          tracks.forEach(track => {
            track.enabled = false;
            track.stop();
          });
          videoRef.current.srcObject = null;
        }
        
        videoRef.current.load();
        setIsHidden(true);

        if (cleanupTimeoutRef.current) {
          clearTimeout(cleanupTimeoutRef.current);
        }
        
        // Уменьшаем задержку очистки
        cleanupTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setIsRemoved(true);
          }
        }, 100); // Уменьшили с 300мс до 100мс

        setupAttemptRef.current = false;
      } catch (error) {
        console.error('Error cleaning up video:', error);
        setIsHidden(true);
        setIsRemoved(true);
        setupAttemptRef.current = false;
      }
    }
  }, []);

  if (isRemoved) {
    return null;
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      backgroundColor: '#202225',
      borderRadius: '8px',
      overflow: 'hidden',
      opacity: isHidden ? 0 : 1,
      transition: 'opacity 0.2s ease-out' // Уменьшили время анимации
    }}>
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          backgroundColor: '#000',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1
        }}
        autoPlay
        playsInline
      />
      {videoError && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: '8px 16px',
          borderRadius: '4px',
          color: '#ffffff',
          zIndex: 3
        }}>
          {videoError}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => prevProps.stream === nextProps.stream);

// Компонент оверлея (перерисовывается отдельно от видео)
const VideoOverlay = React.memo(({ 
  peerName, 
  isMuted, 
  isSpeaking,
  isAudioEnabled,
  isLocal,
  onVolumeClick,
  volume,
  children
}) => {
  const handleVolumeIconClick = (e) => {
    e.stopPropagation();
    if (onVolumeClick) {
      onVolumeClick();
    }
  };

  // Определяем состояние иконки только на основе входящего volume
  const isVolumeOff = volume === 0;

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 2,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: '12px',
      background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 100%)'
    }}>
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: 500,
        padding: '4px 8px',
        borderRadius: '4px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        width: 'fit-content',
        mb: 1
      }}>
        {isMuted ? (
          <MicOff sx={{ fontSize: 16, color: '#ed4245' }} />
        ) : isSpeaking ? (
          <Mic sx={{ fontSize: 16, color: '#3ba55c' }} />
        ) : (
          <Mic sx={{ fontSize: 16, color: '#B5BAC1' }} />
        )}
        {!isAudioEnabled && (
          <HeadsetOff sx={{ fontSize: 16, color: '#ed4245' }} />
        )}
        {peerName}
      </Box>
      
      {!isLocal && (
        <IconButton
          onClick={handleVolumeIconClick}
          className={`volumeControl ${
            isVolumeOff
              ? 'muted'
              : isSpeaking
              ? 'speaking'
              : 'silent'
          }`}
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            backgroundColor: isVolumeOff ? 'rgba(237, 66, 69, 0.1)' : 'rgba(0,0,0,0.5)',
            borderRadius: '50%',
            transition: 'all 0.2s ease',
            zIndex: 10,
            '&:hover': {
              backgroundColor: isVolumeOff ? 'rgba(237, 66, 69, 0.2)' : 'rgba(0,0,0,0.7)',
              transform: 'scale(1.1)'
            },
            '&.muted': {
              backgroundColor: 'rgba(237, 66, 69, 0.1) !important',
              animation: 'mutePulse 2s infinite !important',
              '& .MuiSvgIcon-root': {
                color: '#ed4245'
              },
              '&:hover': {
                backgroundColor: 'rgba(237, 66, 69, 0.2) !important',
                transform: 'scale(1.1)'
              }
            },
            '&.speaking': {
              backgroundColor: 'transparent',
              '& .MuiSvgIcon-root': {
                color: '#3ba55c'
              }
            },
            '&.silent': {
              backgroundColor: 'transparent',
              '& .MuiSvgIcon-root': {
                color: '#B5BAC1'
              }
            }
          }}
        >
          {isVolumeOff ? (
            <VolumeOff sx={{ fontSize: 20, color: '#ed4245' }} />
          ) : (
            <VolumeUp sx={{ fontSize: 20 }} />
          )}
        </IconButton>
      )}
      
      {children}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.peerName === nextProps.peerName &&
    prevProps.isMuted === nextProps.isMuted &&
    prevProps.isSpeaking === nextProps.isSpeaking &&
    prevProps.isAudioEnabled === nextProps.isAudioEnabled &&
    prevProps.volume === nextProps.volume &&
    prevProps.children === nextProps.children
  );
});

// Оптимизированный компонент для отображения видео
const VideoView = React.memo(({ 
  stream, 
  peerName, 
  isMuted, 
  isSpeaking,
  isAudioEnabled,
  isLocal,
  onVolumeClick,
  volume,
  children 
}) => {
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <VideoPlayer stream={stream} />
      <VideoOverlay
        peerName={peerName}
        isMuted={isMuted}
        isSpeaking={isSpeaking}
        isAudioEnabled={isAudioEnabled}
        isLocal={isLocal}
        onVolumeClick={onVolumeClick}
        volume={volume}
      >
        {children}
      </VideoOverlay>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.stream === nextProps.stream &&
    prevProps.peerName === nextProps.peerName &&
    prevProps.isMuted === nextProps.isMuted &&
    prevProps.isSpeaking === nextProps.isSpeaking &&
    prevProps.isAudioEnabled === nextProps.isAudioEnabled &&
    prevProps.volume === nextProps.volume &&
    prevProps.children === nextProps.children
  );
});

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [useEarpiece, setUseEarpiece] = useState(true);
  const isMobile = useMemo(() => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent), []);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [peers, setPeers] = useState(new Map());
  const [error, setError] = useState('');
  const [volumes, setVolumes] = useState(new Map());
  const [isJoining, setIsJoining] = useState(false);
  const [speakingStates, setSpeakingStates] = useState(new Map());
  const [audioStates, setAudioStates] = useState(new Map()); // Состояния аудио для всех пиров
  const [screenProducer, setScreenProducer] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [remoteScreens, setRemoteScreens] = useState(new Map());
  const [videoProducer, setVideoProducer] = useState(null);
  const [videoStream, setVideoStream] = useState(null);
  const [remoteVideos, setRemoteVideos] = useState(new Map());
  const [isNoiseSuppressed, setIsNoiseSuppressed] = useState(false);
  const [noiseSuppressionMode, setNoiseSuppressionMode] = useState('rnnoise');
  const [noiseSuppressMenuAnchor, setNoiseSuppressMenuAnchor] = useState(null);
  const noiseSuppressionRef = useRef(null);
  const masterGainNodeRef = useRef(null);
  const isAudioEnabledRef = useRef(isAudioEnabled);


  const socketRef = useRef();
  const deviceRef = useRef();
  const producerTransportRef = useRef();
  const consumerTransportsRef = useRef(new Map());
  const producersRef = useRef(new Map());
  const consumersRef = useRef(new Map());
  const localStreamRef = useRef();
  const audioRef = useRef(new Map());
  const audioContextRef = useRef();
  const gainNodesRef = useRef(new Map());
  const analyserNodesRef = useRef(new Map());
  const animationFramesRef = useRef(new Map());

  // Добавляем новый ref для хранения состояний mute
  const mutedPeersRef = useRef(new Map());

  // Добавляем новый ref для хранения состояний индивидуального mute
  const individualMutedPeersRef = useRef(new Map());

  useEffect(() => {
    const resumeAudioContext = async () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        try {
          await audioContextRef.current.resume();
          console.log('AudioContext resumed successfully');
        } catch (error) {
          console.error('Failed to resume AudioContext:', error);
        }
      }
    };

    const handleInteraction = async () => {
      await resumeAudioContext();
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };

    if (socketRef.current) {
      socketRef.current.on('speakingStateChanged', ({ peerId, speaking }) => {
        setSpeakingStates(prev => {
          const newStates = new Map(prev);
          newStates.set(peerId, speaking);
          return newStates;
        });
      });

      socketRef.current.on('peerMuteStateChanged', ({ peerId, isMuted }) => {
        setVolumes(prev => {
          const newVolumes = new Map(prev);
          newVolumes.set(peerId, isMuted ? 0 : 100);
          return newVolumes;
        });
        
        if (isMuted) {
          setSpeakingStates(prev => {
            const newStates = new Map(prev);
            newStates.set(peerId, false);
            return newStates;
          });
        }
      });
    }

    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Глобальный логгер всех событий сокета
    socket.onAny((event, ...args) => {
      console.log('Socket event received:', event, args);
    });

    // Обработчик закрытия producer
    socket.on('producerClosed', ({ producerId, producerSocketId, mediaType }) => {
      console.log('Producer closed event received:', { producerId, producerSocketId, mediaType });
      
      if (mediaType === 'screen') {
        console.log('Processing screen sharing producer closure');
        setRemoteScreens(prev => {
          const newScreens = new Map(prev);
          const screenEntry = [...newScreens.entries()].find(
            ([id, data]) => data.producerId === producerId
          );
          
          if (screenEntry) {
            const [peerId] = screenEntry;
            if (peerId === producerSocketId) {
              console.log('Removing screen from remoteScreens:', peerId);
              // Останавливаем треки перед удалением
              const stream = screenEntry[1].stream;
              if (stream) {
                stream.getTracks().forEach(track => {
                  track.stop();
                });
              }
              newScreens.delete(peerId);
            }
          }
          return newScreens;
        });
      } else if (mediaType === 'webcam') {
        console.log('Processing webcam producer closure');
        setRemoteVideos(prev => {
          const newVideos = new Map(prev);
          const videoEntry = [...newVideos.entries()].find(
            ([id, data]) => data.producerId === producerId
          );
          
          if (videoEntry) {
            const [peerId] = videoEntry;
            if (peerId === producerSocketId) {
              console.log('Removing video from remoteVideos:', peerId);
              // Останавливаем треки перед удалением
              const stream = videoEntry[1].stream;
              if (stream) {
                stream.getTracks().forEach(track => {
                  track.stop();
                });
              }
              newVideos.delete(peerId);

              // Находим и закрываем соответствующий consumer
              const consumer = Array.from(consumersRef.current.entries()).find(
                ([id, consumer]) => consumer.producerId === producerId
              );
              if (consumer) {
                console.log('Found and closing associated consumer:', consumer[0]);
                consumer[1].close();
                consumersRef.current.delete(consumer[0]);
              }
            }
          }
          return newVideos;
        });
      }
    });

    // Обработчики состояния говорения и отключения звука
    socket.on('speakingStateChanged', ({ peerId, speaking }) => {
      setSpeakingStates(prev => {
        const newStates = new Map(prev);
        newStates.set(peerId, speaking);
        return newStates;
      });
    });

    socket.on('peerMuteStateChanged', ({ peerId, isMuted }) => {
      setVolumes(prev => {
        const newVolumes = new Map(prev);
        newVolumes.set(peerId, isMuted ? 0 : 100);
        return newVolumes;
      });
      
      if (isMuted) {
        setSpeakingStates(prev => {
          const newStates = new Map(prev);
          newStates.set(peerId, false);
          return newStates;
        });
      }
    });

    // Очистка при размонтировании
    return () => {
      socket.offAny();
      socket.off('producerClosed');
      socket.off('speakingStateChanged');
      socket.off('peerMuteStateChanged');
    };
  }, [socketRef.current]); // Зависим только от socketRef.current

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Add audio state change handler
    socket.on('peerAudioStateChanged', ({ peerId, isEnabled }) => {
      setAudioStates(prev => {
        const newStates = new Map(prev);
        newStates.set(peerId, isEnabled);
        return newStates;
      });
    });

    return () => {
      socket.off('peerAudioStateChanged');
    };
  }, [socketRef.current]);

  const cleanup = () => {
    try {
      // Stop screen sharing if active
      if (screenProducer) {
        screenProducer.close();
        setScreenProducer(null);
      }
      
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
      }

      setIsScreenSharing(false);
      setRemoteScreens(new Map());

      // Очищаем воркеры определения голоса
      audioRef.current.forEach((peerAudio, peerId) => {
        if (peerAudio instanceof Map && peerAudio.has('voiceDetector')) {
          const voiceDetector = peerAudio.get('voiceDetector');
          if (voiceDetector) {
            voiceDetector.port.close();
            voiceDetector.disconnect();
          }
        }
      });

      // Очищаем анализаторы
      analyserNodesRef.current.forEach(analyser => {
        if (analyser) {
          analyser.disconnect();
        }
      });
      analyserNodesRef.current.clear();

      // Cancel all animation frames
      animationFramesRef.current.forEach((frameId) => {
        cancelAnimationFrame(frameId);
      });
      animationFramesRef.current.clear();

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (producerTransportRef.current) {
        producerTransportRef.current.close();
        producerTransportRef.current = null;
      }
      consumerTransportsRef.current.forEach(transport => {
        if (transport) {
          transport.close();
        }
      });
      consumerTransportsRef.current.clear();
      
      producersRef.current.forEach(producer => {
        if (producer) {
          producer.close();
        }
      });
      producersRef.current.clear();
      
      consumersRef.current.forEach(consumer => {
        if (consumer) {
          consumer.close();
        }
      });
      consumersRef.current.clear();

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      audioRef.current.forEach(audio => {
        if (audio) {
          audio.srcObject = null;
          audio.remove();
        }
      });
      audioRef.current.clear();

      gainNodesRef.current.forEach(node => {
        if (node) {
          node.disconnect();
        }
      });
      gainNodesRef.current.clear();

      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;

      deviceRef.current = null;
      
      // Cleanup noise suppression
      if (noiseSuppressionRef.current) {
        noiseSuppressionRef.current.cleanup();
        noiseSuppressionRef.current = null;
      }

    } catch (error) {
      console.error('Cleanup error:', error);
    }
  };

  const handleJoin = async () => {
    if (!roomId || !userName) {
      setError('Please enter room ID and username');
      return;
    }

    try {
      // Очищаем старый сокет если есть
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      console.log('Connecting to server...');
      const socket = io(config.server.url, {
        transports: ['websocket'],
        upgrade: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        secure: true,
        rejectUnauthorized: false
      });

      // Сразу добавляем временный логгер для отладки
      socket.onAny((event, ...args) => {
        console.log('IMMEDIATE SOCKET EVENT:', event, args);
      });
      
      // Сразу присваиваем сокет в ref
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Socket connected successfully');
        setIsConnected(true);
        // Set initial states
        socket.emit('muteState', { isMuted: false });
        socket.emit('audioState', { isEnabled: isAudioEnabled });
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setError('Failed to connect to server: ' + error.message);
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
        setIsJoined(false);
        setPeers(new Map());
        cleanup();
      });

      // Add handlers for peer events
      socket.on('peerJoined', ({ peerId, name, isMuted, isAudioEnabled }) => {
        console.log('New peer joined:', { peerId, name, isMuted, isAudioEnabled });
        
        // Update peers state
        setPeers(prev => {
          const newPeers = new Map(prev);
          // Only add if peer doesn't exist
          if (!newPeers.has(peerId)) {
            newPeers.set(peerId, { 
              id: peerId, 
              name, 
              isMuted: Boolean(isMuted) 
            });
            console.log('Added new peer to peers map:', { peerId, name });
          }
          return newPeers;
        });

        // Update audio states
        setAudioStates(prev => {
          const newStates = new Map(prev);
          newStates.set(peerId, Boolean(isAudioEnabled));
          return newStates;
        });

        // Initialize volumes for the new peer
        setVolumes(prev => {
          const newVolumes = new Map(prev);
          newVolumes.set(peerId, 100); // Default volume
          return newVolumes;
        });

        // Initialize speaking state for the new peer
        setSpeakingStates(prev => {
          const newStates = new Map(prev);
          newStates.set(peerId, false); // Initially not speaking
          return newStates;
        });
      });

      socket.on('peerLeft', ({ peerId }) => {
        console.log('Peer left:', peerId);
        setPeers(prev => {
          const newPeers = new Map(prev);
          newPeers.delete(peerId);
          return newPeers;
        });
        setAudioStates(prev => {
          const newStates = new Map(prev);
          newStates.delete(peerId);
          return newStates;
        });
      });

      socket.on('newProducer', async ({ producerId, producerSocketId, kind }) => {
        console.log('New producer:', { producerId, producerSocketId, kind });
        await handleExistingProducer({ producerId, producerSocketId, kind });
      });

      // Initialize device first
      console.log('Initializing device...');
      const device = new Device();
      deviceRef.current = device;

      socket.emit('createRoom', { roomId }, async ({ error: createError }) => {
        console.log('Create room response:', createError ? `Error: ${createError}` : 'Success');
        
        socket.emit('join', { roomId, name: userName }, async ({ error: joinError, routerRtpCapabilities, existingPeers, existingProducers }) => {
          if (joinError) {
            console.error('Join error:', joinError);
            setError(joinError);
            return;
          }

          try {
            console.log('Joined room, initializing connection...');
            
            // Update peers state with existing peers
            if (existingPeers && existingPeers.length > 0) {
              console.log('Setting existing peers:', existingPeers);
              const peersMap = new Map();
              const audioStatesMap = new Map();
              existingPeers.forEach(peer => {
                peersMap.set(peer.id, { 
                  id: peer.id, 
                  name: peer.name, 
                  isMuted: peer.isMuted || false 
                });
                audioStatesMap.set(peer.id, peer.isAudioEnabled);
              });
              setPeers(peersMap);
              setAudioStates(audioStatesMap);
            }

            // Initialize Web Audio API context
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
              audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 48000,
                latencyHint: 'interactive'
              });
            }
            
            await audioContextRef.current.resume();

            // Load device with router capabilities
            console.log('Loading device with router capabilities...');
            await device.load({ routerRtpCapabilities });
            console.log('Device loaded successfully');

            // Create send transport
            console.log('Creating send transport...');
            await createSendTransport();
            console.log('Send transport created successfully');

            // Create local stream
            console.log('Creating local stream...');
            await createLocalStream();
            console.log('Local stream created successfully');

            // Handle existing producers
            if (existingProducers && existingProducers.length > 0) {
              console.log('Processing existing producers:', existingProducers);
              for (const producer of existingProducers) {
                await handleExistingProducer(producer);
              }
            }

            console.log('Setting joined state to true');
            setIsJoined(true);

          } catch (err) {
            console.error('Failed to initialize:', err);
            setError('Failed to initialize connection: ' + err.message);
            cleanup();
          }
        });
      });

    } catch (err) {
      console.error('Connection error:', err);
      setError('Failed to connect to server: ' + err.message);
      cleanup();
    }
  };

  const handleExistingProducer = async (producer) => {
    try {
      console.log('Handling existing producer:', producer);
      
      // Skip if this is our own producer
      if (producer.producerSocketId === socketRef.current.id) {
        console.log('Skipping own producer');
        return;
      }
      
      // Create consumer transport if not exists
      const transport = await createConsumerTransport();
      console.log('Consumer transport created:', transport.id);
      
      const { rtpCapabilities } = deviceRef.current;
      
      // Request consume
      const { id, producerId, kind, rtpParameters, appData, error } = await new Promise((resolve, reject) => {
        socketRef.current.emit('consume', {
          rtpCapabilities,
          remoteProducerId: producer.producerId,
          transportId: transport.id
        }, (response) => {
          if (response.error) {
            console.error('Consume request failed:', response.error);
            reject(new Error(response.error));
            return;
          }
          resolve(response);
        });
      });

      if (error) {
        throw new Error(error);
      }

      if (!id || !producerId || !kind || !rtpParameters) {
        throw new Error('Invalid consumer data received from server');
      }

      // Create consumer
      const consumer = await transport.consume({
        id,
        producerId,
        kind,
        rtpParameters,
        appData
      });

      console.log('Consumer created:', consumer.id);
      consumersRef.current.set(consumer.id, consumer);

      // Create MediaStream from consumer's track
      const stream = new MediaStream([consumer.track]);

      // Handle based on kind and appData
      if (appData?.mediaType === 'screen') {
        console.log('Processing screen sharing stream:', { kind, appData });
        
        if (kind === 'video') {
          console.log('Setting up screen sharing video');
          setRemoteScreens(prev => {
            const newScreens = new Map(prev);
            newScreens.set(producer.producerSocketId, { 
              producerId,
              consumerId: consumer.id,
              stream
            });
            return newScreens;
          });
        }
      } else if (appData?.mediaType === 'webcam') {
        console.log('Processing webcam stream:', { kind, appData });
        
        if (kind === 'video') {
          console.log('Setting up webcam stream');
          setRemoteVideos(prev => {
            const newVideos = new Map(prev);
            newVideos.set(producer.producerSocketId, {
              producerId,
              consumerId: consumer.id,
              stream
            });
            return newVideos;
          });
        }
      } else if (kind === 'audio') {
        // Handle regular audio streams
        try {
          const audio = new Audio();
          audio.srcObject = stream;
          audio.id = `audio-${producer.producerSocketId}`;
          audio.autoplay = true;
          audio.muted = !isAudioEnabledRef.current; // Use ref for current state

          if (isMobile) {
            await setAudioOutput(audio, useEarpiece);
          }
          
          // Create audio context and nodes only for audio streams
          const audioContext = audioContextRef.current;
          const source = audioContext.createMediaStreamSource(stream);
          
          // Add analyzer for voice activity detection
          const analyser = createAudioAnalyser(audioContext);
          
          // Create gain node
          const gainNode = audioContext.createGain();
          gainNode.gain.value = isAudioEnabledRef.current ? 1.0 : 0.0; // Use ref for current state

          // Connect nodes только для анализа голоса
          source.connect(analyser);
          analyser.connect(gainNode);
          gainNode.connect(audioContext.destination);

          // Store references
          analyserNodesRef.current.set(producer.producerSocketId, analyser);
          gainNodesRef.current.set(producer.producerSocketId, gainNode);
          audioRef.current.set(producer.producerSocketId, audio);
          setVolumes(prev => new Map(prev).set(producer.producerSocketId, 100));

          // Start voice detection
          detectSpeaking(analyser, producer.producerSocketId, producer.producerId);
        } catch (error) {
          console.error('Error setting up audio:', error);
        }
      }

      // Resume the consumer
      await new Promise((resolve, reject) => {
        socketRef.current.emit('resumeConsumer', { consumerId: consumer.id }, async (error) => {
          if (error) {
            console.error('Resume consumer failed:', error);
            reject(new Error(error));
            return;
          }
          try {
            await consumer.resume();
            console.log('Consumer resumed');
            resolve();
          } catch (err) {
            console.error('Failed to resume consumer:', err);
            reject(err);
          }
        });
      });

      // Monitor consumer state
      consumer.on('transportclose', () => {
        console.log('Consumer transport closed:', consumer.id);
        removeConsumer(consumer.id);
      });

      consumer.on('producerclose', () => {
        console.log('Consumer producer closed:', consumer.id);
        removeConsumer(consumer.id);
      });

      consumer.on('producerpause', () => {
        console.log('Consumer producer paused:', consumer.id);
        // Очищаем видео при паузе producer'а
        if (appData?.mediaType === 'webcam') {
          setRemoteVideos(prev => {
            const newVideos = new Map(prev);
            for (const [peerId, videoData] of newVideos.entries()) {
              if (videoData.consumerId === consumer.id) {
                if (videoData.stream) {
                  videoData.stream.getTracks().forEach(track => {
                    track.stop();
                  });
                }
                newVideos.delete(peerId);
                break;
              }
            }
            return newVideos;
          });
        }
      });

      // Monitor track state
      consumer.track.onended = () => {
        console.log('Consumer track ended:', consumer.id);
        removeConsumer(consumer.id);
      };

    } catch (error) {
      console.error('Error handling existing producer:', error);
    }
  };

  // Получаем контекст мьюта на уровне компонента
  const { setMuteState } = useContext(MuteContext);

  // Обновляем handleMute
  const handleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const newMuteState = !isMuted;
        audioTrack.enabled = !newMuteState;
        setIsMuted(newMuteState);
        
        console.log('Sending mute state to server:', newMuteState);
        if (socketRef.current) {
          socketRef.current.emit('muteState', { isMuted: newMuteState });
          
          if (setMuteState) {
            setMuteState(socketRef.current.id, newMuteState);
          }
          
          if (newMuteState) {
            socketRef.current.emit('speaking', { speaking: false });
            setSpeakingStates(prev => {
              const newStates = new Map(prev);
              newStates.set(socketRef.current.id, false);
              return newStates;
            });
          }
        }
      }
    }
  }, [isMuted, setMuteState]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Обработчик изменения состояния микрофона других пользователей
    const handlePeerMuteStateChanged = ({ peerId, isMuted }) => {
      console.log('Received peer mute state change:', { peerId, isMuted });
      
      // Обновляем состояние в peers
      setPeers(prev => {
        const newPeers = new Map(prev);
        const peer = newPeers.get(peerId);
        if (peer) {
          newPeers.set(peerId, { ...peer, isMuted: Boolean(isMuted) });
        }
        return newPeers;
      });

      // Если пользователь замьючен, убираем состояние speaking
      if (isMuted) {
        setSpeakingStates(prev => {
          const newStates = new Map(prev);
          newStates.set(peerId, false);
          return newStates;
        });
      }
    };

    socket.on('peerMuteStateChanged', handlePeerMuteStateChanged);

    return () => {
      socket.off('peerMuteStateChanged', handlePeerMuteStateChanged);
    };
  }, [socketRef.current]);

  // Эффект для глобального управления звуком
  useEffect(() => {
    isAudioEnabledRef.current = isAudioEnabled;
    
    audioRef.current.forEach((audio, peerId) => {
      const gainNode = gainNodesRef.current.get(peerId);
      if (gainNode && audio) {
        if (!isAudioEnabled) {
          // При глобальном выключении просто мутим аудио элемент
          audio.muted = true;
        } else {
          // При глобальном включении проверяем индивидуальное состояние
          const isIndividuallyMuted = individualMutedPeersRef.current.get(peerId) ?? false;
          audio.muted = isIndividuallyMuted;
        }
      }
    });
  }, [isAudioEnabled]);

  const handleVolumeChange = (peerId) => {
    console.log('Volume change requested for peer:', peerId);
    const gainNode = gainNodesRef.current.get(peerId);
    
    // Даже если глобально звук выключен, мы все равно меняем индивидуальное состояние
    const isIndividuallyMuted = individualMutedPeersRef.current.get(peerId) ?? false;
    const newIsIndividuallyMuted = !isIndividuallyMuted;
    const newVolume = newIsIndividuallyMuted ? 0 : 100;
    
    console.log('Peer:', peerId, 'Current individual mute:', isIndividuallyMuted, 'New individual mute:', newIsIndividuallyMuted);
    console.log('GainNode exists:', !!gainNode);
    
    if (gainNode) {
      // Обновляем состояние аудио элемента
      const audio = audioRef.current.get(peerId);
      console.log('Audio element exists:', !!audio);
      
      if (audio) {
        if (!newIsIndividuallyMuted) {
          // Размучиваем только если глобальный звук включен
          if (isAudioEnabled) {
            audio.muted = false;
          }
          gainNode.gain.setValueAtTime(1, audioContextRef.current.currentTime);
          console.log('Set gain to 1 and unmuted audio for peer:', peerId);
        } else {
          gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
          audio.muted = true;
          console.log('Set gain to 0 and muted audio for peer:', peerId);
        }
      }

      // Сохраняем новое индивидуальное состояние
      individualMutedPeersRef.current.set(peerId, newIsIndividuallyMuted);
      
      // Обновляем UI состояние
      setVolumes(prev => {
        const newVolumes = new Map(prev);
        newVolumes.set(peerId, newVolume);
        return newVolumes;
      });
    }
  };

  // Обновляем обработчик подключения пира
  const handlePeerJoined = useCallback(({ peerId }) => {
    // Инициализируем состояние - не замучен индивидуально
    individualMutedPeersRef.current.set(peerId, false);
    setVolumes(prev => {
      const newVolumes = new Map(prev);
      newVolumes.set(peerId, 100);
      return newVolumes;
    });
  }, []);

  // Обновляем обработчик отключения пира
  const handlePeerLeft = useCallback(({ peerId }) => {
    individualMutedPeersRef.current.delete(peerId);
    setVolumes(prev => {
      const newVolumes = new Map(prev);
      newVolumes.delete(peerId);
      return newVolumes;
    });
  }, []);

  const initializeDevice = async (routerRtpCapabilities) => {
    try {
      if (!deviceRef.current) {
        const device = new Device();
        if (routerRtpCapabilities) {
          await device.load({ routerRtpCapabilities });
        }
        deviceRef.current = device;
        console.log('Device initialized', routerRtpCapabilities ? 'with capabilities' : 'without capabilities');
      } else if (routerRtpCapabilities) {
        await deviceRef.current.load({ routerRtpCapabilities });
        console.log('Device reinitialized with capabilities');
      }
    } catch (error) {
      console.error('Failed to initialize device:', error);
      throw error;
    }
  };

  const createSendTransport = async () => {
    return new Promise((resolve, reject) => {
      console.log('Creating send transport...');
      socketRef.current.emit('createWebRtcTransport', async ({ error, ...params }) => {
        if (error) {
          console.error('Create send transport error:', error);
          setError(`Failed to create transport: ${error}`);
          reject(error);
          return;
        }

        try {
          console.log('Send transport parameters:', params);
          const transport = deviceRef.current.createSendTransport({
            ...params,
            iceServers: config.iceServers,
            iceTransportPolicy: 'all',
            iceCandidatePoolSize: 10
          });

          transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            try {
              console.log('Send transport connect event');
              socketRef.current.emit('connectTransport', {
                transportId: transport.id,
                dtlsParameters,
              }, (response) => {
                if (response?.error) {
                  console.error('Connect transport error:', response.error);
                  errback(new Error(response.error));
                  return;
                }
                console.log('Send transport connected successfully');
                callback();
              });
            } catch (error) {
              console.error('Transport connect error:', error);
              errback(error);
            }
          });

          transport.on('connectionstatechange', async (state) => {
            console.log('Send transport connection state changed:', state);
            if (state === 'connected') {
              console.log('Send transport connected');
            } else if (state === 'failed' || state === 'disconnected') {
              console.error('Send transport failed or disconnected, attempting reconnection...');
              try {
                const { iceParameters, error } = await new Promise((resolve) => {
                  socketRef.current.emit('restartIce', { transportId: transport.id }, resolve);
                });

                if (error) {
                  throw new Error(error);
                }

                if (iceParameters) {
                  await transport.restartIce({ iceParameters });
                  console.log('Send transport ICE restarted successfully');
                }
              } catch (error) {
                console.error('Failed to restart send transport ICE:', error);
                setError('Connection failed. Please try rejoining the room.');
              }
            }
          });

          transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
            try {
              console.log('Send transport produce event:', { kind });
              socketRef.current.emit('produce', {
                transportId: transport.id,
                kind,
                rtpParameters,
                appData
              }, (response) => {
                if (response?.error) {
                  console.error('Produce error:', response.error);
                  errback(new Error(response.error));
                  return;
                }
                console.log('Producer created successfully:', response.id);
                callback({ id: response.id });
              });
            } catch (error) {
              console.error('Transport produce error:', error);
              errback(error);
            }
          });

          producerTransportRef.current = transport;
          resolve(transport);
        } catch (error) {
          console.error('Failed to create send transport:', error);
          setError(`Failed to create transport: ${error.message}`);
          reject(error);
        }
      });
    });
  };

  const createLocalStream = async () => {
    try {
      console.log('Requesting microphone access...');
      
      // Cleanup any existing stream first
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        localStreamRef.current = null;
      }

      // Initialize audio context if needed
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 48000,
          latencyHint: 'interactive'
        });
        console.log('Created new AudioContext:', audioContextRef.current);
      }
      
      await audioContextRef.current.resume();
      console.log('AudioContext state after resume:', audioContextRef.current.state);

      // Get user media with detailed constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 2,
          sampleRate: 48000
        }
      });

      console.log('Got media stream:', stream);
      console.log('Audio track settings:', stream.getAudioTracks()[0].getSettings());

      localStreamRef.current = stream;
      
      // Initialize noise suppression
      if (!noiseSuppressionRef.current) {
        noiseSuppressionRef.current = new NoiseSuppressionManager();
      }
      
      const initResult = await noiseSuppressionRef.current.initialize(stream);
      if (initResult && isNoiseSuppressed) {
        await noiseSuppressionRef.current.enable(noiseSuppressionMode);
      }

      // Get the processed stream for the producer
      const processedStream = noiseSuppressionRef.current.getProcessedStream();
      const track = processedStream.getAudioTracks()[0];
      
      if (!track) {
        throw new Error('No audio track in processed stream');
      }
      
      // Ensure track settings are applied
      const settings = track.getSettings();
      console.log('Final audio track settings:', settings);

      // Prevent local audio feedback
      track.enabled = !isMuted;
      
      if (!producerTransportRef.current) {
        throw new Error('Producer transport not initialized');
      }

      // Add analyzer for voice activity detection
      const source = audioContextRef.current.createMediaStreamSource(processedStream);
      const analyser = createAudioAnalyser(audioContextRef.current);
      source.connect(analyser);

      // Store analyser reference
      analyserNodesRef.current.set(socketRef.current.id, analyser);

      // Start voice detection
      detectSpeaking(analyser, socketRef.current.id);
      
      console.log('Creating audio producer...');
      const producer = await producerTransportRef.current.produce({ 
        track,
        codecOptions: {
          opusStereo: true,
          opusDtx: true,
          opusFec: true,
          opusNack: true
        },
        appData: {
          streamId: processedStream.id
        }
      });
      
      console.log('Audio producer created:', producer.id);
      producersRef.current.set(producer.id, producer);

      // Set producer in noise suppression manager
      if (noiseSuppressionRef.current) {
        noiseSuppressionRef.current.setProducer(producer);
      }

      // Monitor producer state
      producer.on('transportclose', () => {
        console.log('Producer transport closed');
        producer.close();
        producersRef.current.delete(producer.id);
      });

      producer.on('trackended', () => {
        console.log('Local track ended');
        producer.close();
        producersRef.current.delete(producer.id);
      });

      return producer;
    } catch (error) {
      console.error('Failed to create local stream:', error);
      throw error;
    }
  };

  const createConsumerTransport = async () => {
    console.log('Creating consumer transport...');
    const { error, ...params } = await new Promise((resolve) => {
      socketRef.current.emit('createWebRtcTransport', resolve);
    });

    if (error) {
      console.error('Failed to create consumer transport:', error);
      throw new Error('Failed to create consumer transport');
    }

    console.log('Consumer transport parameters:', params);

    const transport = deviceRef.current.createRecvTransport({
      ...params,
      iceServers: config.iceServers,
      iceTransportPolicy: 'all',
      iceCandidatePoolSize: 10
    });

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      console.log('Consumer transport connect event');
      socketRef.current.emit('connectTransport', {
        transportId: transport.id,
        dtlsParameters,
      }, (error) => {
        if (error) {
          console.error('Consumer transport connect error:', error);
          errback(error);
          return;
        }
        console.log('Consumer transport connected successfully');
        callback();
      });
    });

    transport.on('connectionstatechange', async (state) => {
      console.log('Consumer transport connection state changed:', state);
      if (state === 'connected') {
        console.log('Consumer transport connected');
      } else if (state === 'failed' || state === 'disconnected') {
        console.error('Consumer transport failed or disconnected, attempting reconnection...');
        try {
          const { iceParameters, error } = await new Promise((resolve) => {
            socketRef.current.emit('restartIce', { transportId: transport.id }, resolve);
          });

          if (error) {
            throw new Error(error);
          }

          if (iceParameters) {
            await transport.restartIce({ iceParameters });
            console.log('Consumer transport ICE restarted successfully');
          }
        } catch (error) {
          console.error('Failed to restart consumer transport ICE:', error);
          setError('Connection failed. Please try rejoining the room.');
        }
      }
    });

    consumerTransportsRef.current.set(transport.id, transport);
    return transport;
  };

  const removeConsumer = (consumerId) => {
    try {
      console.log('Removing consumer:', consumerId);
      const consumer = consumersRef.current.get(consumerId);
      if (consumer) {
        // Закрываем consumer
        consumer.close();
        consumersRef.current.delete(consumerId);
        
        // Находим и удаляем соответствующее видео
        setRemoteVideos(prev => {
          const newVideos = new Map(prev);
          for (const [peerId, videoData] of newVideos.entries()) {
            if (videoData.consumerId === consumerId) {
              console.log('Found and removing video for consumer:', consumerId);
              // Останавливаем треки
              if (videoData.stream) {
                videoData.stream.getTracks().forEach(track => {
                  track.stop();
                });
              }
              newVideos.delete(peerId);
              break;
            }
          }
          return newVideos;
        });

        // Очищаем аудио элементы
        const producerSocketId = Array.from(audioRef.current.keys()).find(
          key => audioRef.current.get(key).srcObject?.getTracks()[0].id === consumer.track.id
        );
        
        if (producerSocketId) {
          const audio = audioRef.current.get(producerSocketId);
          if (audio) {
            audio.pause();
            audio.srcObject = null;
            audioRef.current.delete(producerSocketId);
          }

          const gainNode = gainNodesRef.current.get(producerSocketId);
          if (gainNode) {
            gainNode.disconnect();
            gainNodesRef.current.delete(producerSocketId);
          }

          setVolumes(prev => {
            const newVolumes = new Map(prev);
            newVolumes.delete(producerSocketId);
            return newVolumes;
          });
        }
      }
    } catch (error) {
      console.error('Error removing consumer:', error);
    }
  };

  const handleLeaveCall = () => {
    cleanup();
    setIsJoined(false);
    setIsConnected(false);
    setPeers(new Map());
    setVolumes(new Map());
    setError('');
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  const startScreenSharing = async () => {
    try {
      if (!producerTransportRef.current) {
        throw new Error('Transport not ready');
      }

      // Stop any existing screen sharing first
      if (isScreenSharing) {
        await stopScreenSharing();
      }

      console.log('Requesting screen sharing access...');
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          aspectRatio: { ideal: 16/9 },
          displaySurface: 'monitor',
          resizeMode: 'crop-and-scale'
        },
        audio: false
      });

      console.log('Screen sharing access granted');

      // Handle stream stop
      screenStream.getVideoTracks()[0].onended = () => {
        console.log('Screen sharing stopped by user');
        stopScreenSharing();
      };

      // Set stream first
      setScreenStream(screenStream);

      const videoTrack = screenStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No video track available');
      }

      console.log('Creating screen sharing producer...');
      const videoProducer = await producerTransportRef.current.produce({
        track: videoTrack,
        encodings: [
          { maxBitrate: 3000000, scaleResolutionDownBy: 1, maxFramerate: 60 }
        ],
        codecOptions: {
          videoGoogleStartBitrate: 2000,
          videoGoogleMaxBitrate: 6000
        },
        appData: {
          mediaType: 'screen',
          width: videoTrack.getSettings().width,
          height: videoTrack.getSettings().height,
          frameRate: videoTrack.getSettings().frameRate
        }
      });

      console.log('Screen sharing producer created:', videoProducer.id);

      // Set producer after successful creation
      setScreenProducer(videoProducer);
      setIsScreenSharing(true);

      // Handle producer events
      videoProducer.on('transportclose', () => {
        console.log('Screen sharing transport closed');
        stopScreenSharing();
      });

      videoProducer.on('trackended', () => {
        console.log('Screen sharing track ended');
        stopScreenSharing();
      });

    } catch (error) {
      console.error('Error starting screen share:', error);
      // Make sure to clean up if there's an error
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
      setScreenStream(null);
      setScreenProducer(null);
      setIsScreenSharing(false);
      setError('Failed to start screen sharing: ' + error.message);
    }
  };

  const stopScreenSharing = async () => {
    console.log('Stopping screen sharing...');

    try {
      // Сначала уведомляем сервер для обработки удаления на удаленной стороне
      if (screenProducer && socketRef.current) {
        socketRef.current.emit('stopScreenSharing', {
          producerId: screenProducer.id
        });
      }

      // Удаляем только свой локальный экран
      setRemoteScreens(prev => {
        const newScreens = new Map(prev);
        if (socketRef.current) {
          newScreens.delete(socketRef.current.id);
        }
        return newScreens;
      });

      // Закрываем producer
      if (screenProducer) {
        screenProducer.close();
        setScreenProducer(null);
      }

      // Останавливаем все треки в потоке экрана
      if (screenStream) {
        const tracks = screenStream.getTracks();
        tracks.forEach(track => {
          track.stop();
          screenStream.removeTrack(track);
        });
        setScreenStream(null);
      }

      setIsScreenSharing(false);
    } catch (error) {
      console.error('Error stopping screen share:', error);
      // Принудительная очистка даже при ошибке
      setScreenProducer(null);
      setScreenStream(null);
      setIsScreenSharing(false);
    }
  };

  const startVideo = async () => {
    try {
      if (!producerTransportRef.current) {
        throw new Error('Transport not ready');
      }

      // Остановить текущее видео если есть
      if (isVideoEnabled) {
        await stopVideo();
      }

      console.log('Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 60, max: 60 },
          facingMode: 'user',
          aspectRatio: { ideal: 16/9 }
        }
      });

      console.log('Camera access granted');

      // Обработка остановки трека
      stream.getVideoTracks()[0].onended = () => {
        console.log('Camera track ended');
        stopVideo();
      };

      // Сохраняем поток
      setVideoStream(stream);

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No video track available');
      }

      console.log('Creating video producer...');
      const producer = await producerTransportRef.current.produce({
        track: videoTrack,
        encodings: [
          { maxBitrate: 1500000, scaleResolutionDownBy: 1, maxFramerate: 60 }
        ],
        codecOptions: {
          videoGoogleStartBitrate: 1500,
          videoGoogleMaxBitrate: 3000
        },
        appData: {
          mediaType: 'webcam'
        }
      });

      console.log('Video producer created:', producer.id);

      // Сохраняем producer
      setVideoProducer(producer);
      setIsVideoEnabled(true);

      // Обработчики событий producer
      producer.on('transportclose', () => {
        console.log('Video transport closed');
        stopVideo();
      });

      producer.on('trackended', () => {
        console.log('Video track ended');
        stopVideo();
      });

    } catch (error) {
      console.error('Error starting video:', error);
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
      setVideoStream(null);
      setVideoProducer(null);
      setIsVideoEnabled(false);
      setError('Failed to start video: ' + error.message);
    }
  };

  const stopVideo = async () => {
    console.log('Stopping video...');

    try {
      // Сначала закрываем producer
      if (videoProducer) {
        console.log('Closing video producer:', videoProducer.id);
        videoProducer.close();
        
        // Уведомляем сервер о закрытии producer'а
        if (socketRef.current) {
          console.log('Notifying server about video producer closure');
          socketRef.current.emit('producerClosed', {
            producerId: videoProducer.id,
            producerSocketId: socketRef.current.id,
            mediaType: 'webcam'
          });
        }
        setVideoProducer(null);
      }

      // Останавливаем треки
      if (videoStream) {
        console.log('Stopping video tracks');
        videoStream.getTracks().forEach(track => {
          track.stop();
        });
        setVideoStream(null);
      }

      setIsVideoEnabled(false);
    } catch (error) {
      console.error('Error stopping video:', error);
      setVideoProducer(null);
      setVideoStream(null);
      setIsVideoEnabled(false);
    }
  };

  const detectSpeaking = async (analyser, peerId, producerId = null) => {
    try {
      console.log('Initializing voice detection for peer:', peerId, 'producerId:', producerId);
      
      if (!audioContextRef.current) {
        console.error('AudioContext not initialized');
        return;
      }

      if (!audioContextRef.current.audioWorklet) {
        console.error('AudioWorklet not supported');
        return;
      }

      // Загружаем воркер если еще не загружен
      try {
        await audioContextRef.current.audioWorklet.addModule(voiceDetectorWorklet);
        console.log('Voice detector worklet loaded successfully');
      } catch (error) {
        console.error('Failed to load voice detector worklet:', error);
        return;
      }

      // Создаем узел воркера
      const voiceDetectorNode = new AudioWorkletNode(audioContextRef.current, 'voice-detector', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1
      });
      
      console.log('Voice detector node created');

      // Получаем поток для обработки
      let stream;
      if (peerId === socketRef.current?.id) {
        stream = noiseSuppressionRef.current?.getProcessedStream() || localStreamRef.current;
        console.log('Using local stream for voice detection');
      } else {
        // Добавляем механизм повторных попыток для получения consumer'а
        let retries = 0;
        const maxRetries = 5;
        const retryDelay = 1000; // 1 секунда между попытками

        while (retries < maxRetries) {
          // Сначала пытаемся найти по producerId если он есть
          let consumer;
          if (producerId) {
            consumer = [...consumersRef.current.values()].find(c => c.producerId === producerId);
            console.log('Searching consumer by producerId:', producerId, 'found:', !!consumer);
          }
          
          // Если не нашли по producerId, пробуем по peerId
          if (!consumer) {
            consumer = [...consumersRef.current.values()].find(c => 
              c.appData?.peerId === peerId && c.kind === 'audio'
            );
            console.log('Searching consumer by peerId:', peerId, 'found:', !!consumer);
          }
          
          if (consumer) {
            stream = new MediaStream([consumer.track]);
            console.log('Found consumer and created stream for peer:', peerId);
            break;
          }

          console.log(`Attempt ${retries + 1}/${maxRetries} to get consumer for peer:`, peerId);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retries++;
        }

        if (!stream) {
          console.error(`Failed to get consumer for peer ${peerId} after ${maxRetries} attempts`);
          return;
        }
      }

      if (!stream) {
        console.error('No stream available for voice detection');
        return;
      }

      // Отключаем старые соединения
      analyser.disconnect();
      console.log('Disconnected old analyzer');

      // Создаем новый источник из потока
      const source = audioContextRef.current.createMediaStreamSource(stream);
      console.log('Created media stream source');

      // Подключаем узлы
      source.connect(voiceDetectorNode);
      console.log('Connected source to voice detector');

      // Обработчик сообщений от воркера
      voiceDetectorNode.port.onmessage = (event) => {
        const { speaking } = event.data;
        console.log('Voice detection event:', { peerId, speaking });
        
        // Проверяем состояние мьюта
        if ((peerId === socketRef.current?.id && isMuted) || 
            (peerId !== socketRef.current?.id && (volumes.get(peerId) || 100) === 0)) {
          if (speakingStates.get(peerId)) {
            setSpeakingStates(prev => {
              const newStates = new Map(prev);
              newStates.set(peerId, false);
              return newStates;
            });
            if (socketRef.current && peerId === socketRef.current.id) {
              socketRef.current.emit('speaking', { speaking: false });
            }
          }
          return;
        }

        // Обновляем состояние говорения
        setSpeakingStates(prev => {
          const newStates = new Map(prev);
          newStates.set(peerId, speaking);
          return newStates;
        });
        
        // Отправляем состояние на сервер только для локального пользователя
        if (socketRef.current && peerId === socketRef.current.id) {
          socketRef.current.emit('speaking', { speaking });
        }
      };

      // Сохраняем ссылку на узел для очистки
      if (!audioRef.current.has(peerId)) {
        audioRef.current.set(peerId, new Map());
      }
      audioRef.current.get(peerId).set('voiceDetector', voiceDetectorNode);

      console.log('Voice detection setup completed for peer:', peerId);
    } catch (error) {
      console.error('Error in voice detection setup:', error);
    }
  };

  // Update analyzer settings when creating audio nodes
  const createAudioAnalyser = (audioContext) => {
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;  // Higher FFT size for better frequency resolution
    analyser.smoothingTimeConstant = 0.2;  // Reduced for faster response
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    return analyser;
  };

  // Обновляем renderScreenShares
  const renderScreenShares = useMemo(() => {
    return (
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '8px',
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {isScreenSharing && screenStream && (
          <Box sx={styles.videoItem}>
            <Box sx={styles.screenShareItem}>
              <VideoPlayer stream={screenStream} />
              <Typography sx={styles.screenShareUserName}>
                <ScreenShare sx={{ fontSize: 16 }} />
                {userName}
              </Typography>
            </Box>
          </Box>
        )}
        {Array.from(remoteScreens.entries()).map(([peerId, screenData]) => {
          const peer = peers.get(peerId);
          if (!peer) return null;

          return (
            <Box key={peerId} sx={styles.videoItem}>
              <Box sx={styles.screenShareItem}>
                <VideoPlayer stream={screenData?.stream || null} />
                <Typography sx={styles.screenShareUserName}>
                  <ScreenShare sx={{ fontSize: 16 }} />
                  {peer.name}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    );
  }, [isScreenSharing, screenStream, remoteScreens, peers, userName]);

  // Обновляем renderVideos
  const renderVideos = useMemo(() => {
    return null;
  }, []);

  // Добавляем функцию переключения режима динамика
  const toggleSpeakerMode = async () => {
    const newMode = !useEarpiece;
    setUseEarpiece(newMode);
    
    // Применяем новый режим ко всем аудио элементам
    for (const [_, audio] of audioRef.current.entries()) {
      await setAudioOutput(audio, newMode);
    }
  };

  // Add noise suppression toggle handler
  const handleNoiseSuppressionToggle = async () => {
    try {
      if (!noiseSuppressionRef.current || !localStreamRef.current) {
        console.error('Noise suppression or stream not initialized');
        return;
      }

      const newState = !isNoiseSuppressed;
      let success = false;

      if (newState) {
        success = await noiseSuppressionRef.current.enable(noiseSuppressionMode);
      } else {
        success = await noiseSuppressionRef.current.disable();
      }

      if (success) {
        setIsNoiseSuppressed(newState);
        console.log('Noise suppression ' + (newState ? 'enabled' : 'disabled'));
      }
    } catch (error) {
      console.error('Error toggling noise suppression:', error);
    }
  };

  // Add noise suppression menu handlers
  const handleNoiseSuppressionMenuOpen = (event) => {
    setNoiseSuppressMenuAnchor(event.currentTarget);
  };

  const handleNoiseSuppressionMenuClose = () => {
    setNoiseSuppressMenuAnchor(null);
  };

  const handleNoiseSuppressionModeSelect = async (mode) => {
    try {
      if (!noiseSuppressionRef.current || !localStreamRef.current) {
        console.error('Noise suppression or stream not initialized');
        return;
      }

      let success = false;

      if (!isNoiseSuppressed) {
        success = await noiseSuppressionRef.current.enable(mode);
      } else if (mode !== noiseSuppressionMode) {
        // Если меняем режим при включенном шумоподавлении
        success = await noiseSuppressionRef.current.enable(mode);
      }

      if (success) {
        setNoiseSuppressionMode(mode);
        setIsNoiseSuppressed(true);
        console.log('Noise suppression mode changed to:', mode);
      }
    } catch (error) {
      console.error('Error changing noise suppression mode:', error);
    }
    handleNoiseSuppressionMenuClose();
  };

  const handleConsume = async (producer) => {
    try {
      console.log('Handling producer:', producer);
      
      if (producer.producerSocketId === socketRef.current.id) {
        console.log('Skipping own producer');
        return;
      }
      
      const transport = await createConsumerTransport();
      console.log('Consumer transport created:', transport.id);
      
      const { rtpCapabilities } = deviceRef.current;
      
      const { id, producerId, kind, rtpParameters, appData } = await new Promise((resolve, reject) => {
        socketRef.current.emit('consume', {
          rtpCapabilities,
          remoteProducerId: producer.producerId,
          transportId: transport.id
        }, (response) => {
          if (response.error) {
            console.error('Consume request failed:', response.error);
            reject(new Error(response.error));
            return;
          }
          resolve(response);
        });
      });

      if (!id || !producerId || !kind || !rtpParameters) {
        throw new Error('Invalid consumer data received from server');
      }

      const consumer = await transport.consume({
        id,
        producerId,
        kind,
        rtpParameters,
        appData
      });

      console.log('Consumer created:', consumer.id);
      consumersRef.current.set(consumer.id, consumer);

      const stream = new MediaStream([consumer.track]);

      if (appData?.mediaType === 'screen') {
        console.log('Processing screen sharing stream:', { kind, appData });
        
        if (kind === 'video') {
          console.log('Setting up screen sharing video');
          setRemoteScreens(prev => {
            const newScreens = new Map(prev);
            newScreens.set(producer.producerSocketId, { 
              producerId,
              consumerId: consumer.id,
              stream
            });
            return newScreens;
          });
        }
      } else if (appData?.mediaType === 'webcam') {
        console.log('Processing webcam stream:', { kind, appData });
        
        if (kind === 'video') {
          console.log('Setting up webcam stream');
          setRemoteVideos(prev => {
            const newVideos = new Map(prev);
            newVideos.set(producer.producerSocketId, {
              producerId,
              consumerId: consumer.id,
              stream
            });
            return newVideos;
          });
        }
      } else if (kind === 'audio') {
        try {
          const audio = new Audio();
          audio.srcObject = stream;
          audio.id = `audio-${producer.producerSocketId}`;
          audio.autoplay = true;
          audio.muted = !isAudioEnabledRef.current; // Use ref for current state

          if (isMobile) {
            await setAudioOutput(audio, useEarpiece);
          }
          
          const audioContext = audioContextRef.current;
          const source = audioContext.createMediaStreamSource(stream);
          
          const analyser = createAudioAnalyser(audioContext);
          
          const gainNode = audioContext.createGain();
          gainNode.gain.value = isAudioEnabledRef.current ? 1.0 : 0.0; // Use ref for current state

          source.connect(analyser);
          analyser.connect(gainNode);
          gainNode.connect(audioContext.destination);

          analyserNodesRef.current.set(producer.producerSocketId, analyser);
          gainNodesRef.current.set(producer.producerSocketId, gainNode);
          audioRef.current.set(producer.producerSocketId, audio);
          setVolumes(prev => new Map(prev).set(producer.producerSocketId, 100));

          // Start voice detection with producerId
          detectSpeaking(analyser, producer.producerSocketId, producer.producerId);
        } catch (error) {
          console.error('Error setting up audio:', error);
        }
      }

      consumer.on('transportclose', () => {
        console.log('Consumer transport closed');
        consumer.close();
        consumersRef.current.delete(consumer.id);
      });

      consumer.on('producerclose', () => {
        console.log('Producer closed');
        consumer.close();
        consumersRef.current.delete(consumer.id);
      });

      consumer.on('trackended', () => {
        console.log('Track ended');
        consumer.close();
        consumersRef.current.delete(consumer.id);
      });

      return consumer;
    } catch (error) {
      console.error('Error consuming producer:', error);
      throw error;
    }
  };

  // Update toggleAudio function
  const toggleAudio = useCallback(() => {
    const newState = !isAudioEnabled;
    setIsAudioEnabled(newState);
    isAudioEnabledRef.current = newState; // Update ref immediately

    // Emit audio state change
    if (socketRef.current) {
      socketRef.current.emit('audioState', { isEnabled: newState });
    }

    // Mute/unmute all audio elements
    audioRef.current.forEach((audio) => {
      if (audio instanceof HTMLAudioElement) {
        audio.muted = !newState;
      }
    });

    // Mute/unmute all gain nodes
    gainNodesRef.current.forEach((gainNode) => {
      if (gainNode) {
        gainNode.gain.value = newState ? 1.0 : 0.0;
      }
    });
  }, [isAudioEnabled]);

  // Add initial audio state when joining
  useEffect(() => {
    if (isJoined && socketRef.current) {
      socketRef.current.emit('audioState', { isEnabled: isAudioEnabled });
    }
  }, [isJoined, isAudioEnabled]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Add audio state change handler
    socket.on('peerAudioStateChanged', ({ peerId, isEnabled }) => {
      setAudioStates(prev => {
        const newStates = new Map(prev);
        newStates.set(peerId, isEnabled);
        return newStates;
      });
    });

    return () => {
      socket.off('peerAudioStateChanged');
    };
  }, [socketRef.current]);

  // Add effect to update isAudioEnabledRef
  useEffect(() => {
    isAudioEnabledRef.current = isAudioEnabled;
  }, [isAudioEnabled]);

  useEffect(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.on('peerJoined', handlePeerJoined);
      socket.on('peerLeft', handlePeerLeft);
    }
    return () => {
      if (socket) {
        socket.off('peerJoined', handlePeerJoined);
        socket.off('peerLeft', handlePeerLeft);
      }
    };
  }, [handlePeerJoined, handlePeerLeft]);

  if (!isJoined) {
    return (
      <Box sx={styles.root}>
        <Container maxWidth="sm" sx={{ mt: 4 }}>
          <Paper sx={styles.joinPaper}>
            <Typography variant="h5" gutterBottom sx={{ color: '#ffffff' }}>
              Join Voice Channel
            </Typography>
            <TextField
              fullWidth
              label="Channel ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              margin="normal"
              disabled={isJoining}
              sx={styles.textField}
            />
            <TextField
              fullWidth
              label="Your Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              margin="normal"
              disabled={isJoining}
              sx={styles.textField}
            />
            <Button
              fullWidth
              variant="contained"
              onClick={handleJoin}
              disabled={!roomId || !userName || isJoining}
              sx={{ ...styles.joinButton, mt: 2 }}
            >
              {isJoining ? 'Joining...' : 'Join Channel'}
            </Button>
            {error && (
              <Typography color="error" sx={{ mt: 2 }}>
                {error}
              </Typography>
            )}
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <MuteProvider socket={socketRef.current}>
      <Box sx={styles.root}>
        <AppBar position="static" sx={styles.appBar}>
          <Toolbar sx={styles.toolbar}>
            <Box sx={styles.channelName}>
              <Tag />
              <Typography variant="subtitle1">
                {roomId}
              </Typography>
            </Box>

          </Toolbar>
        </AppBar>
        <Container sx={styles.container}>
          <Box sx={styles.videoGrid}>
            {/* Local user */}
            <Box sx={styles.videoItem} className={speakingStates.get(socketRef.current?.id) ? 'speaking' : ''}>
              {isVideoEnabled && videoStream ? (
                <VideoView 
                  stream={videoStream} 
                  peerName={userName}
                  isMuted={isMuted}
                  isSpeaking={speakingStates.get(socketRef.current?.id)}
                  isAudioEnabled={isAudioEnabled}
                  isLocal={true}
                />
              ) : (
                <div style={{ 
                  position: 'relative', 
                  width: '100%', 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <Box sx={styles.userAvatar}>
                    {userName[0].toUpperCase()}
                  </Box>
                  <VideoOverlay
                    peerName={userName}
                    isMuted={isMuted}
                    isSpeaking={speakingStates.get(socketRef.current?.id)}
                    isAudioEnabled={isAudioEnabled}
                    isLocal={true}
                  />
                </div>
              )}
            </Box>

            {/* Remote users */}
            {Array.from(peers.values()).map((peer) => (
              <Box key={peer.id} sx={styles.videoItem} className={speakingStates.get(peer.id) ? 'speaking' : ''}>
                {remoteVideos.get(peer.id)?.stream ? (
                  <VideoView
                    stream={remoteVideos.get(peer.id).stream}
                    peerName={peer.name}
                    isMuted={peer.isMuted}
                    isSpeaking={speakingStates.get(peer.id)}
                    isAudioEnabled={audioStates.get(peer.id)}
                    isLocal={false}
                    onVolumeClick={() => handleVolumeChange(peer.id)}
                    volume={volumes.get(peer.id) || 100}
                  />
                ) : (
                  <div style={{ 
                    position: 'relative', 
                    width: '100%', 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    <Box sx={styles.userAvatar}>
                      {peer.name[0].toUpperCase()}
                    </Box>
                    <VideoOverlay
                      peerName={peer.name}
                      isMuted={peer.isMuted}
                      isSpeaking={speakingStates.get(peer.id)}
                      isAudioEnabled={audioStates.get(peer.id)}
                      isLocal={false}
                      onVolumeClick={() => handleVolumeChange(peer.id)}
                      volume={volumes.get(peer.id) || 100}
                    />
                  </div>
                )}
              </Box>
            ))}

            {/* Screen sharing */}
            {(isScreenSharing || remoteScreens.size > 0) && renderScreenShares}
            {/* Video */}
            {(isVideoEnabled || remoteVideos.size > 0) && renderVideos}
          </Box>
        </Container>
        <Box sx={styles.bottomBar}>
          <Box sx={styles.controlsContainer}>
            <Box sx={styles.controlGroup}>
              <IconButton
                sx={styles.iconButton}
                onClick={handleMute}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff /> : <Mic />}
              </IconButton>
              <IconButton
                sx={styles.iconButton}
                onClick={isVideoEnabled ? stopVideo : startVideo}
                title={isVideoEnabled ? "Stop camera" : "Start camera"}
              >
                {isVideoEnabled ? <VideocamOff /> : <Videocam />}
              </IconButton>
              <IconButton
                sx={styles.iconButton}
                onClick={toggleAudio}
                title={isAudioEnabled ? "Disable audio output" : "Enable audio output"}
              >
                {isAudioEnabled ? <Headset /> : <HeadsetOff />}
              </IconButton>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton
                  sx={styles.iconButton}
                  onClick={handleNoiseSuppressionToggle}
                  title={isNoiseSuppressed ? "Disable noise suppression" : "Enable noise suppression"}
                  disabled={!noiseSuppressionRef.current?.isInitialized()}
                >
                  {isNoiseSuppressed ? <NoiseAware /> : <NoiseControlOff />}
                </IconButton>
                <IconButton
                  size="small"
                  sx={styles.iconButton}
                  onClick={handleNoiseSuppressionMenuOpen}
                  disabled={!noiseSuppressionRef.current?.isInitialized()}
                >
                  <ExpandMore />
                </IconButton>
                <Menu
                  anchorEl={noiseSuppressMenuAnchor}
                  open={Boolean(noiseSuppressMenuAnchor)}
                  onClose={handleNoiseSuppressionMenuClose}
                >
                  <MenuItem 
                    onClick={() => handleNoiseSuppressionModeSelect('rnnoise')}
                    selected={noiseSuppressionMode === 'rnnoise'}
                  >
                    RNNoise (AI-based)
                  </MenuItem>
                  <MenuItem 
                    onClick={() => handleNoiseSuppressionModeSelect('speex')}
                    selected={noiseSuppressionMode === 'speex'}
                  >
                    Speex (Classic)
                  </MenuItem>
                  <MenuItem 
                    onClick={() => handleNoiseSuppressionModeSelect('noisegate')}
                    selected={noiseSuppressionMode === 'noisegate'}
                  >
                    Noise Gate
                  </MenuItem>
                </Menu>
              </Box>
            </Box>
            <Box sx={styles.controlGroup}>
              <IconButton
                sx={styles.iconButton}
                onClick={isScreenSharing ? stopScreenSharing : startScreenSharing}
                title={isScreenSharing ? "Stop sharing" : "Share screen"}
              >
                {isScreenSharing ? <StopScreenShare /> : <ScreenShare />}
              </IconButton>
              {isMobile && (
                <IconButton
                  sx={styles.iconButton}
                  onClick={toggleSpeakerMode}
                  title={useEarpiece ? "Switch to speaker" : "Switch to earpiece"}
                >
                  {useEarpiece ? <Hearing /> : <VolumeUpRounded />}
                </IconButton>
              )}
            </Box>
          </Box>
          <Button
            variant="contained"
            sx={styles.leaveButton}
            onClick={handleLeaveCall}
            startIcon={<PhoneDisabled />}
          >
            Leave
          </Button>
        </Box>
      </Box>
    </MuteProvider>
  );
}

export default App;