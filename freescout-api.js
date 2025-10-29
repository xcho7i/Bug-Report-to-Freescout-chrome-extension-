// FreeScout API integration for Bug Reporter extension

class FreeScoutAPI {
  constructor() {
    this.baseUrl = '';
    this.apiKey = '';
    this.mailboxId = '';
  }

  async blobToBase64(blob) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
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
      // console.error('FreeScout API error:', error);
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
    const candidateUrls = [
      `${this.baseUrl}/api/conversations`,
      // `${this.baseUrl}/api/conversations.json`,
      // `${this.baseUrl}/api/v1/conversations`,
      // `${this.baseUrl}/conversations` // some installs expose API under different prefix
    ];

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
        firstName: 'AES',
        lastName: 'Bug Reporter'
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

    let lastErrText = '';
    for (const apiUrl of candidateUrls) {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-FreeScout-API-Key': this.apiKey
          },
          body: JSON.stringify(requestData)
        });

        if (!response.ok) {
          lastErrText = await response.text();
          // Try next candidate on common routing errors
          if (response.status === 404 || response.status === 405) {
            continue;
          }
          throw new Error(`API request failed: ${response.status} - ${lastErrText}`);
        }

        const result = await response.json();
        
        // FreeScout API returns different structures depending on version
        if (result._embedded && result._embedded.conversations && result._embedded.conversations.length > 0) {
          return result._embedded.conversations[0];
        } else if (result.id) {
          return result;
        } else {
          // Unexpected format; try next endpoint
          lastErrText = JSON.stringify(result);
          continue;
        }
      } catch (err) {
        lastErrText = String(err);
        // Try next candidate
        continue;
      }
    }

    throw new Error(`API request failed (endpoints tried: ${candidateUrls.join(', ')}). Last error: ${lastErrText}`); 
  }

  /**
   * Build conversation body with bug details
   */
  buildConversationBody(bugData) {
    let body = `<h2>AES Bug Report</h2>\n\n`;
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

    // For images, skip endpoints that are failing on this server and post inline immediately
    if (blob && blob.type && blob.type.startsWith('image/')) {
      const threadUrl = `${this.baseUrl}/api/conversations/${conversationId}/threads`;
      try {
        const base64 = await this.blobToBase64(blob);
        const dataUrl = `data:${blob.type};base64,${base64}`;
        const inlineBody = `${bugData?.description || ''}\n\n<img src="${dataUrl}" alt="inline image" />`;
        const inlineRes = await fetch(threadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-FreeScout-API-Key': this.apiKey
          },
          body: JSON.stringify({
            type: 'customer',
            text: inlineBody,
            customer: { email: 'bugs@system.local' }
          })
        });
        if (!inlineRes.ok) {
          const inErr = await inlineRes.text();
          throw new Error(`Inline image post failed: ${inErr}`);
        }
        return await inlineRes.json();
      } catch (e) {
        // console.error('Inline image post error:', e);
        throw e;
      }
    }

    // Determine file name and extension
    let fileName = `bug-report-${Date.now()}`;
    if (blob && blob.name) {
      // Preserve original filename for File attachments
      fileName = blob.name;
    } else if (blob && blob.type) {
      if (blob.type.startsWith('video/')) {
        fileName += '.webm';
      } else if (blob.type.startsWith('image/')) {
        fileName += '.png';
      } else {
        fileName += '.bin';
      }
    } else {
      fileName += '.bin';
    }

    // First try posting a new thread with JSON attachments (base64 in body).
    try {
      const jsonThreadRes = await this.postThreadWithBase64Attachment(conversationId, blob, fileName, bugData?.description || '');
      if (jsonThreadRes) return jsonThreadRes;
    } catch (e) {
      // Continue to next strategy on failure
    }

    // Next, try posting a new thread using multipart form with the file directly.
    // This path works on many FreeScout installs even when attachments endpoints are disabled.
    try {
      const multipartRes = await this.postThreadMultipartAttachment(conversationId, blob, fileName, bugData?.description || '');
      if (multipartRes) return multipartRes;
    } catch (e) {
      // Continue to next strategy on failure
    }

    // Try modern upload flow: POST /api/attachments, then attach via thread
    try {
      const uploadRes = await this.uploadToGlobalAttachments(blob, fileName);
      if (uploadRes && uploadRes.id) {
        const threadRes = await this.postThreadWithAttachments(conversationId, [uploadRes.id], bugData?.description || '');
        return threadRes;
      }
      // If structure differs, try to find id in common places
      const altId = this.extractAttachmentId(uploadRes);
      if (altId) {
        const threadRes = await this.postThreadWithAttachments(conversationId, [altId], bugData?.description || '');
        return threadRes;
      }
      // If upload succeeded without id, fall back to legacy endpoint
    } catch (e) {
      // If 404/405 or other error, fall back to legacy per-conversation endpoint below
      // console.warn('Global attachments upload failed, falling back:', e);
    }

    // Legacy fallback: POST directly to /conversations/{id}/attachments
    const formData = new FormData();
    formData.append('file', blob, fileName);

    let response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'X-FreeScout-API-Key': this.apiKey,
        'Accept': 'application/json'
      },
      body: formData
    });

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text();
      // As a final fallback for strict servers returning 405 on legacy endpoint,
      // try creating a thread with inline base64 for small non-image files (< 2 MB)
      const sizeCap = 2 * 1024 * 1024;
      if (status === 405 || status === 404) {
        if (blob && blob.size <= sizeCap) {
          try {
            const base64 = await this.blobToBase64(blob);
            return await this.postInlineDataUrl(conversationId, `data:${blob.type};base64,${base64}`, bugData?.description || '');
          } catch (_) {}
        }
      }
      throw new Error(`Failed to upload attachment: ${status} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Create a thread with base64 attachment embedded in JSON body.
   * Tries both type: 'customer' and type: 'message' for compatibility.
   */
  async postThreadWithBase64Attachment(conversationId, blob, fileName, descriptionText) {
    const base64 = await this.blobToBase64(blob);
    const threadUrl = `${this.baseUrl}/api/conversations/${conversationId}/threads`;

    const basePayload = (typeVal) => ({
      type: typeVal,
      text: descriptionText || '',
      customer: { email: this.defaultAssignee || 'bugs@system.local' },
      attachments: [
        {
          fileName: fileName,
          mimeType: (blob && blob.type) ? blob.type : 'application/octet-stream',
          data: base64
        }
      ]
    });

    const variants = [basePayload('customer'), basePayload('message')];
    let lastErr = '';
    for (const payload of variants) {
      const res = await fetch(threadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-FreeScout-API-Key': this.apiKey
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        return await res.json();
      }
      lastErr = await res.text();
      // try next variant on common validation errors
      if (res.status !== 400 && res.status !== 422) {
        break;
      }
    }
    throw new Error(`JSON thread upload failed: ${lastErr}`);
  }

  /**
   * Try creating a thread using multipart form data containing the file directly.
   * Tries several field name variants to maximize compatibility across FreeScout versions.
   */
  async postThreadMultipartAttachment(conversationId, blob, fileName, descriptionText) {
    const threadUrl = `${this.baseUrl}/api/conversations/${conversationId}/threads`;

    const fileFieldVariants = ['attachments[]', 'attachments', 'files[]', 'file'];
    const customerVariants = [
      (fd) => fd.append('customer[email]', this.defaultAssignee || 'bugs@system.local'),
      (fd) => fd.append('customer', JSON.stringify({ email: this.defaultAssignee || 'bugs@system.local' }))
    ];

    let lastErr = '';
    for (const fileField of fileFieldVariants) {
      for (const applyCustomer of customerVariants) {
        const fd = new FormData();
        fd.append('type', 'customer');
        fd.append('text', descriptionText || '');
        applyCustomer(fd);
        fd.append(fileField, blob, fileName);

        const res = await fetch(threadUrl, {
          method: 'POST',
          headers: {
            'X-FreeScout-API-Key': this.apiKey,
            'Accept': 'application/json'
          },
          body: fd
        });

        if (res.ok) {
          return await res.json();
        }

        const status = res.status;
        const txt = await res.text();
        lastErr = `${status} - ${txt}`;
        // If it's a hard method not allowed or not found, try next variant
        if (status === 405 || status === 404) {
          continue;
        }
        // For validation errors, try next variant
        if (status === 400 || status === 422) {
          continue;
        }
        // For other errors, stop trying this strategy
        break;
      }
    }
    throw new Error(`Multipart thread upload failed: ${lastErr}`);
  }

  /**
   * Upload file to global attachments endpoint. Returns JSON with id on success.
   */
  async uploadToGlobalAttachments(blob, fileName) {
    const url = `${this.baseUrl}/api/attachments`;
    const formData = new FormData();
    formData.append('file', blob, fileName);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-FreeScout-API-Key': this.apiKey,
        'Accept': 'application/json'
      },
      body: formData
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Global attachment upload failed: ${res.status} - ${txt}`);
    }
    return await res.json();
  }

  /**
   * Attach uploaded attachment ids to conversation via a new thread.
   */
  async postThreadWithAttachments(conversationId, attachmentIds, descriptionText) {
    const threadUrl = `${this.baseUrl}/api/conversations/${conversationId}/threads`;
    const basePayload = {
      type: 'customer',
      text: descriptionText || '',
      customer: { email: this.defaultAssignee || 'bugs@system.local' }
    };

    // Try payload variants to support different FreeScout versions
    const variants = [
      { ...basePayload, attachments: attachmentIds },
      { ...basePayload, attachments: attachmentIds.map(id => ({ id })) },
      { ...basePayload, attachmentIds: attachmentIds }
    ];

    let lastErr = '';
    for (const payload of variants) {
      const res = await fetch(threadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-FreeScout-API-Key': this.apiKey
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        return await res.json();
      }
      lastErr = await res.text();
      // Try next variant on common schema errors
      if (res.status !== 400 && res.status !== 422 && res.status !== 404) {
        // For other errors, do not continue variants
        break;
      }
    }
    throw new Error(`Failed to create thread with attachment(s): ${lastErr}`);
  }

  /**
   * Post a thread with inline data URL (small files only)
   */
  async postInlineDataUrl(conversationId, dataUrl, descriptionText) {
    const threadUrl = `${this.baseUrl}/api/conversations/${conversationId}/threads`;
    const res = await fetch(threadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-FreeScout-API-Key': this.apiKey
      },
      body: JSON.stringify({
        type: 'customer',
        text: `${descriptionText || ''}\n\n<a href="${dataUrl}">Attachment</a>`,
        customer: { email: this.defaultAssignee || 'bugs@system.local' }
      })
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Inline data URL post failed: ${t}`);
    }
    return await res.json();
  }

  /**
   * Extract attachment id from various response shapes
   */
  extractAttachmentId(responseJson) {
    if (!responseJson) return null;
    if (responseJson.id) return responseJson.id;
    if (responseJson._embedded && responseJson._embedded.attachments && responseJson._embedded.attachments[0] && responseJson._embedded.attachments[0].id) {
      return responseJson._embedded.attachments[0].id;
    }
    if (Array.isArray(responseJson) && responseJson[0] && responseJson[0].id) return responseJson[0].id;
    return null;
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

