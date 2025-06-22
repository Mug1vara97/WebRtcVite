import { contextBridge, desktopCapturer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the desktopCapturer API without exposing the entire API
contextBridge.exposeInMainWorld(
  'electron',
  {
    desktopCapturer: {
      getSources: (opts) => desktopCapturer.getSources(opts)
    }
  }
); 