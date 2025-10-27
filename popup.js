// Main popup logic for Bug Reporter extension

class BugReporter {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.currentBlob = null;
    this.recordingStartTime = null;
    this.timerInterval = null;
    this.maxRecordingTime = 30;
    this.streamToStop = null;
    this.isStandaloneWindow = window.location.hash.includes('standalone');
    this.additionalFiles = [];
    this.annotation = {
      canvas: null,
      ctx: null,
      isDrawing: false,
      drawingEnabled: false,
      paths: [],
      currentPath: null,
      color: '#ef4444',
      size: 4,
      baseImageUrl: null
    };
    
    this.init();
  }

  async init() {
    // Check if configured
    const isConfigured = await config.isConfigured();
    if (!isConfigured) {
      this.showSettings();
      this.showNotification('Please configure FreeScout settings first', 'warning');
    }

    // Load settings
    await this.loadSettings();
    
    // Initialize UI
    this.initUI();
  }

  async loadSettings() {
    const settings = await config.getSettings();
    this.maxRecordingTime = settings.maxRecordingTime || 30;
  }

  initUI() {
    // Main buttons
    document.getElementById('screenshotBtn').addEventListener('click', () => this.captureScreenshot());
    document.getElementById('recordBtn').addEventListener('click', () => this.startRecording());
    document.getElementById('stopRecordBtn').addEventListener('click', () => this.stopRecording());
    const attachBtn = document.getElementById('attachBtn');
    const attachInput = document.getElementById('attachInput');
    if (attachBtn && attachInput) {
      attachBtn.addEventListener('click', () => attachInput.click());
      attachInput.addEventListener('change', (e) => this.handleAttachFiles(e));
    }
    const addMoreFilesBtn = document.getElementById('addMoreFilesBtn');
    if (addMoreFilesBtn && attachInput) {
      addMoreFilesBtn.addEventListener('click', () => attachInput.click());
    }
    const floatingStopBtn = document.getElementById('floatingStopBtn');
    if (floatingStopBtn) {
      floatingStopBtn.addEventListener('click', () => this.stopRecording());
    }
    
    // Action buttons
    document.getElementById('submitBtn').addEventListener('click', () => this.submitBugReport());
    document.getElementById('cancelBtn').addEventListener('click', () => this.cancelCapture());
    document.getElementById('newReportBtn').addEventListener('click', () => this.resetUI());
    
    // Settings navigation
    document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());
    document.getElementById('backBtn').addEventListener('click', () => this.showMainView());
    document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());

    // Annotation controls
    const toggleDrawBtn = document.getElementById('toggleDrawBtn');
    const undoDrawBtn = document.getElementById('undoDrawBtn');
    const clearDrawBtn = document.getElementById('clearDrawBtn');
    const brushColor = document.getElementById('brushColor');
    const brushSize = document.getElementById('brushSize');
    if (toggleDrawBtn) toggleDrawBtn.addEventListener('click', () => this.toggleDraw());
    if (undoDrawBtn) undoDrawBtn.addEventListener('click', () => this.undoDraw());
    if (clearDrawBtn) clearDrawBtn.addEventListener('click', () => this.clearDraw());
    if (brushColor) brushColor.addEventListener('change', (e) => this.annotation.color = e.target.value);
    if (brushSize) brushSize.addEventListener('change', (e) => this.annotation.size = parseInt(e.target.value, 10));

    // Load settings into form
    this.loadSettingsForm();

    // Auto-start when opened as standalone recording window
    if (window.location.hash.includes('autostart=record') && !this._autoStarted) {
      this._autoStarted = true;
      setTimeout(() => this.startRecording(), 100);
    }
    if (window.location.hash.includes('autostart=screenshot') && !this._autoStarted) {
      this._autoStarted = true;
      setTimeout(() => this.captureScreenshot(true), 100);
    }
  }

  /**
   * Capture screenshot
   */
  async captureScreenshot(_bypassWindowOpen = false) {
    try {
      // If we're in the action popup, open a persistent window to avoid popup closing on blur
      if (!this.isStandaloneWindow && !_bypassWindowOpen) {
        const url = chrome.runtime.getURL('popup.html#standalone&autostart=screenshot');
        chrome.windows.create({ url, type: 'popup', width: 540, height: 720, focused: true });
        window.close();
        return;
      }
      this.showLoadingState('Capturing full screen...');

      // Use modern API to capture a single frame from entire screen
      let screenStream = null;
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 1 }, // low fps; we only need one frame
          audio: false
        });

        const video = document.createElement('video');
        video.srcObject = screenStream;
        video.muted = true;
        const metadataLoaded = new Promise(resolve => {
          video.onloadedmetadata = () => resolve();
        });
        await metadataLoaded;
        await video.play().catch(() => {});

        const width = video.videoWidth || screen.width;
        const height = video.videoHeight || screen.height;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/png');
        const blob = await this.dataURLtoBlob(dataUrl);

        // Stop tracks immediately after capture
        screenStream.getTracks().forEach(t => t.stop());

        this.currentBlob = blob;
        this.showPreview(dataUrl, 'image');
      } catch (e) {
        if (e && e.name === 'NotAllowedError') {
          this.showNotification('Screenshot cancelled', 'error');
        } else {
          console.error('Full-screen screenshot error:', e);
          this.showNotification('Failed to capture full screen: ' + (e?.message || e), 'error');
        }
        if (screenStream) screenStream.getTracks().forEach(t => t.stop());
        this.showMainView();
      }
    } catch (error) {
      console.error('Screenshot error:', error);
      this.showNotification('Screenshot failed: ' + error.message, 'error');
      this.showMainView();
    }
  }

  /**
   * Start screen recording
   */
  async startRecording() {
    try {
      // If we are in the action popup (not standalone), open a dedicated, persistent window
      if (!this.isStandaloneWindow) {
        const url = chrome.runtime.getURL('popup.html#standalone&autostart=record');
        chrome.windows.create({ url, type: 'popup', width: 540, height: 720, focused: true });
        // Close the ephemeral action popup to avoid duplicate recorders
        window.close();
        return;
      }

      // Load settings and video quality preferences
      const settings = await config.getSettings();
      const quality = config.getVideoQuality(settings.videoQuality);

      // Prefer the modern getDisplayMedia API for screen capture
      let displayStream = null;
      try {
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: quality?.frameRate?.ideal || 24,
            width: quality?.width?.ideal || 1920,
            height: quality?.height?.ideal || 1080
          },
          // System audio if available (Chrome may only provide tab audio)
          audio: settings.recordSystemAudio ? true : false
        });
      } catch (getDisplayErr) {
        this.showNotification('Screen recording cancelled or failed', 'error');
        return;
      }

      // Optionally capture microphone audio
      let microphoneStream = null;
      if (settings.recordAudio) {
        try {
          microphoneStream = await navigator.mediaDevices.getUserMedia({
            audio: config.getAudioConstraints(true),
            video: false
          });
        } catch (audioError) {
          console.warn('Could not capture microphone:', audioError);
          this.showNotification('Recording without microphone audio', 'warning');
        }
      }

      // Build a combined stream with video + audio tracks
      const combinedTracks = [];
      displayStream.getVideoTracks().forEach(track => combinedTracks.push(track));

      const systemAudioTrack = displayStream.getAudioTracks()[0];
      if (systemAudioTrack) {
        combinedTracks.push(systemAudioTrack);
      }

      if (microphoneStream && microphoneStream.getAudioTracks().length > 0) {
        combinedTracks.push(microphoneStream.getAudioTracks()[0]);
      }

      const combinedStream = new MediaStream(combinedTracks);
      this.streamToStop = combinedStream;
      // Keep references so we can stop all sources on finish
      this._activeStreams = [displayStream];
      if (microphoneStream) this._activeStreams.push(microphoneStream);

      // Start recording
      await this.recordStream(combinedStream);

    } catch (error) {
      console.error('Recording error:', error);
      this.showNotification('Recording failed: ' + error.message, 'error');
    }
  }

  /**
   * Record the media stream
   */
  async recordStream(stream) {
    this.recordedChunks = [];

    // Determine best codec
    const mimeType = this.getSupportedMimeType();
    
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: 2500000 // 2.5 Mbps
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = async () => {
      const blob = new Blob(this.recordedChunks, { type: mimeType });
      
      // Check file size
      const maxSize = 50 * 1024 * 1024; // 50 MB
      if (blob.size > maxSize) {
        this.showNotification(
          `Recording is too large (${this.formatFileSize(blob.size)}). Max: 50 MB. Try reducing quality or duration.`,
          'error'
        );
        this.resetUI();
        return;
      }

      this.currentBlob = blob;
      const videoUrl = URL.createObjectURL(blob);
      this.showPreview(videoUrl, 'video');
    };

    this.mediaRecorder.start();
    this.showRecordingControls();
    this.startTimer();

    // Auto-stop after max time
    setTimeout(() => {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.stopRecording();
      }
    }, this.maxRecordingTime * 1000);
  }

  /**
   * Get supported MIME type for recording
   */
  getSupportedMimeType() {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'video/webm'; // Fallback
  }

  /**
   * Stop recording
   */
  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      
      // Stop all tracks
      if (this.streamToStop) {
        this.streamToStop.getTracks().forEach(track => track.stop());
        this.streamToStop = null;
      }
      if (this._activeStreams) {
        try {
          this._activeStreams.forEach(s => s.getTracks().forEach(t => t.stop()));
        } catch (_) {}
        this._activeStreams = null;
      }
    }

    this.stopTimer();
    this.hideRecordingControls();
  }

  /**
   * Start recording timer
   */
  startTimer() {
    this.recordingStartTime = Date.now();
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const seconds = (elapsed % 60).toString().padStart(2, '0');
      document.getElementById('timer').textContent = `${minutes}:${seconds}`;
    }, 1000);
  }

  /**
   * Stop timer
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Show preview of captured media
   */
  showPreview(url, type) {
    const previewContainer = document.getElementById('previewContainer');
    const previewTitleEl = document.getElementById('previewTitle');
    previewContainer.innerHTML = '';

    if (type === 'image') {
      if (previewTitleEl) previewTitleEl.classList.remove('hidden');
      previewContainer.classList.remove('hidden');
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.style.maxWidth = '100%';
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, image.width, image.height);

        // Setup annotation state
        this.annotation.canvas = canvas;
        this.annotation.ctx = ctx;
        this.annotation.paths = [];
        this.annotation.isDrawing = false;
        this.annotation.baseImageUrl = url;

        const toPoint = (evt) => {
          const rect = canvas.getBoundingClientRect();
          return {
            x: (evt.clientX - rect.left) * (canvas.width / rect.width),
            y: (evt.clientY - rect.top) * (canvas.height / rect.height)
          };
        };
        const start = (e) => {
          if (!this.annotation.drawingEnabled) return;
          this.annotation.isDrawing = true;
          const p = toPoint(e);
          this.annotation.currentPath = { color: this.annotation.color, size: this.annotation.size, points: [p] };
        };
        const move = (e) => {
          if (!this.annotation.isDrawing) return;
          const p = toPoint(e);
          this.annotation.currentPath.points.push(p);
          this.redrawCanvas();
        };
        const end = () => {
          if (!this.annotation.isDrawing) return;
          this.annotation.isDrawing = false;
          if (this.annotation.currentPath) {
            this.annotation.paths.push(this.annotation.currentPath);
            this.annotation.currentPath = null;
          }
          this.redrawCanvas();
        };
        canvas.addEventListener('mousedown', start);
        canvas.addEventListener('mousemove', move);
        window.addEventListener('mouseup', end);
        canvas.addEventListener('mouseleave', end);

        // Touch
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); start(e.touches[0]); });
        canvas.addEventListener('touchmove', (e) => { e.preventDefault(); move(e.touches[0]); });
        window.addEventListener('touchend', (e) => { e.preventDefault(); end(); });

        previewContainer.appendChild(canvas);
        const tb = document.getElementById('annotateToolbar');
        if (tb) tb.classList.remove('hidden');
      };
      image.src = url;
    } else if (type === 'attachmentImage') {
      if (previewTitleEl) previewTitleEl.classList.remove('hidden');
      previewContainer.classList.remove('hidden');
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'Attachment preview';
      previewContainer.appendChild(img);
      const tb = document.getElementById('annotateToolbar');
      if (tb) tb.classList.add('hidden');
    } else if (type === 'video') {
      if (previewTitleEl) previewTitleEl.classList.remove('hidden');
      previewContainer.classList.remove('hidden');
      const video = document.createElement('video');
      video.src = url;
      video.controls = true;
      video.style.maxWidth = '100%';
      previewContainer.appendChild(video);
      const tb = document.getElementById('annotateToolbar');
      if (tb) tb.classList.add('hidden');
    } else {
      // No preview (non-image attachments only)
      previewContainer.innerHTML = '';
      previewContainer.classList.add('hidden');
      if (previewTitleEl) previewTitleEl.classList.add('hidden');
      const tb = document.getElementById('annotateToolbar');
      if (tb) tb.classList.add('hidden');
    }

    // Show attachments area if any files present
    this.updateAttachmentsVisibility();
    this.renderFileList();

    // Show preview section
    document.getElementById('mainView').style.display = 'block';
    document.getElementById('loadingState').classList.add('hidden');
    document.querySelector('.capture-section').classList.add('hidden');
    document.getElementById('previewSection').classList.remove('hidden');
    document.getElementById('recordingControls').classList.add('hidden');

    // Set default title
    const now = new Date();
      document.getElementById('bugTitle').value = `AES Bug Report - ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
  }

  redrawCanvas() {
    const { canvas, ctx, baseImageUrl, paths, currentPath } = this.annotation;
    if (!canvas || !ctx || !baseImageUrl) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const drawPath = (path) => {
        ctx.strokeStyle = path.color;
        ctx.lineWidth = path.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        path.points.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
      };
      paths.forEach(drawPath);
      if (currentPath) drawPath(currentPath);
    };
    img.src = baseImageUrl;
  }

  toggleDraw() {
    this.annotation.drawingEnabled = !this.annotation.drawingEnabled;
    const btn = document.getElementById('toggleDrawBtn');
    if (btn) {
      if (this.annotation.drawingEnabled) {
        btn.classList.remove('btn-outline');
        btn.classList.add('btn-primary');
      } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
      }
    }
  }

  undoDraw() {
    if (!this.annotation.paths.length) return;
    this.annotation.paths.pop();
    this.redrawCanvas();
  }

  clearDraw() {
    this.annotation.paths = [];
    this.redrawCanvas();
  }

  /**
   * Submit bug report to FreeScout
   */
  async submitBugReport() {
    try {
      // Validate inputs
      const title = document.getElementById('bugTitle').value.trim();
      const notes = document.getElementById('bugNotes').value.trim();
      const priority = document.getElementById('bugPriority').value;
      const type = document.getElementById('bugType').value;

      if (!title) {
        this.showNotification('Please enter a bug title', 'error');
        return;
      }

      if (!notes) {
        this.showNotification('Please describe the bug', 'error');
        return;
      }

      // If we have an annotated canvas for an image, export that instead
      let mainBlob = this.currentBlob;
      if (this.annotation && this.annotation.canvas) {
        const dataUrl = this.annotation.canvas.toDataURL('image/png');
        mainBlob = await this.dataURLtoBlob(dataUrl);
      }
      if (!mainBlob && this.additionalFiles.length === 0) {
        this.showNotification('Please capture media or attach a file', 'error');
        return;
      }

      // Show loading
      this.showLoadingState('Submitting bug report...');

      // Get current page info
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const pageUrl = tab ? tab.url : 'Unknown';
      const pageTitle = tab ? tab.title : 'Unknown';

      // Prepare bug report data
      const bugData = {
        title: title,
        description: notes,
        priority: priority,
        type: type,
        pageUrl: pageUrl,
        pageTitle: pageTitle,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };

      // Submit to FreeScout
      const result = await freeScoutAPI.createTicket(bugData, mainBlob, this.additionalFiles);

      if (result.success) {
        this.showSuccessState();
      } else {
        throw new Error(result.error || 'Failed to create ticket');
      }

    } catch (error) {
      console.error('Submit error:', error);
      this.showNotification('Failed to submit bug report: ' + error.message, 'error');
      this.showMainView();
      document.querySelector('.capture-section').classList.add('hidden');
      document.getElementById('previewSection').classList.remove('hidden');
    }
  }

  handleAttachFiles(event) {
    const files = Array.from(event.target.files || []);
    const maxSize = 50 * 1024 * 1024;
    if (!files.length) return;
    const first = files[0];
    if (first.size > maxSize) {
      this.showNotification(`${first.name} is too large (${this.formatFileSize(first.size)}). Max 50 MB.`, 'error');
      return;
    }
    if (files.length > 1) {
      this.showNotification('Only one attachment is allowed. Using the first file selected.', 'warning');
    }
    // Replace any existing file with the new one
    this.additionalFiles = [first];
    // Decide preview behavior based on file types
    const firstImage = this.additionalFiles[0] && this.additionalFiles[0].type && this.additionalFiles[0].type.startsWith('image/') ? this.additionalFiles[0] : null;
    if (firstImage) {
      const url = URL.createObjectURL(firstImage);
      this.showPreview(url, 'attachmentImage');
    } else {
      this.showPreview('', 'none');
    }
  }

  renderFileList() {
    const container = document.getElementById('fileList');
    if (!container) return;
    container.innerHTML = '';
    this.additionalFiles.forEach((file, idx) => {
      const row = document.createElement('div');
      row.className = 'file-item';
      const left = document.createElement('div');
      left.innerHTML = `<span class="file-name">${file.name}</span><span class="file-meta">${this.formatFileSize(file.size)}</span>`;
      row.appendChild(left);
      container.appendChild(row);
    });
  }

  updateAttachmentsVisibility() {
    const block = document.getElementById('attachmentsBlock');
    const addBtn = document.getElementById('addMoreFilesBtn');
    if (!block) return;
    if (this.additionalFiles.length > 0) {
      block.classList.remove('hidden');
      if (addBtn) {
        addBtn.disabled = false; // allow replacing file
        addBtn.textContent = 'Replace file';
      }
    } else {
      block.classList.add('hidden');
      if (addBtn) {
        addBtn.disabled = false;
        addBtn.textContent = 'Add file';
      }
    }
  }

  /**
   * Cancel current capture
   */
  cancelCapture() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.stopRecording();
    }
    
    this.currentBlob = null;
    this.resetUI();
  }

  /**
   * Reset UI to initial state
   */
  resetUI() {
    document.querySelector('.capture-section').classList.remove('hidden');
    document.getElementById('previewSection').classList.add('hidden');
    document.getElementById('recordingControls').classList.add('hidden');
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('successState').classList.add('hidden');
    document.getElementById('mainView').style.display = 'block';
    
    // Clear form
    document.getElementById('bugTitle').value = '';
    document.getElementById('bugNotes').value = '';
    document.getElementById('bugPriority').value = '2';
    document.getElementById('bugType').value = 'bug';
    
    this.currentBlob = null;
    this.additionalFiles = [];
    this.renderFileList();
    this.updateAttachmentsVisibility();
  }

  /**
   * Show/hide different views
   */
  showRecordingControls() {
    document.querySelector('.capture-section').classList.add('hidden');
    document.getElementById('recordingControls').classList.remove('hidden');
    const fs = document.getElementById('floatingStop');
    if (fs) fs.classList.remove('hidden');
  }

  hideRecordingControls() {
    document.getElementById('recordingControls').classList.add('hidden');
    const fs = document.getElementById('floatingStop');
    if (fs) fs.classList.add('hidden');
  }

  showLoadingState(message) {
    document.getElementById('mainView').style.display = 'block';
    document.querySelector('.capture-section').classList.add('hidden');
    document.getElementById('previewSection').classList.add('hidden');
    document.getElementById('recordingControls').classList.add('hidden');
    document.getElementById('successState').classList.add('hidden');
    
    const loadingState = document.getElementById('loadingState');
    loadingState.classList.remove('hidden');
    if (message) {
      loadingState.querySelector('p').textContent = message;
    }
  }

  showSuccessState() {
    document.getElementById('mainView').style.display = 'block';
    document.querySelector('.capture-section').classList.add('hidden');
    document.getElementById('previewSection').classList.add('hidden');
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('successState').classList.remove('hidden');
  }

  showMainView() {
    document.getElementById('mainView').style.display = 'block';
    document.getElementById('settingsView').classList.add('hidden');
  }

  showSettings() {
    document.getElementById('mainView').style.display = 'none';
    document.getElementById('settingsView').classList.remove('hidden');
  }

  /**
   * Load settings into form
   */
  async loadSettingsForm() {
    const settings = await config.getSettings();
    
    document.getElementById('freescoutUrl').value = settings.freescoutUrl || '';
    document.getElementById('apiKey').value = settings.apiKey || '';
    document.getElementById('mailboxId').value = settings.mailboxId || '';
    document.getElementById('defaultAssignee').value = settings.defaultAssignee || '';
    document.getElementById('recordAudio').checked = settings.recordAudio !== false;
    document.getElementById('recordSystemAudio').checked = settings.recordSystemAudio || false;
    document.getElementById('maxRecordingTime').value = settings.maxRecordingTime || 30;
    document.getElementById('videoQuality').value = settings.videoQuality || 'medium';
  }

  /**
   * Save settings
   */
  async saveSettings() {
    const settings = {
      freescoutUrl: document.getElementById('freescoutUrl').value.trim(),
      apiKey: document.getElementById('apiKey').value.trim(),
      mailboxId: document.getElementById('mailboxId').value.trim(),
      defaultAssignee: document.getElementById('defaultAssignee').value.trim(),
      recordAudio: document.getElementById('recordAudio').checked,
      recordSystemAudio: document.getElementById('recordSystemAudio').checked,
      maxRecordingTime: parseInt(document.getElementById('maxRecordingTime').value),
      videoQuality: document.getElementById('videoQuality').value
    };

    // Validate
    const validation = config.validateSettings(settings);
    if (!validation.valid) {
      this.showNotification(validation.errors.join(', '), 'error');
      return;
    }

    // Save
    const result = await config.saveSettings(settings);
    if (result.success) {
      this.showNotification('Settings saved successfully!', 'success');
      await this.loadSettings(); // Reload settings
      setTimeout(() => this.showMainView(), 1500);
    } else {
      this.showNotification('Failed to save settings: ' + result.error, 'error');
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 20px;
      background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
      max-width: 90%;
      text-align: center;
    `;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Utility: Convert data URL to Blob
   */
  async dataURLtoBlob(dataURL) {
    const response = await fetch(dataURL);
    return await response.blob();
  }

  /**
   * Utility: Format file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new BugReporter();
});

