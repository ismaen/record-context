const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');

class Transcriber {
  async transcribe(buffer, apiKey) {
    const client = new OpenAI({ apiKey });

    const tmpPath = path.join(os.tmpdir(), `rc-chunk-${Date.now()}.webm`);
    fs.writeFileSync(tmpPath, buffer);

    try {
      const transcription = await client.audio.transcriptions.create({
        model: 'whisper-1',
        file: fs.createReadStream(tmpPath),
        response_format: 'text',
      });
      return transcription;
    } finally {
      fs.unlinkSync(tmpPath);
    }
  }
}

module.exports = { Transcriber };
