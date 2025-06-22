// Проверяем, запущено ли приложение в Electron
const isElectron = window.electron !== undefined;

// Получаем список источников для демонстрации
export const getSources = async () => {
  if (!isElectron) {
    // Если не Electron, используем стандартный getDisplayMedia
    return null;
  }

  try {
    // Получаем список источников через IPC
    const sources = await window.electron.desktopCapturer.getSources({ 
      types: ['window', 'screen'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true
    });

    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      type: source.id.includes('screen') ? 'screen' : 'window',
      appIcon: source.appIcon?.toDataURL()
    }));
  } catch (error) {
    console.error('Error getting sources:', error);
    return null;
  }
};

// Захват выбранного источника
export const captureSource = async (sourceId) => {
  try {
    if (!isElectron) {
      // Для веб-версии используем стандартный API
      return navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          frameRate: { ideal: 60, max: 60 }
        },
        audio: false
      });
    }

    // Для Electron используем специальный API
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          minWidth: 1280,
          maxWidth: 1280,
          minHeight: 720,
          maxHeight: 720,
          frameRate: { ideal: 60, max: 60 }
        }
      }
    });

    return stream;
  } catch (error) {
    console.error('Error capturing source:', error);
    throw error;
  }
}; 