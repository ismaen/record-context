class ChunkManager {
  constructor(chunkIntervalMinutes, onFlush) {
    this.chunkInterval = chunkIntervalMinutes * 60 * 1000;
    this.onFlush = onFlush;
    this.blobs = [];
    this.timer = null;
  }

  start() {
    this.blobs = [];
    this.timer = setInterval(() => this.flush(), 30000);
  }

  addBlob(blob) {
    this.blobs.push(blob);
  }

  async flush() {
    if (this.blobs.length === 0) return;

    const toSend = this.blobs.splice(0);
    const combined = new Blob(toSend, { type: 'audio/webm;codecs=opus' });
    const arrayBuffer = await combined.arrayBuffer();

    if (this.onFlush) {
      await this.onFlush(arrayBuffer);
    }
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }
}

window.ChunkManager = ChunkManager;
