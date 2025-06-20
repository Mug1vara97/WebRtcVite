import {
  loadSpeex,
  SpeexWorkletNode,
  loadRnnoise,
  RnnoiseWorkletNode,
  NoiseGateWorkletNode
} from '@sapphi-red/web-noise-suppressor';
import speexWorkletPath from '@sapphi-red/web-noise-suppressor/speexWorklet.js?url';
import noiseGateWorkletPath from '@sapphi-red/web-noise-suppressor/noiseGateWorklet.js?url';
import rnnoiseWorkletPath from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';
import speexWasmPath from '@sapphi-red/web-noise-suppressor/speex.wasm?url';
import rnnoiseWasmPath from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseWasmSimdPath from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';

export class NoiseSuppressionManager {
  constructor() {
    this.audioContext = null;
    this.stream = null;
    this.sourceNode = null;
    this.noiseNode = null;
    this.gainNode = null;
    this.destinationNode = null;
    this.initialized = false;
    this.wasmBinaries = {
      speex: null,
      rnnoise: null
    };
    this.originalTrack = null;
  }

  async initialize(stream) {
    try {
      if (this.initialized) {
        console.log('Already initialized');
        return true;
      }

      if (!stream) {
        console.error('No stream provided');
        return false;
      }

      this.stream = stream;
      // Store original track reference
      this.originalTrack = stream.getAudioTracks()[0];
      
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      console.log('Loading WASM binaries...');
      // Load WASM binaries
      const [speexWasmBinary, rnnoiseWasmBinary] = await Promise.all([
        loadSpeex({ url: speexWasmPath }),
        loadRnnoise({
          url: rnnoiseWasmPath,
          simdUrl: rnnoiseWasmSimdPath
        })
      ]);

      this.wasmBinaries.speex = speexWasmBinary;
      this.wasmBinaries.rnnoise = rnnoiseWasmBinary;

      console.log('Loading worklet modules...');
      // Add worklet modules
      await Promise.all([
        this.audioContext.audioWorklet.addModule(speexWorkletPath),
        this.audioContext.audioWorklet.addModule(noiseGateWorkletPath),
        this.audioContext.audioWorklet.addModule(rnnoiseWorkletPath)
      ]);

      // Create nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.destinationNode = this.audioContext.createMediaStreamDestination();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;

      // Connect source directly to destination initially
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.destinationNode);

      console.log('Noise suppression initialized');
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing noise suppression:', error);
      return false;
    }
  }

  async enable(mode = 'rnnoise') {
    try {
      if (!this.audioContext || !this.stream || !this.initialized) {
        console.error('Not initialized');
        return false;
      }

      // Disconnect all nodes first
      this.sourceNode.disconnect();
      if (this.noiseNode) {
        this.noiseNode.disconnect();
        this.noiseNode.destroy?.();
        this.noiseNode = null;
      }
      this.gainNode.disconnect();

      // Create new noise node based on mode
      switch (mode) {
        case 'rnnoise': {
          this.noiseNode = new RnnoiseWorkletNode(this.audioContext, {
            wasmBinary: this.wasmBinaries.rnnoise,
            maxChannels: 1
          });
          break;
        }
        case 'speex': {
          this.noiseNode = new SpeexWorkletNode(this.audioContext, {
            wasmBinary: this.wasmBinaries.speex,
            maxChannels: 1
          });
          break;
        }
        case 'noisegate': {
          this.noiseNode = new NoiseGateWorkletNode(this.audioContext, {
            openThreshold: -50,
            closeThreshold: -60,
            holdMs: 90,
            maxChannels: 1
          });
          break;
        }
        default:
          throw new Error(`Unsupported noise suppression mode: ${mode}`);
      }

      // Connect nodes with noise suppression
      this.sourceNode.connect(this.noiseNode);
      this.noiseNode.connect(this.gainNode);
      this.gainNode.connect(this.destinationNode);

      // Get the processed track
      const processedTrack = this.destinationNode.stream.getAudioTracks()[0];
      
      // Replace the track in the stream
      if (processedTrack) {
        const oldTrack = this.stream.getAudioTracks()[0];
        if (oldTrack) {
          oldTrack.enabled = false;
          this.stream.removeTrack(oldTrack);
          if (oldTrack !== this.originalTrack) {
            oldTrack.stop();
          }
        }
        this.stream.addTrack(processedTrack);
      }

      console.log(`Noise suppression enabled with mode: ${mode}`);
      return true;
    } catch (error) {
      console.error('Error enabling noise suppression:', error);
      // On error, try to restore original audio
      await this.disable();
      return false;
    }
  }

  async disable() {
    try {
      // Disconnect all nodes
      if (this.sourceNode) {
        this.sourceNode.disconnect();
      }
      
      if (this.noiseNode) {
        this.noiseNode.disconnect();
        this.noiseNode.destroy?.();
        this.noiseNode = null;
      }

      if (this.gainNode) {
        this.gainNode.disconnect();
      }

      // Connect source directly to destination
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.destinationNode);

      // Restore original track
      if (this.stream && this.originalTrack) {
        const currentTrack = this.stream.getAudioTracks()[0];
        if (currentTrack && currentTrack !== this.originalTrack) {
          currentTrack.enabled = false;
          this.stream.removeTrack(currentTrack);
          currentTrack.stop();
        }
        if (!this.stream.getAudioTracks().includes(this.originalTrack)) {
          this.stream.addTrack(this.originalTrack);
        }
        this.originalTrack.enabled = true;
      }

      console.log('Noise suppression disabled');
      return true;
    } catch (error) {
      console.error('Error disabling noise suppression:', error);
      return false;
    }
  }

  async cleanup() {
    await this.disable();
    
    if (this.destinationNode) {
      this.destinationNode.disconnect();
      this.destinationNode = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.stream = null;
    this.sourceNode = null;
    this.originalTrack = null;
    this.wasmBinaries = {
      speex: null,
      rnnoise: null
    };
    this.initialized = false;
  }

  isInitialized() {
    return this.initialized;
  }
} 