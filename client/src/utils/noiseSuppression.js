import {
  loadSpeex,
  SpeexWorkletNode,
  loadRnnoise,
  RnnoiseWorkletNode,
  NoiseGateWorkletNode
} from '@sapphi-red/web-noise-suppressor'
import speexWorkletPath from '@sapphi-red/web-noise-suppressor/speexWorklet.js?url'
import noiseGateWorkletPath from '@sapphi-red/web-noise-suppressor/noiseGateWorklet.js?url'
import rnnoiseWorkletPath from '@sapphi-red/web-noise-suppressor/rnnoiseWorkletPath.js?url'
import speexWasmPath from '@sapphi-red/web-noise-suppressor/speex.wasm?url'
import rnnoiseWasmPath from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url'
import rnnoiseWasmSimdPath from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url'

export class NoiseSuppressionManager {
  constructor() {
    this.speexNode = null
    this.rnnoiseNode = null
    this.noiseGateNode = null
    this.gainNode = null
    this.audioContext = null
    this.sourceNode = null
    this.destinationNode = null
    this.isEnabled = false
    this.stream = null
    this.currentMode = null // 'speex', 'rnnoise', 'noisegate'
    this.wasmBinaries = {
      speex: null,
      rnnoise: null
    }
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

      // Load WASM binaries
      const [speexWasmBinary, rnnoiseWasmBinary] = await Promise.all([
        loadSpeex({ url: speexWasmPath }),
        loadRnnoise({
          url: rnnoiseWasmPath,
          simdUrl: rnnoiseWasmSimdPath
        })
      ])
      
      this.wasmBinaries.speex = speexWasmBinary
      this.wasmBinaries.rnnoise = rnnoiseWasmBinary

      // Add worklet modules
      await Promise.all([
        this.audioContext.audioWorklet.addModule(speexWorkletPath),
        this.audioContext.audioWorklet.addModule(noiseGateWorkletPath),
        this.audioContext.audioWorklet.addModule(rnnoiseWorkletPath)
      ])

      // Create source and destination nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(stream)
      this.destinationNode = this.audioContext.createMediaStreamDestination()
      this.gainNode = this.audioContext.createGain()
      this.gainNode.gain.value = 1.0

      // Initialize all processors
      this.speexNode = new SpeexWorkletNode(this.audioContext, {
        wasmBinary: speexWasmBinary,
        maxChannels: 1
      })

      this.rnnoiseNode = new RnnoiseWorkletNode(this.audioContext, {
        wasmBinary: rnnoiseWasmBinary,
        maxChannels: 1
      })

      this.noiseGateNode = new NoiseGateWorkletNode(this.audioContext, {
        openThreshold: -50,
        closeThreshold: -60,
        holdMs: 90,
        maxChannels: 1
      })

      console.log('Noise suppression initialized successfully')
      return true
    } catch (error) {
      console.error('Failed to initialize noise suppression:', error)
      this.cleanup()
      return false
    }
  }

  async enable(mode = 'rnnoise') {
    if (!this.sourceNode || !this.destinationNode) {
      console.error('Noise suppression not initialized')
      return false
    }

    try {
      // Disable current if enabled
      if (this.isEnabled) {
        await this.disable()
      }

      let processorNode = null
      switch (mode) {
        case 'speex':
          processorNode = this.speexNode
          break
        case 'rnnoise':
          processorNode = this.rnnoiseNode
          break
        case 'noisegate':
          processorNode = this.noiseGateNode
          break
        default:
          throw new Error(`Unknown mode: ${mode}`)
      }

      if (!processorNode) {
        throw new Error(`Processor not initialized for mode: ${mode}`)
      }

      // Connect the audio nodes
      this.sourceNode.connect(processorNode)
      processorNode.connect(this.gainNode)
      this.gainNode.connect(this.destinationNode)

      // Replace the audio track
      const originalTrack = this.stream.getAudioTracks()[0]
      const processedTrack = this.destinationNode.stream.getAudioTracks()[0]

      if (originalTrack && processedTrack) {
        this.stream.removeTrack(originalTrack)
        this.stream.addTrack(processedTrack)
      }

      this.currentMode = mode
      this.isEnabled = true
      console.log(`Noise suppression enabled with mode: ${mode}`)
      return true
    } catch (error) {
      console.error('Failed to enable noise suppression:', error)
      return false
    }
  }

  async disable() {
    if (!this.isEnabled) {
      return false
    }

    try {
      // Disconnect all nodes
      if (this.sourceNode) {
        this.sourceNode.disconnect()
      }
      if (this.speexNode) {
        this.speexNode.disconnect()
      }
      if (this.rnnoiseNode) {
        this.rnnoiseNode.disconnect()
      }
      if (this.noiseGateNode) {
        this.noiseGateNode.disconnect()
      }
      if (this.gainNode) {
        this.gainNode.disconnect()
      }

      // Restore original track if available
      const processedTrack = this.destinationNode?.stream.getAudioTracks()[0]
      if (processedTrack) {
        processedTrack.stop()
      }

      this.isEnabled = false
      this.currentMode = null
      console.log('Noise suppression disabled')
      return true
    } catch (error) {
      console.error('Failed to disable noise suppression:', error)
      return false
    }
  }

  cleanup() {
    try {
      this.disable()
      
      if (this.speexNode) {
        this.speexNode.destroy?.()
        this.speexNode = null
      }
      if (this.rnnoiseNode) {
        this.rnnoiseNode.destroy?.()
        this.rnnoiseNode = null
      }
      if (this.noiseGateNode) {
        this.noiseGateNode = null
      }

      if (this.audioContext) {
        this.audioContext.close()
        this.audioContext = null
      }

      this.sourceNode = null
      this.destinationNode = null
      this.gainNode = null
      this.stream = null
      this.isEnabled = false
      this.currentMode = null
      this.wasmBinaries = {
        speex: null,
        rnnoise: null
      }

      console.log('Noise suppression cleaned up')
    } catch (error) {
      console.error('Error during cleanup:', error)
    }
  }

  isInitialized() {
    return this.sourceNode !== null && this.destinationNode !== null
  }

  getIsEnabled() {
    return this.isEnabled
  }

  getCurrentMode() {
    return this.currentMode
  }
} 