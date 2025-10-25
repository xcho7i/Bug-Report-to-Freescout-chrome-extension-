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
  }

  /**
   * Get all settings
   */
  async getSettings() {
    try {
      const result = await chrome.storage.sync.get(this.defaults);
      return result;
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
      const result = await chrome.storage.sync.get(key);
      return result[key] !== undefined ? result[key] : this.defaults[key];
    } catch (error) {
      console.error(`Error loading setting ${key}:`, error);
      return this.defaults[key];
    }
  }

  /**
   * Save settings
   */
  async saveSettings(settings) {
    try {
      await chrome.storage.sync.set(settings);
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

    // Validate FreeScout URL
    if (settings.freescoutUrl) {
      try {
        new URL(settings.freescoutUrl);
      } catch (e) {
        errors.push('Invalid FreeScout URL');
      }
    } else {
      errors.push('FreeScout URL is required');
    }

    // Validate API Key
    if (!settings.apiKey || settings.apiKey.trim() === '') {
      errors.push('API Key is required');
    }

    // Validate Mailbox ID
    if (!settings.mailboxId || isNaN(parseInt(settings.mailboxId))) {
      errors.push('Valid Mailbox ID is required');
    }

    // Validate email if provided
    if (settings.defaultAssignee && settings.defaultAssignee.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(settings.defaultAssignee)) {
        errors.push('Invalid email address for default assignee');
      }
    }

    // Validate recording time
    if (settings.maxRecordingTime < 5 || settings.maxRecordingTime > 60) {
      errors.push('Max recording time must be between 5 and 60 seconds');
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
    const settings = await this.getSettings();
    return !!(settings.freescoutUrl && settings.apiKey && settings.mailboxId);
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

