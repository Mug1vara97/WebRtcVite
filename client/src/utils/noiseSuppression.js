import { RnNoiseNode } from '@sapphi-red/web-noise-suppressor'

export class NoiseSuppressionManager {
  constructor() {
    this.rnNoise = null
    this.audioContext = null
    this.sourceNode = null
    this.destinationNode = null
    this.isEnabled = false
    this.stream = null
  }

  async initialize(stream) {
    if (!stream) {
      throw new Error('Stream is required for noise suppression')
    }

    try {
      // Store the stream reference
      this.stream = stream

      // Create audio context if not exists
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 48000,
          latencyHint: 'interactive'
        })
      }

      // Create source node from the stream
      this.sourceNode = this.audioContext.createMediaStreamSource(stream)

      // Create destination node
      this.destinationNode = this.audioContext.createMediaStreamDestination()

      // Initialize RNNoise with optimal parameters
      this.rnNoise = await RnNoiseNode.create(this.audioContext, {
        smoothing: 0.4,      // Баланс между быстротой реакции и стабильностью
        minGain: 0.0015,     // Минимальное усиление для очень тихих звуков
        maxGain: 1,          // Максимальное усиление
        threshold: 0.15,     // Порог для определения речи
        vadOffset: 0,        // Смещение для определения голосовой активности
        vadMode: 3,          // Агрессивный режим определения речи
        enableVAD: true      // Включаем определение голосовой активности
      })

      console.log('RNNoise initialized successfully')
      return true
    } catch (error) {
      console.error('Failed to initialize RNNoise:', error)
      this.cleanup()
      return false
    }
  }

  async enable() {
    if (!this.rnNoise || !this.sourceNode || !this.destinationNode) {
      console.error('RNNoise not initialized')
      return false
    }

    try {
      if (this.isEnabled) {
        return true
      }

      // Connect the audio nodes
      this.sourceNode.connect(this.rnNoise)
      this.rnNoise.connect(this.destinationNode)

      // Replace the audio track
      const originalTrack = this.stream.getAudioTracks()[0]
      const processedTrack = this.destinationNode.stream.getAudioTracks()[0]

      if (originalTrack && processedTrack) {
        this.stream.removeTrack(originalTrack)
        this.stream.addTrack(processedTrack)
      }

      this.isEnabled = true
      console.log('RNNoise enabled')
      return true
    } catch (error) {
      console.error('Failed to enable RNNoise:', error)
      return false
    }
  }

  async disable() {
    if (!this.rnNoise || !this.isEnabled) {
      return false
    }

    try {
      // Disconnect the nodes
      if (this.sourceNode) {
        this.sourceNode.disconnect()
      }
      if (this.rnNoise) {
        this.rnNoise.disconnect()
      }

      // Restore original track if available
      const processedTrack = this.destinationNode?.stream.getAudioTracks()[0]
      if (processedTrack) {
        processedTrack.stop()
      }

      this.isEnabled = false
      console.log('RNNoise disabled')
      return true
    } catch (error) {
      console.error('Failed to disable RNNoise:', error)
      return false
    }
  }

  cleanup() {
    try {
      this.disable()
      
      if (this.rnNoise) {
        this.rnNoise = null
      }

      if (this.audioContext) {
        this.audioContext.close()
        this.audioContext = null
      }

      this.sourceNode = null
      this.destinationNode = null
      this.stream = null
      this.isEnabled = false

      console.log('RNNoise cleaned up')
    } catch (error) {
      console.error('Error during cleanup:', error)
    }
  }

  isInitialized() {
    return this.rnNoise !== null
  }

  getIsEnabled() {
    return this.isEnabled
  }
} 