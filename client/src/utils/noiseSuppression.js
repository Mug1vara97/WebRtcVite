import {
  RnnoiseWorkletNode,
  SpeexWorkletNode,
  NoiseGateWorkletNode
} from '@sapphi-red/web-noise-suppressor';

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
    this.isInitialized = false;
  }

  setProducer(producer) {
    this.producer = producer;
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
      await Promise.all([
        this.audioContext.audioWorklet.addModule('/worklets/rnnoise-processor.js'),
        this.audioContext.audioWorklet.addModule('/worklets/speex-processor.js'),
        this.audioContext.audioWorklet.addModule('/worklets/noisegate-processor.js')
      ]);

      // Create worklet nodes with stereo support
      this.rnnWorkletNode = new AudioWorkletNode(this.audioContext, 'rnnoise-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: {
          maxChannels: 2
        }
      });

      this.speexWorkletNode = new AudioWorkletNode(this.audioContext, 'speex-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: {
          maxChannels: 2
        }
      });

      this.noiseGateNode = new AudioWorkletNode(this.audioContext, 'noisegate-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: {
          maxChannels: 2,
          threshold: -50,
          attack: 0.02,
          release: 0.1
        }
      });

      // Create gain node
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize noise suppression:', error);
      return false;
    }
  }

  async enable(mode = 'rnnoise') {
    try {
      if (!this.audioContext || !this.stream || !this.isInitialized) {
        console.error('Not initialized');
        return false;
      }

      if (!this.producer) {
        console.error('No producer available');
        return false;
      }

      console.log('Enabling noise suppression with mode:', mode);
      console.log('Current audio track state:', {
        tracks: this.stream.getAudioTracks().length,
        enabled: this.stream.getAudioTracks()[0]?.enabled,
        readyState: this.stream.getAudioTracks()[0]?.readyState
      });

      // Create new noise node first
      let newNoiseNode;
      switch (mode) {
        case 'rnnoise': {
          console.log('Creating RNNoise node...');
          newNoiseNode = new RnnoiseWorkletNode(this.audioContext, {
            wasmBinary: this.wasmBinaries.rnnoise,
            maxChannels: 2
          });
          break;
        }
        case 'speex': {
          console.log('Creating Speex node...');
          newNoiseNode = new SpeexWorkletNode(this.audioContext, {
            wasmBinary: this.wasmBinaries.speex,
            maxChannels: 2
          });
          break;
        }
        case 'noisegate': {
          console.log('Creating NoiseGate node...');
          newNoiseNode = new NoiseGateWorkletNode(this.audioContext, {
            openThreshold: -50,
            closeThreshold: -60,
            holdMs: 90,
            maxChannels: 2
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

      // Stop current processed track if exists
      if (this.currentProcessedTrack) {
        this.currentProcessedTrack.stop();
      }

      // Update references
      this.noiseNode = newNoiseNode;
      this.destinationNode = newDestination;
      this.currentProcessedTrack = processedTrack;

      // Replace the track in the producer
      console.log('Replacing producer track...');
      await this.producer.replaceTrack({ track: processedTrack });

      console.log('Final audio track state:', {
        tracks: this.stream.getAudioTracks().length,
        enabled: processedTrack.enabled,
        readyState: processedTrack.readyState
      });

      console.log(`Noise suppression enabled with mode: ${mode}`);
      return true;
    } catch (error) {
      console.error('Error enabling noise suppression:', error);
      console.log('Attempting to restore original audio...');
      await this.disable();
      return false;
    }
  }

  async disable() {
    try {
      if (!this.producer) {
        console.error('No producer available');
        return false;
      }

      console.log('Disabling noise suppression...');

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

      // Stop current processed track if exists
      if (this.currentProcessedTrack) {
        this.currentProcessedTrack.stop();
        this.currentProcessedTrack = null;
      }

      // Create a new track from the original
      const newTrack = this.originalTrack.clone();

      // Replace with new track in the producer
      console.log('Restoring original track to producer...');
      await this.producer.replaceTrack({ track: newTrack });

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

    if (this.originalTrack) {
      this.originalTrack.stop();
      this.originalTrack = null;
    }

    if (this.currentProcessedTrack) {
      this.currentProcessedTrack.stop();
      this.currentProcessedTrack = null;
    }

    this.stream = null;
    this.sourceNode = null;
    this.producer = null;
    this.wasmBinaries = {
      speex: null,
      rnnoise: null
    };
    this.isInitialized = false;
  }

  isInitialized() {
    return this.isInitialized;
  }
} 