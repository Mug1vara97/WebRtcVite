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
    this.sourceNode = null;
    this.destinationNode = null;
    this.gainNode = null;
    this.rnnWorkletNode = null;
    this.speexWorkletNode = null;
    this.noiseGateNode = null;
    this.currentMode = null;
    this.producer = null;
    this.originalTrack = null;
    this._isInitialized = false;
    this.wasmBinaries = {
      speex: null,
      rnnoise: null
    };
  }

  async initialize(stream) {
    try {
      if (!stream) {
        console.error('No stream provided');
        return false;
      }

      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      // Load WASM binaries first
      console.log('Loading WASM binaries...');
      const [speexWasmBinary, rnnoiseWasmBinary] = await Promise.all([
        loadSpeex({ url: speexWasmPath }),
        loadRnnoise({
          url: rnnoiseWasmPath,
          simdUrl: rnnoiseWasmSimdPath
        })
      ]);

      this.wasmBinaries.speex = speexWasmBinary;
      this.wasmBinaries.rnnoise = rnnoiseWasmBinary;

      // Create source from input stream
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);

      // Store original track for later use
      this.originalTrack = stream.getAudioTracks()[0].clone();

      // Create destination node
      this.destinationNode = this.audioContext.createMediaStreamDestination();
      this.destinationNode.channelCount = 2;
      this.destinationNode.channelCountMode = 'explicit';
      this.destinationNode.channelInterpretation = 'speakers';

      // Initialize worklet processors
      console.log('Loading worklet modules...');
      await Promise.all([
        this.audioContext.audioWorklet.addModule(rnnoiseWorkletPath),
        this.audioContext.audioWorklet.addModule(speexWorkletPath),
        this.audioContext.audioWorklet.addModule(noiseGateWorkletPath)
      ]);

      // Create worklet nodes with stereo support
      this.rnnWorkletNode = new RnnoiseWorkletNode(this.audioContext, {
        wasmBinary: this.wasmBinaries.rnnoise,
        maxChannels: 2
      });

      this.speexWorkletNode = new SpeexWorkletNode(this.audioContext, {
        wasmBinary: this.wasmBinaries.speex,
        maxChannels: 2
      });

      this.noiseGateNode = new NoiseGateWorkletNode(this.audioContext, {
        openThreshold: -50,
        closeThreshold: -60,
        holdMs: 90,
        maxChannels: 2
      });

      // Create gain node
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;

      // Connect source to destination initially
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.destinationNode);

      this._isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize noise suppression:', error);
      return false;
    }
  }

  isInitialized() {
    return this._isInitialized;
  }

  async enable(mode = 'rnnoise') {
    try {
      if (!this._isInitialized) {
        console.error('Not initialized');
        return false;
      }

      // Disconnect current processing chain
      this.sourceNode.disconnect();
      this.gainNode.disconnect();

      let processingNode;
      switch (mode) {
        case 'rnnoise':
          processingNode = this.rnnWorkletNode;
          break;
        case 'speex':
          processingNode = this.speexWorkletNode;
          break;
        case 'noisegate':
          processingNode = this.noiseGateNode;
          break;
        default:
          throw new Error('Invalid noise suppression mode');
      }

      // Connect new processing chain
      this.sourceNode.connect(processingNode);
      processingNode.connect(this.gainNode);
      this.gainNode.connect(this.destinationNode);

      this.currentMode = mode;

      // Update producer track if exists
      if (this.producer) {
        const newTrack = this.destinationNode.stream.getAudioTracks()[0];
        await this.producer.replaceTrack({ track: newTrack });
      }

      return true;
    } catch (error) {
      console.error('Error enabling noise suppression:', error);
      return false;
    }
  }

  async disable() {
    try {
      if (!this._isInitialized) {
        console.error('Not initialized');
        return false;
      }

      // Disconnect all processing nodes
      this.sourceNode.disconnect();
      if (this.currentMode) {
        switch (this.currentMode) {
          case 'rnnoise':
            this.rnnWorkletNode.disconnect();
            break;
          case 'speex':
            this.speexWorkletNode.disconnect();
            break;
          case 'noisegate':
            this.noiseGateNode.disconnect();
            break;
        }
      }
      this.gainNode.disconnect();

      // Reconnect direct path
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.destinationNode);

      this.currentMode = null;

      // Update producer track if exists
      if (this.producer) {
        const newTrack = this.destinationNode.stream.getAudioTracks()[0];
        await this.producer.replaceTrack({ track: newTrack });
      }

      return true;
    } catch (error) {
      console.error('Error disabling noise suppression:', error);
      return false;
    }
  }

  setProducer(producer) {
    this.producer = producer;
  }

  cleanup() {
    try {
      if (this.currentMode) {
        this.disable();
      }

      if (this.audioContext) {
        this.audioContext.close();
      }

      if (this.originalTrack) {
        this.originalTrack.stop();
      }

      // Destroy worklet nodes
      this.rnnWorkletNode?.destroy?.();
      this.speexWorkletNode?.destroy?.();

      this.audioContext = null;
      this.sourceNode = null;
      this.destinationNode = null;
      this.gainNode = null;
      this.rnnWorkletNode = null;
      this.speexWorkletNode = null;
      this.noiseGateNode = null;
      this.currentMode = null;
      this.producer = null;
      this.originalTrack = null;
      this._isInitialized = false;
      this.wasmBinaries = {
        speex: null,
        rnnoise: null
      };
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
} 