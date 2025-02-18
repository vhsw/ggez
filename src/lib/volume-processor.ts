const UPDATE_INTERVAL = 1 / 60
const SMOOTHING_FACTOR = 0.8

class VolumeProcessor extends AudioWorkletProcessor {
  private _lastUpdate: number
  private _volume: number

  constructor() {
    super()
    this._lastUpdate = currentTime
    this._volume = 0
  }

  process(inputs: Float32Array[][]): boolean {
    if (currentTime - this._lastUpdate < UPDATE_INTERVAL) {
      return true
    }
    this._lastUpdate = currentTime
    const channel = inputs[0][0]
    let rms = 0
    if (channel) {
      let total = 0
      for (let i = 0; i < channel.length; i++) {
        total += channel[i] * channel[i]
      }
      rms = Math.sqrt(total / channel.length)
    }
    this._volume = SMOOTHING_FACTOR * this._volume + (1 - SMOOTHING_FACTOR) * rms
    this.port.postMessage({
      volume: this._volume,
    })
    return true
  }
}

registerProcessor("volume-processor", VolumeProcessor)
