class AudioCapture {
  constructor() {
    this.stream = null;
    this.mediaRecorder = null;
    this._audioStream = null;
    this._pendingBlobs = [];
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true,
      });
    } catch (err) {
      console.error('getDisplayMedia failed:', err);
      throw new Error('Screen Recording permission required. Grant access in System Settings > Privacy & Security > Screen Recording, then restart the app.');
    }

    // Discard video track — we only need audio
    this.stream.getVideoTracks().forEach((t) => t.stop());

    if (this.stream.getAudioTracks().length === 0) {
      throw new Error('No audio track available. System audio capture may not be supported on this OS version.');
    }

    // Capture microphone input
    let micStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.warn('Microphone not available, recording system audio only:', err.message);
    }

    // Mix system audio + mic into a single stream
    const audioContext = new AudioContext();
    const dest = audioContext.createMediaStreamDestination();

    const systemSource = audioContext.createMediaStreamSource(
      new MediaStream(this.stream.getAudioTracks())
    );
    systemSource.connect(dest);

    if (micStream) {
      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(dest);
      this.micStream = micStream;
    }

    this.audioContext = audioContext;
    this._audioStream = dest.stream;
    this._pendingBlobs = [];
    this._startRecorder();
  }

  _startRecorder() {
    this.mediaRecorder = new MediaRecorder(this._audioStream, {
      mimeType: 'audio/webm;codecs=opus',
    });
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this._pendingBlobs.push(event.data);
      }
    };
    // Fire ondataavailable every 10 seconds for finer-grained chunks
    this.mediaRecorder.start(10000);
  }

  _stopRecorder() {
    return new Promise((resolve) => {
      this.mediaRecorder.addEventListener('stop', () => {
        const blobs = this._pendingBlobs.splice(0);
        resolve(blobs);
      }, { once: true });
      this.mediaRecorder.stop();
    });
  }

  async collectAndRestart() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return null;

    const blobs = await this._stopRecorder();
    if (blobs.length === 0) return null;

    this._startRecorder();

    const combined = new Blob(blobs, { type: 'audio/webm;codecs=opus' });
    return combined.arrayBuffer();
  }

  async collectFinal() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      const blobs = this._pendingBlobs.splice(0);
      if (blobs.length === 0) return null;
      const combined = new Blob(blobs, { type: 'audio/webm;codecs=opus' });
      return combined.arrayBuffer();
    }

    const blobs = await this._stopRecorder();
    if (blobs.length === 0) return null;
    const combined = new Blob(blobs, { type: 'audio/webm;codecs=opus' });
    return combined.arrayBuffer();
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.mediaRecorder = null;
  }

  isRecording() {
    return this.mediaRecorder && this.mediaRecorder.state === 'recording';
  }
}

window.AudioCapture = AudioCapture;
