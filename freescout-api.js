// FreeScout API integration for Bug Reporter extension

class FreeScoutAPI {
  constructor() {
    this.baseUrl = '';
    this.apiKey = '';
    this.mailboxId = '';
  }

  /**
   * Initialize API with settings
   */
  async init() {
    const settings = await config.getSettings();
    this.baseUrl = settings.freescoutUrl?.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = settings.apiKey;
    this.mailboxId = settings.mailboxId;
    this.defaultAssignee = settings.defaultAssignee;
  }

  /**
   * Create a new ticket in FreeScout
   */
  async createTicket(bugData, mediaBlob, additionalFiles = []) {
    try {
      // Initialize API
      await this.init();

      if (!this.baseUrl || !this.apiKey || !this.mailboxId) {
        throw new Error('FreeScout API not configured. Please check settings.');
      }

      // Step 1: Create the conversation (ticket)
      const conversationData = await this.createConversation(bugData);
      
      if (!conversationData || !conversationData.id) {
        throw new Error('Failed to create conversation');
      }

      const conversationId = conversationData.id;

      // Step 2: Upload attachments
      if (mediaBlob) {
        await this.uploadAttachment(conversationId, mediaBlob, bugData);
      }
      if (additionalFiles && additionalFiles.length) {
        for (const file of additionalFiles) {
          await this.uploadAttachment(conversationId, file, bugData);
        }
      }

      return {
        success: true,
        conversationId: conversationId,
        message: 'Bug report created successfully'
      };

    } catch (error) {
      console.error('FreeScout API error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a conversation (ticket) in FreeScout
   */
  async createConversation(bugData) {
    const apiUrl = `${this.baseUrl}/api/conversations`;

    // Build conversation body with all bug details
    const body = this.buildConversationBody(bugData);

    // Prepare API request
    const requestData = {
      mailboxId: parseInt(this.mailboxId),
      subject: bugData.title,
      type: 'email',
      status: 'active',
      customer: {
        email: this.defaultAssignee || 'bugs@system.local',
        firstName: 'Bug',
        lastName: 'Reporter'
      },
      threads: [
        {
          type: 'customer',
          text: body,
          customer: {
            email: this.defaultAssignee || 'bugs@system.local'
          }
        }
      ],
      imported: false,
      createdBy: 'customer'
    };

    // Add tags
    const tags = ['bug-reporter', bugData.type];
    if (bugData.priority === '1') tags.push('high-priority');
    requestData.tags = tags;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-FreeScout-API-Key': this.apiKey
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    // FreeScout API returns different structures depending on version
    // Handle both { _embedded: { conversations: [...] } } and direct conversation object
    if (result._embedded && result._embedded.conversations && result._embedded.conversations.length > 0) {
      return result._embedded.conversations[0];
    } else if (result.id) {
      return result;
    } else {
      throw new Error('Unexpected API response format');
    }
  }

  /**
   * Build conversation body with bug details
   */
  buildConversationBody(bugData) {
    let body = `<h2>Bug Report</h2>\n\n`;
    body += `<p><strong>Description:</strong></p>\n`;
    body += `<p>${this.escapeHtml(bugData.description).replace(/\n/g, '<br>')}</p>\n\n`;
    
    body += `<hr>\n\n`;
    body += `<h3>Additional Details</h3>\n`;
    body += `<ul>\n`;
    body += `  <li><strong>Type:</strong> ${this.escapeHtml(bugData.type)}</li>\n`;
    body += `  <li><strong>Priority:</strong> ${this.getPriorityLabel(bugData.priority)}</li>\n`;
    body += `  <li><strong>Page URL:</strong> <a href="${this.escapeHtml(bugData.pageUrl)}">${this.escapeHtml(bugData.pageUrl)}</a></li>\n`;
    body += `  <li><strong>Page Title:</strong> ${this.escapeHtml(bugData.pageTitle)}</li>\n`;
    body += `  <li><strong>Reported:</strong> ${new Date(bugData.timestamp).toLocaleString()}</li>\n`;
    body += `</ul>\n\n`;
    
    body += `<hr>\n\n`;
    body += `<h3>Technical Information</h3>\n`;
    body += `<ul>\n`;
    body += `  <li><strong>User Agent:</strong> ${this.escapeHtml(bugData.userAgent)}</li>\n`;
    body += `  <li><strong>Browser:</strong> ${this.getBrowserInfo(bugData.userAgent)}</li>\n`;
    body += `  <li><strong>OS:</strong> ${this.getOSInfo(bugData.userAgent)}</li>\n`;
    body += `</ul>\n\n`;
    
    body += `<p><em>Captured media (screenshot or video) attached below.</em></p>\n`;

    return body;
  }

  /**
   * Upload attachment to FreeScout conversation
   */
  async uploadAttachment(conversationId, blob, bugData) {
    const apiUrl = `${this.baseUrl}/api/conversations/${conversationId}/attachments`;

    // Determine file name and extension
    const isVideo = blob.type.startsWith('video/');
    const extension = isVideo ? 'webm' : 'png';
    const fileName = `bug-report-${Date.now()}.${extension}`;

    // Create form data
    const formData = new FormData();
    formData.append('file', blob, fileName);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'X-FreeScout-API-Key': this.apiKey
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Attachment upload failed:', errorText);
      throw new Error(`Failed to upload attachment: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Utility: Get priority label
   */
  getPriorityLabel(priority) {
    const labels = {
      '1': '🔴 High',
      '2': '🟡 Medium',
      '3': '🟢 Low'
    };
    return labels[priority] || 'Medium';
  }

  /**
   * Utility: Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Utility: Get browser info from user agent
   */
  getBrowserInfo(userAgent) {
    if (userAgent.includes('Chrome')) {
      const match = userAgent.match(/Chrome\/(\d+)/);
      return match ? `Chrome ${match[1]}` : 'Chrome';
    } else if (userAgent.includes('Firefox')) {
      const match = userAgent.match(/Firefox\/(\d+)/);
      return match ? `Firefox ${match[1]}` : 'Firefox';
    } else if (userAgent.includes('Safari')) {
      return 'Safari';
    } else if (userAgent.includes('Edge')) {
      return 'Edge';
    }
    return 'Unknown';
  }

  /**
   * Utility: Get OS info from user agent
   */
  getOSInfo(userAgent) {
    if (userAgent.includes('Windows')) {
      return 'Windows';
    } else if (userAgent.includes('Mac OS')) {
      return 'macOS';
    } else if (userAgent.includes('Linux')) {
      return 'Linux';
    } else if (userAgent.includes('Android')) {
      return 'Android';
    } else if (userAgent.includes('iOS')) {
      return 'iOS';
    }
    return 'Unknown';
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      await this.init();
      
      const apiUrl = `${this.baseUrl}/api/mailboxes/${this.mailboxId}`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'X-FreeScout-API-Key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`API test failed: ${response.status}`);
      }

      return {
        success: true,
        message: 'Connection successful'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
const freeScoutAPI = new FreeScoutAPI();

