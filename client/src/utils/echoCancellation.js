export class EchoCancellationManager {
  constructor() {
    this.audioContext = null;
    this.sourceNode = null;
    this.destinationNode = null;
    this.echoCanceller = null;
    this.processedStream = null;
    this.originalStream = null;
    this._isInitialized = false;
    this.producer = null;
  }

  async initialize(stream) {
    try {
      if (!stream) {
        console.error('No stream provided');
        return false;
      }

      this.originalStream = stream;

      // Create audio context with optimal settings for echo cancellation
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      // Create new stream for processed audio
      this.processedStream = new MediaStream();

      // Create source node from input stream
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);

      // Create destination node
      this.destinationNode = this.audioContext.createMediaStreamDestination();

      // Add track to processed stream
      this.processedStream.addTrack(this.destinationNode.stream.getAudioTracks()[0]);

      // Apply advanced echo cancellation constraints
      const constraints = {
        echoCancellation: {
          exact: true
        },
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000,
        latency: 0,
        googEchoCancellation: true,
        googEchoCancellation2: true,
        googDAEchoCancellation: true,
        googAutoGainControl: true,
        googAutoGainControl2: true,
        googNoiseSuppression: true,
        googHighpassFilter: true,
        googTypingNoiseDetection: true,
        googAudioMirroring: false
      };

      // Create new stream with echo cancellation
      const processedStreamWithEC = await navigator.mediaDevices.getUserMedia({
        audio: constraints,
        video: false
      });

      // Create source node from processed stream
      const processedSource = this.audioContext.createMediaStreamSource(processedStreamWithEC);

      // Connect the processed source to destination
      processedSource.connect(this.destinationNode);

      // Store the echo canceller stream
      this.echoCanceller = processedStreamWithEC;

      this._isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize echo cancellation:', error);
      return false;
    }
  }

  isInitialized() {
    return this._isInitialized;
  }

  getProcessedStream() {
    return this.processedStream;
  }

  async enable() {
    try {
      if (!this._isInitialized) {
        console.error('Not initialized');
        return false;
      }

      // Disconnect current chain
      this.sourceNode.disconnect();

      // Connect through echo cancellation
      const processedSource = this.audioContext.createMediaStreamSource(this.echoCanceller);
      processedSource.connect(this.destinationNode);

      // Update producer track if exists
      if (this.producer) {
        const newTrack = this.processedStream.getAudioTracks()[0];
        await this.producer.replaceTrack({ track: newTrack });
      }

      return true;
    } catch (error) {
      console.error('Error enabling echo cancellation:', error);
      return false;
    }
  }

  async disable() {
    try {
      if (!this._isInitialized) {
        console.error('Not initialized');
        return false;
      }

      // Disconnect all nodes
      this.sourceNode.disconnect();

      // Connect source directly to destination
      this.sourceNode.connect(this.destinationNode);

      // Update producer track if exists
      if (this.producer) {
        const newTrack = this.originalStream.getAudioTracks()[0];
        await this.producer.replaceTrack({ track: newTrack });
      }

      return true;
    } catch (error) {
      console.error('Error disabling echo cancellation:', error);
      return false;
    }
  }

  setProducer(producer) {
    this.producer = producer;
  }

  cleanup() {
    try {
      // Stop all tracks in the echo canceller stream
      if (this.echoCanceller) {
        this.echoCanceller.getTracks().forEach(track => track.stop());
      }

      // Stop all tracks in the original stream
      if (this.originalStream) {
        this.originalStream.getTracks().forEach(track => track.stop());
      }

      // Close audio context
      if (this.audioContext) {
        this.audioContext.close();
      }

      // Reset all properties
      this.audioContext = null;
      this.sourceNode = null;
      this.destinationNode = null;
      this.echoCanceller = null;
      this.processedStream = null;
      this.originalStream = null;
      this._isInitialized = false;
      this.producer = null;
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
} 