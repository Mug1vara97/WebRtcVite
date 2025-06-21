// Voice detection service worker
let voiceDetectionInterval;
let audioData = null;
let lastSpeakingState = false;
let consecutiveSpeakingFrames = 0;
let consecutiveSilentFrames = 0;
const FRAMES_THRESHOLD = 4;
const SPEAKING_DELAY = 50;
const SILENCE_DELAY = 200;

self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'START_VOICE_DETECTION':
      // Start voice detection in background
      if (!voiceDetectionInterval) {
        const { threshold, peerId } = data;
        startVoiceDetection(threshold, peerId);
      }
      break;

    case 'STOP_VOICE_DETECTION':
      // Stop voice detection
      if (voiceDetectionInterval) {
        clearInterval(voiceDetectionInterval);
        voiceDetectionInterval = null;
      }
      break;

    case 'UPDATE_AUDIO_DATA':
      // Update audio data for processing
      audioData = data;
      break;
  }
});

function startVoiceDetection(threshold = -50, peerId) {
  let speakingStartTime = 0;
  let silenceStartTime = 0;

  voiceDetectionInterval = setInterval(() => {
    try {
      if (!audioData) return;

      // Process audio data
      const { db } = processAudioData(audioData);
      
      // Determine if speaking based on threshold
      const isSpeakingNow = db > threshold;

      const now = Date.now();

      // Update speaking state with reduced delays
      if (isSpeakingNow) {
        consecutiveSpeakingFrames++;
        consecutiveSilentFrames = 0;
        
        if (!speakingStartTime && consecutiveSpeakingFrames >= FRAMES_THRESHOLD) {
          speakingStartTime = now;
          silenceStartTime = 0;
        }
      } else {
        consecutiveSpeakingFrames = 0;
        consecutiveSilentFrames++;
        
        if (!silenceStartTime && consecutiveSilentFrames >= FRAMES_THRESHOLD) {
          silenceStartTime = now;
          speakingStartTime = 0;
        }
      }

      // Update state with hysteresis
      let shouldBeSpeeking = lastSpeakingState;
      
      if (speakingStartTime && (now - speakingStartTime) > SPEAKING_DELAY) {
        shouldBeSpeeking = true;
      } else if (silenceStartTime && (now - silenceStartTime) > SILENCE_DELAY) {
        shouldBeSpeeking = false;
      }

      // Send state update only if changed
      if (shouldBeSpeeking !== lastSpeakingState) {
        lastSpeakingState = shouldBeSpeeking;
        
        self.postMessage({
          type: 'VOICE_STATE',
          data: {
            peerId,
            isSpeaking: shouldBeSpeeking,
            db
          }
        });
      }
    } catch (error) {
      console.error('Error in voice detection:', error);
    }
  }, 50); // Check every 50ms
}

function processAudioData(data) {
  // Calculate RMS value
  let rms = 0;
  for (let i = 0; i < data.length; i++) {
    rms += data[i] * data[i];
  }
  rms = Math.sqrt(rms / data.length);

  // Convert to dB
  const db = 20 * Math.log10(rms);

  return { db };
} 