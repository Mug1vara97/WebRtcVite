class VoiceDetectorProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this.lastSpeakingState = false;
      this.speakingFrames = 0;
      this.silentFrames = 0;
      this.FRAMES_THRESHOLD = 4;
      this.SPEAKING_THRESHOLD = -50;
    }
  
    process(inputs) {
      const input = inputs[0];
      if (!input || !input[0]) return true;
  
      const samples = input[0];
      
      // Вычисляем RMS
      let rms = 0;
      for (let i = 0; i < samples.length; i++) {
        rms += samples[i] * samples[i];
      }
      rms = Math.sqrt(rms / samples.length);
  
      // Конвертируем в дБ
      const db = 20 * Math.log10(Math.max(rms, 1e-10));
  
      // Определяем состояние голоса
      const isSpeakingNow = db > this.SPEAKING_THRESHOLD;
  
      if (isSpeakingNow) {
        this.speakingFrames++;
        this.silentFrames = 0;
      } else {
        this.speakingFrames = 0;
        this.silentFrames++;
      }
  
      // Применяем гистерезис для предотвращения частых переключений
      let shouldBeSpeeking = this.lastSpeakingState;
      
      if (this.speakingFrames >= this.FRAMES_THRESHOLD) {
        shouldBeSpeeking = true;
      } else if (this.silentFrames >= this.FRAMES_THRESHOLD) {
        shouldBeSpeeking = false;
      }
  
      // Отправляем сообщение только при изменении состояния
      if (shouldBeSpeeking !== this.lastSpeakingState) {
        this.lastSpeakingState = shouldBeSpeeking;
        this.port.postMessage({
          speaking: shouldBeSpeeking,
          level: db
        });
      }
  
      return true;
    }
  }
  
  registerProcessor('voice-detector', VoiceDetectorProcessor); 