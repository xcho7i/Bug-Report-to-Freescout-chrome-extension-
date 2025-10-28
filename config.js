// Configuration management for Bug Reporter extension

class Config {
  constructor() {
    this.defaults = {
      freescoutUrl: '',
      apiKey: '',
      mailboxId: '',
      defaultAssignee: '',
      recordAudio: true,
      recordSystemAudio: false,
      maxRecordingTime: 30,
      videoQuality: 'medium',
      maxFileSize: 50 * 1024 * 1024 // 50 MB in bytes
    };
    this.baseConfig = null; // Loaded from freescout.config.json
  }

  /**
   * Ensure base config (constants) is loaded from packaged JSON
   */
  async ensureBaseConfigLoaded() {
    if (this.baseConfig) return this.baseConfig;
    try {
      const url = chrome.runtime.getURL('freescout.config.json');
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json && typeof json.mailboxId === 'number') {
          json.mailboxId = String(json.mailboxId);
        }
        this.baseConfig = json || {};
      } else {
        this.baseConfig = {};
      }
    } catch (error) {
      console.error('Error loading freescout.config.json:', error);
      this.baseConfig = {};
    }
    return this.baseConfig;
  }

  /**
   * Get all settings
   */
  async getSettings() {
    try {
      const result = await chrome.storage.sync.get(this.defaults);
      const base = await this.ensureBaseConfigLoaded();
      return {
        ...result,
        freescoutUrl: base.freescoutUrl || '',
        apiKey: base.apiKey || '',
        mailboxId: base.mailboxId || '',
        maxRecordingTime: 30
      };
    } catch (error) {
      console.error('Error loading settings:', error);
      return this.defaults;
    }
  }

  /**
   * Get a specific setting
   */
  async getSetting(key) {
    try {
      if (key === 'freescoutUrl' || key === 'apiKey' || key === 'mailboxId') {
        const base = await this.ensureBaseConfigLoaded();
        return base[key] !== undefined ? base[key] : '';
      }
      if (key === 'maxRecordingTime') {
        return 30;
      }
      const result = await chrome.storage.sync.get(key);
      return result[key] !== undefined ? result[key] : this.defaults[key];
    } catch (error) {
      console.error(`Error loading setting ${key}:`, error);
      if (key === 'freescoutUrl' || key === 'apiKey' || key === 'mailboxId') {
        return '';
      }
      if (key === 'maxRecordingTime') {
        return 30;
      }
      return this.defaults[key];
    }
  }

  /**
   * Save settings
   */
  async saveSettings(settings) {
    try {
      const toSave = { ...settings };
      // Prevent storing constants; they are sourced from JSON
      delete toSave.freescoutUrl;
      delete toSave.apiKey;
      delete toSave.mailboxId;
      delete toSave.maxRecordingTime; // enforce 30s constant
      await chrome.storage.sync.set(toSave);
      return { success: true };
    } catch (error) {
      console.error('Error saving settings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate settings
   */
  validateSettings(settings) {
    const errors = [];

    // Validate email if provided
    if (settings.defaultAssignee && settings.defaultAssignee.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(settings.defaultAssignee)) {
        errors.push('Invalid email address for default assignee');
      }
    }

    // Recording time is fixed at 30s; no validation needed

    // Validate video quality
    const validQualities = ['low', 'medium', 'high'];
    if (settings.videoQuality && !validQualities.includes(settings.videoQuality)) {
      errors.push('Invalid video quality setting');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Check if settings are configured
   */
  async isConfigured() {
    const base = await this.ensureBaseConfigLoaded();
    return !!(base.freescoutUrl && base.apiKey && base.mailboxId);
  }

  /**
   * Get video quality constraints
   */
  getVideoQuality(quality) {
    const qualities = {
      low: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 15 }
      },
      medium: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 24 }
      },
      high: {
        width: { ideal: 2560 },
        height: { ideal: 1440 },
        frameRate: { ideal: 30 }
      }
    };

    return qualities[quality] || qualities.medium;
  }

  /**
   * Get audio constraints
   */
  getAudioConstraints(recordAudio) {
    if (!recordAudio) {
      return false;
    }

    return {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 44100
    };
  }
}

// Export singleton instance
const config = new Config();

