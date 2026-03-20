const Store = require('electron-store');
const path = require('path');
const os = require('os');

class Settings {
  constructor() {
    this.store = new Store({
      name: 'record-context-settings',
      defaults: {
        apiKey: '',
        outputDir: path.join(os.homedir(), 'Documents', 'Record Context'),
        chunkInterval: 5,
      },
    });
  }

  getAll() {
    return {
      apiKey: this.store.get('apiKey'),
      outputDir: this.store.get('outputDir'),
      chunkInterval: this.store.get('chunkInterval'),
    };
  }

  setAll(settings) {
    if (settings.apiKey !== undefined) this.store.set('apiKey', settings.apiKey);
    if (settings.outputDir !== undefined) this.store.set('outputDir', settings.outputDir);
    if (settings.chunkInterval !== undefined) this.store.set('chunkInterval', settings.chunkInterval);
  }
}

module.exports = { Settings };
