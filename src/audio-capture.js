class AudioCapture {
  constructor() {
    this.stream = null;
    this.mediaRecorder = null;
    this.onDataAvailable = null;
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
    const audioStream = dest.stream;

    this.mediaRecorder = new MediaRecorder(audioStream, {
      mimeType: 'audio/webm;codecs=opus',
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.onDataAvailable) {
        this.onDataAvailable(event.data);
      }
    };

    // Fire ondataavailable every 10 seconds for finer-grained chunks
    this.mediaRecorder.start(10000);
  }

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
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
