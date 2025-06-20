import {
  RNNoiseNode,
  SpeexWorkletNode,
  NoiseGateWorkletNode
} from '@sapphi-red/web-noise-suppressor'

// Пути к воркерам
const RNNOISE_WORKLET_PATH = '/worklets/rnnoise-processor.js'
const SPEEX_WORKLET_PATH = '/worklets/speex-processor.js'
const NOISEGATE_WORKLET_PATH = '/worklets/noisegate-processor.js'

// Пути к WASM файлам
const RNNOISE_WASM_PATH = '/wasm/rnnoise.wasm'
const RNNOISE_SIMD_WASM_PATH = '/wasm/rnnoise-simd.wasm'
const SPEEX_WASM_PATH = '/wasm/speex.wasm'

export class NoiseSuppressionManager {
  constructor() {
    this.audioContext = null;
    this.stream = null;
    this.sourceNode = null;
    this.noiseNode = null;
    this.destinationNode = null;
    this.initialized = false;
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
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      // Create source node
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      
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

      // Cleanup previous node if exists
      await this.cleanup();

      // Create destination node if not exists
      if (!this.destinationNode) {
        this.destinationNode = this.audioContext.createMediaStreamDestination();
      }

      switch (mode) {
        case 'rnnoise': {
          this.noiseNode = new RNNoiseNode(this.audioContext, {
            wasmUrl: RNNOISE_WASM_PATH,
            simdWasmUrl: RNNOISE_SIMD_WASM_PATH,
            workletUrl: RNNOISE_WORKLET_PATH
          });
          break;
        }
        case 'speex': {
          this.noiseNode = new SpeexWorkletNode(this.audioContext, {
            wasmUrl: SPEEX_WASM_PATH,
            workletUrl: SPEEX_WORKLET_PATH
          });
          break;
        }
        case 'noisegate': {
          this.noiseNode = new NoiseGateWorkletNode(this.audioContext, {
            workletUrl: NOISEGATE_WORKLET_PATH,
            threshold: -30,
            attackTime: 0.02,
            releaseTime: 0.1
          });
          break;
        }
        default:
          throw new Error(`Unsupported noise suppression mode: ${mode}`);
      }

      // Connect nodes
      this.sourceNode.disconnect();
      this.sourceNode.connect(this.noiseNode);
      this.noiseNode.connect(this.destinationNode);

      // Replace audio track
      const oldTrack = this.stream.getAudioTracks()[0];
      const newTrack = this.destinationNode.stream.getAudioTracks()[0];
      
      if (oldTrack && newTrack) {
        oldTrack.enabled = false;
        this.stream.removeTrack(oldTrack);
        this.stream.addTrack(newTrack);
        oldTrack.stop();
      }

      console.log(`Noise suppression enabled with mode: ${mode}`);
      return true;
    } catch (error) {
      console.error('Error enabling noise suppression:', error);
      return false;
    }
  }

  async disable() {
    try {
      if (!this.noiseNode) {
        return true;
      }

      // Disconnect and cleanup nodes
      if (this.sourceNode) {
        this.sourceNode.disconnect();
      }
      
      if (this.noiseNode) {
        this.noiseNode.disconnect();
        this.noiseNode = null;
      }

      // Restore original audio track
      if (this.stream && this.destinationNode) {
        const oldTrack = this.stream.getAudioTracks()[0];
        if (oldTrack) {
          oldTrack.enabled = true;
        }
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

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.stream = null;
    this.sourceNode = null;
    this.initialized = false;
  }

  isInitialized() {
    return this.initialized;
  }
} 