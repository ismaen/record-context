const fs = require('fs');
const path = require('path');

class TranscriptWriter {
  constructor(outputDir) {
    this.outputDir = outputDir;
    this.startTime = null;
    this.chunks = [];
    this.filePath = null;
  }

  start() {
    this.startTime = new Date();
    this.chunks = [];

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const ts = this._formatTimestamp(this.startTime);
    this.filePath = path.join(this.outputDir, `${ts}.md`);
  }

  addChunk(text) {
    const now = new Date();
    this.chunks.push({ text, time: now });
  }

  getFullTranscript() {
    return this.chunks.map((chunk) => chunk.text.trim()).join('\n\n');
  }

  finalize() {
    const duration = this._calcDuration();
    const header = this._formatHeader(duration);
    const body = this._formatChunks();
    const footer = '\n---\n*Transcribed by Record Context using OpenAI Whisper*\n';

    fs.writeFileSync(this.filePath, header + body + footer, 'utf-8');
    return this.filePath;
  }

  rename(title) {
    const sanitized = title
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();

    if (!sanitized) return this.filePath;

    const date = this._formatTimestamp(this.startTime).split('_')[0];
    const newName = `${date}_${sanitized}.md`;
    const newPath = path.join(this.outputDir, newName);

    fs.renameSync(this.filePath, newPath);
    this.filePath = newPath;

    // Update the header in the file to include the title
    const content = fs.readFileSync(this.filePath, 'utf-8');
    const dateStr = this.startTime.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = this.startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const oldHeader = `# Recording - ${dateStr} at ${timeStr}`;
    const newHeader = `# ${title} - ${dateStr} at ${timeStr}`;
    const updated = content.replace(oldHeader, newHeader);
    fs.writeFileSync(this.filePath, updated, 'utf-8');

    return this.filePath;
  }

  appendInsights(insights) {
    const content = fs.readFileSync(this.filePath, 'utf-8');

    // Split after the header (first "---\n\n") to insert insights before transcript
    const headerEnd = content.indexOf('---\n\n');
    const header = content.substring(0, headerEnd + 5);
    const transcript = content.substring(headerEnd + 5);

    const insightSection = [
      '## Summary',
      insights.summary,
      '',
      '## Key Decisions',
      insights.keyDecisions,
      '',
      '## Action Items',
      insights.actionItems,
      '',
      '## Open Questions',
      insights.openQuestions,
      '',
      '## Key Takeaways',
      insights.keyTakeaways,
      '',
      '---',
      '',
      '## Slack Summary (copy-paste ready)',
      insights.slackSummary,
      '',
      '---\n',
      '# Transcript\n',
    ].join('\n');

    fs.writeFileSync(this.filePath, header + insightSection + transcript, 'utf-8');
  }

  _formatTimestamp(date) {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${d}_${h}-${mi}-${s}`;
  }

  _formatHeader(duration) {
    const dateStr = this.startTime.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = this.startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `# Recording - ${dateStr} at ${timeStr}\n**Duration:** ${duration}\n\n---\n\n`;
  }

  _formatChunks() {
    if (this.chunks.length === 0) return '*No audio was transcribed.*\n';

    let prevTime = this.startTime;
    return this.chunks
      .map((chunk) => {
        const from = this._timeStr(prevTime);
        const to = this._timeStr(chunk.time);
        prevTime = chunk.time;
        return `## ${from} - ${to}\n${chunk.text.trim()}\n`;
      })
      .join('\n');
  }

  _timeStr(date) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  _calcDuration() {
    const elapsed = Date.now() - this.startTime.getTime();
    const mins = Math.round(elapsed / 60000);
    if (mins < 1) return 'Less than a minute';
    if (mins === 1) return '1 minute';
    return `${mins} minutes`;
  }
}

module.exports = { TranscriptWriter };
