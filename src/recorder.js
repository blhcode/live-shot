const TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export class Recorder {
  constructor(canvas, audioStream) {
    this.canvas = canvas;
    this.audioStream = audioStream;
    this.rec = null;
    this.chunks = [];
    this.active = false;
    this.takes = 0;
  }

  get supported() {
    return typeof MediaRecorder !== 'undefined' && !!this.canvas.captureStream;
  }

  start() {
    if (this.active || !this.supported) return false;
    if (!this.rec) {
      const stream = this.canvas.captureStream(30);
      for (const tr of this.audioStream.getAudioTracks()) stream.addTrack(tr);
      const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || '';
      this.rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
      this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
      this.rec.start(1000);
    } else {
      this.rec.resume();
    }
    this.active = true;
    this.takes++;
    return true;
  }

  // Stopping mid-show pauses so a later restart continues the same file.
  pause() {
    if (!this.active) return;
    this.rec.pause();
    this.active = false;
  }

  finish() {
    return new Promise((resolve) => {
      if (!this.rec) return resolve(null);
      this.rec.onstop = () => resolve(new Blob(this.chunks, { type: 'video/webm' }));
      if (this.rec.state === 'paused') this.rec.resume();
      this.rec.stop();
      this.active = false;
    });
  }
}
