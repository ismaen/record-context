class ChunkManager {
  constructor(audioCapture, onFlush) {
    this.audioCapture = audioCapture;
    this.onFlush = onFlush;
    this.timer = null;
  }

  start() {
    this.timer = setInterval(() => this.flush(), 30000);
  }

  async flush() {
    const arrayBuffer = await this.audioCapture.collectAndRestart();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) return;

    if (this.onFlush) {
      await this.onFlush(arrayBuffer);
    }
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const arrayBuffer = await this.audioCapture.collectFinal();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) return;

    if (this.onFlush) {
      await this.onFlush(arrayBuffer);
    }
  }
}

window.ChunkManager = ChunkManager;
