const { app, BrowserWindow, ipcMain, dialog, desktopCapturer, systemPreferences, clipboard } = require('electron');
const path = require('path');
const { Transcriber } = require('./lib/transcriber');
const { TranscriptWriter } = require('./lib/transcript-writer');
const { InsightGenerator } = require('./lib/insight-generator');
const { Settings } = require('./lib/settings');

let mainWindow;
let settings;
let transcriber;
let insightGenerator;
let transcriptWriter;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 520,
    minWidth: 380,
    minHeight: 420,
    resizable: true,
    alwaysOnTop: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0c0c14',
    vibrancy: 'under-window',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

}

app.whenReady().then(() => {
  settings = new Settings();
  transcriber = new Transcriber();
  insightGenerator = new InsightGenerator();
  transcriptWriter = null;

  createWindow();

  // Allow getDisplayMedia to capture system audio via ScreenCaptureKit
  mainWindow.webContents.session.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
        callback({ video: sources[0], audio: 'loopback' });
      });
    }
  );

  // Request microphone permission on macOS
  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess('microphone');
  }

  registerIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function registerIpcHandlers() {
  ipcMain.handle('get-settings', () => settings.getAll());

  ipcMain.handle('set-settings', (_event, newSettings) => {
    settings.setAll(newSettings);
    return settings.getAll();
  });

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('get-desktop-sources', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    return sources.map((s) => ({ id: s.id, name: s.name }));
  });

  ipcMain.handle('check-screen-permission', () => {
    if (process.platform === 'darwin') {
      return systemPreferences.getMediaAccessStatus('screen');
    }
    return 'granted';
  });

  ipcMain.handle('start-recording', () => {
    const s = settings.getAll();
    transcriptWriter = new TranscriptWriter(s.outputDir);
    transcriptWriter.start();
    return true;
  });

  ipcMain.handle('transcribe-audio', async (_event, arrayBuffer) => {
    const s = settings.getAll();
    if (!s.apiKey) throw new Error('OpenAI API key not configured');

    const buffer = Buffer.from(arrayBuffer);
    const text = await transcriber.transcribe(buffer, s.apiKey);

    if (transcriptWriter && text.trim()) {
      transcriptWriter.addChunk(text);
    }

    return text;
  });

  ipcMain.handle('stop-recording', async () => {
    if (transcriptWriter) {
      const transcriptText = transcriptWriter.getFullTranscript();
      let filePath = transcriptWriter.finalize();

      let slackSummary = null;
      if (transcriptText.trim()) {
        const s = settings.getAll();

        // Generate title and rename file
        try {
          mainWindow.webContents.send('insight-status', 'Generating title...');
          const title = await insightGenerator.generateTitle(s.apiKey, transcriptText);
          if (title) {
            filePath = transcriptWriter.rename(title);
          }
        } catch (err) {
          console.error('Title generation failed:', err);
        }

        // Generate insights
        try {
          mainWindow.webContents.send('insight-status', 'Generating insights...');
          const insights = await insightGenerator.generate(s.apiKey, transcriptText);
          transcriptWriter.appendInsights(insights);
          slackSummary = insights.slackSummary;
        } catch (err) {
          console.error('Insight generation failed:', err);
          mainWindow.webContents.send('insight-status', 'Insights failed - transcript saved');
        }
      }

      transcriptWriter = null;
      return { filePath, slackSummary };
    }
    return null;
  });

  ipcMain.handle('copy-to-clipboard', (_event, text) => {
    clipboard.writeText(text);
    return true;
  });

  ipcMain.handle('toggle-always-on-top', () => {
    const current = mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(!current);
    return !current;
  });
}
