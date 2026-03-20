// State: idle | recording | processing
let state = 'idle';
let audioCapture = null;
let chunkManager = null;
let recordingStartTime = null;
let durationTimer = null;
let chunksTranscribed = 0;

// DOM elements
const mainView = document.getElementById('main-view');
const settingsView = document.getElementById('settings-view');
const recordBtn = document.getElementById('record-btn');
const statusText = document.getElementById('status-text');
const durationText = document.getElementById('duration');
const chunksText = document.getElementById('chunks-count');
const settingsBtn = document.getElementById('settings-btn');
const backBtn = document.getElementById('back-btn');
const apiKeyInput = document.getElementById('api-key');
const outputDirText = document.getElementById('output-dir');
const chooseDirBtn = document.getElementById('choose-dir-btn');
const chunkIntervalInput = document.getElementById('chunk-interval');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const pinBtn = document.getElementById('pin-btn');
const copySlackBtn = document.getElementById('copy-slack-btn');
let currentSlackSummary = null;

// Load settings on init
(async function init() {
  const settings = await window.api.getSettings();
  apiKeyInput.value = settings.apiKey || '';
  outputDirText.textContent = settings.outputDir || 'Not set';
  chunkIntervalInput.value = settings.chunkInterval || 5;
})();

// Navigation
settingsBtn.addEventListener('click', () => {
  mainView.classList.add('hidden');
  settingsView.classList.remove('hidden');
});

backBtn.addEventListener('click', () => {
  settingsView.classList.add('hidden');
  mainView.classList.remove('hidden');
});

// Pin toggle
pinBtn.addEventListener('click', async () => {
  const isOnTop = await window.api.toggleAlwaysOnTop();
  pinBtn.classList.toggle('active', isOnTop);
});

// Directory picker
chooseDirBtn.addEventListener('click', async () => {
  const dir = await window.api.selectDirectory();
  if (dir) {
    outputDirText.textContent = dir;
  }
});

// Save settings
saveSettingsBtn.addEventListener('click', async () => {
  await window.api.setSettings({
    apiKey: apiKeyInput.value.trim(),
    outputDir: outputDirText.textContent,
    chunkInterval: parseInt(chunkIntervalInput.value, 10) || 5,
  });
  settingsView.classList.add('hidden');
  mainView.classList.remove('hidden');
});

// Record button
recordBtn.addEventListener('click', async () => {
  if (state === 'idle') {
    await startRecording();
  } else if (state === 'recording') {
    await stopRecording();
  }
});

async function startRecording() {
  // Check settings
  const settings = await window.api.getSettings();
  if (!settings.apiKey) {
    setStatus('Set your API key in settings first');
    return;
  }

  try {
    setState('processing');
    setStatus('Starting...');

    await window.api.startRecording();

    audioCapture = new window.AudioCapture();
    await audioCapture.start();

    chunkManager = new window.ChunkManager(audioCapture, async (arrayBuffer) => {
      try {
        await window.api.transcribeAudio(arrayBuffer);
        chunksTranscribed++;
        chunksText.textContent = chunksTranscribed;
      } catch (err) {
        console.error('Transcription error:', err);
        setStatus('Transcription error - still recording');
      }
    });
    chunkManager.start();

    recordingStartTime = Date.now();
    chunksTranscribed = 0;
    currentSlackSummary = null;
    copySlackBtn.classList.add('hidden');
    chunksText.textContent = '0';
    startDurationTimer();
    setState('recording');
    setStatus('Recording...');
  } catch (err) {
    console.error('Failed to start recording:', err);
    setStatus('Error: ' + (err.message || err.name || String(err)));
    setState('idle');
  }
}

async function stopRecording() {
  setState('processing');
  setStatus('Stopping & transcribing...');

  try {
    if (chunkManager) {
      await chunkManager.stop();
      chunkManager = null;
    }

    if (audioCapture) {
      audioCapture.stop();
      audioCapture = null;
    }

    const result = await window.api.stopRecording();
    stopDurationTimer();
    setState('idle');

    if (result && result.filePath) {
      setStatus('Saved: ' + result.filePath.split('/').pop());
      if (result.slackSummary) {
        currentSlackSummary = result.slackSummary;
        copySlackBtn.classList.remove('hidden');
      }
    } else {
      setStatus('Recording stopped');
    }
  } catch (err) {
    console.error('Failed to stop recording:', err);
    setStatus('Error stopping: ' + err.message);
    setState('idle');
    stopDurationTimer();
  }
}

function setState(newState) {
  state = newState;
  recordBtn.className = 'record-btn ' + newState;
  recordBtn.disabled = newState === 'processing';

  const label = recordBtn.querySelector('.record-btn-label');
  if (newState === 'idle') {
    label.textContent = 'Record';
  } else if (newState === 'recording') {
    label.textContent = 'Stop';
  } else {
    label.textContent = '';
  }
}

function setStatus(msg) {
  statusText.textContent = msg;
}

function startDurationTimer() {
  durationTimer = setInterval(() => {
    const elapsed = Date.now() - recordingStartTime;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    durationText.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, 1000);
}

function stopDurationTimer() {
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }
}

// Copy Slack Summary
copySlackBtn.addEventListener('click', async () => {
  if (currentSlackSummary) {
    await window.api.copyToClipboard(currentSlackSummary);
    const original = copySlackBtn.textContent;
    copySlackBtn.textContent = 'Copied!';
    setTimeout(() => {
      copySlackBtn.textContent = original;
    }, 1500);
  }
});

// Listen for insight generation status
window.api.onInsightStatus((msg) => {
  setStatus(msg);
});
