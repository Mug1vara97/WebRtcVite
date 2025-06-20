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

      console.log('Enabling noise suppression with mode:', mode);
      console.log('Current audio track state:', {
        tracks: this.stream.getAudioTracks().length,
        enabled: this.stream.getAudioTracks()[0]?.enabled,
        readyState: this.stream.getAudioTracks()[0]?.readyState
      });

      // Create new noise node first, before disconnecting anything
      let newNoiseNode;
      switch (mode) {
        case 'rnnoise': {
          console.log('Creating RNNoise node...');
          newNoiseNode = new RnnoiseWorkletNode(this.audioContext, {
            wasmBinary: this.wasmBinaries.rnnoise,
            maxChannels: 1
          });
          break;
        }
        case 'speex': {
          console.log('Creating Speex node...');
          newNoiseNode = new SpeexWorkletNode(this.audioContext, {
            wasmBinary: this.wasmBinaries.speex,
            maxChannels: 1
          });
          break;
        }
        case 'noisegate': {
          console.log('Creating NoiseGate node...');
          newNoiseNode = new NoiseGateWorkletNode(this.audioContext, {
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

      // Create a new destination node
      const newDestination = this.audioContext.createMediaStreamDestination();

      // Connect the new chain first
      console.log('Connecting new audio chain...');
      this.sourceNode.connect(newNoiseNode);
      newNoiseNode.connect(this.gainNode);
      this.gainNode.connect(newDestination);

      // Get the processed track
      const processedTrack = newDestination.stream.getAudioTracks()[0];
      
      if (!processedTrack) {
        throw new Error('Failed to get processed audio track');
      }

      console.log('New processed track created:', {
        id: processedTrack.id,
        enabled: processedTrack.enabled,
        readyState: processedTrack.readyState
      });

      // Now disconnect the old chain
      console.log('Disconnecting old audio chain...');
      this.sourceNode.disconnect();
      if (this.noiseNode) {
        this.noiseNode.disconnect();
        this.noiseNode.destroy?.();
      }
      this.gainNode.disconnect();
      if (this.destinationNode) {
        this.destinationNode.disconnect();
      }

      // Update references
      this.noiseNode = newNoiseNode;
      this.destinationNode = newDestination;

      // Replace the track in the stream
      console.log('Replacing audio track...');
      const oldTrack = this.stream.getAudioTracks()[0];
      if (oldTrack) {
        console.log('Removing old track:', {
          id: oldTrack.id,
          enabled: oldTrack.enabled,
          readyState: oldTrack.readyState
        });
        oldTrack.enabled = false;
        this.stream.removeTrack(oldTrack);
        if (oldTrack !== this.originalTrack) {
          oldTrack.stop();
        }
      }

      this.stream.addTrack(processedTrack);
      processedTrack.enabled = true;

      console.log('Final audio track state:', {
        tracks: this.stream.getAudioTracks().length,
        enabled: this.stream.getAudioTracks()[0]?.enabled,
        readyState: this.stream.getAudioTracks()[0]?.readyState
      });

      console.log(`Noise suppression enabled with mode: ${mode}`);
      return true;
    } catch (error) {
      console.error('Error enabling noise suppression:', error);
      // On error, try to restore original audio
      console.log('Attempting to restore original audio...');
      await this.disable();
      return false;
    }
  }

  async disable() {
    try {
      console.log('Disabling noise suppression...');
      console.log('Current audio track state:', {
        tracks: this.stream.getAudioTracks().length,
        enabled: this.stream.getAudioTracks()[0]?.enabled,
        readyState: this.stream.getAudioTracks()[0]?.readyState
      });

      // Create a new destination node
      const newDestination = this.audioContext.createMediaStreamDestination();

      // Connect source directly to destination first
      console.log('Setting up direct audio chain...');
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(newDestination);

      // Get the direct track
      const directTrack = newDestination.stream.getAudioTracks()[0];

      if (!directTrack) {
        throw new Error('Failed to get direct audio track');
      }

      console.log('New direct track created:', {
        id: directTrack.id,
        enabled: directTrack.enabled,
        readyState: directTrack.readyState
      });

      // Now disconnect the old chain
      console.log('Disconnecting old audio chain...');
      this.sourceNode.disconnect();
      if (this.noiseNode) {
        this.noiseNode.disconnect();
        this.noiseNode.destroy?.();
        this.noiseNode = null;
      }
      this.gainNode.disconnect();
      if (this.destinationNode) {
        this.destinationNode.disconnect();
      }

      // Update destination reference
      this.destinationNode = newDestination;

      // Replace track in the stream
      console.log('Replacing with original track...');
      const currentTrack = this.stream.getAudioTracks()[0];
      if (currentTrack) {
        console.log('Removing current track:', {
          id: currentTrack.id,
          enabled: currentTrack.enabled,
          readyState: currentTrack.readyState
        });
        currentTrack.enabled = false;
        this.stream.removeTrack(currentTrack);
        if (currentTrack !== this.originalTrack) {
          currentTrack.stop();
        }
      }

      // Use the original track if available, otherwise use the direct track
      const trackToAdd = this.originalTrack || directTrack;
      if (!this.stream.getAudioTracks().includes(trackToAdd)) {
        this.stream.addTrack(trackToAdd);
      }
      trackToAdd.enabled = true;

      console.log('Final audio track state:', {
        tracks: this.stream.getAudioTracks().length,
        enabled: this.stream.getAudioTracks()[0]?.enabled,
        readyState: this.stream.getAudioTracks()[0]?.readyState,
        usingOriginal: trackToAdd === this.originalTrack
      });

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