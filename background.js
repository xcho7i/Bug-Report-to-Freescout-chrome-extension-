// Background service worker for Chrome extension
// Handles screen capture permissions and background tasks

console.log('AES Bug Reporter: Background service worker loaded');

async function setActionIconFromSvg() {
  try {
    const svgUrl = chrome.runtime.getURL('icons/logo.svg');
    const sizes = [16, 32, 48, 128];
    const imageDataMap = {};
    for (const size of sizes) {
      const res = await fetch(svgUrl);
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob, { resizeWidth: size, resizeHeight: size, resizeQuality: 'high' });
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(bitmap, 0, 0, size, size);
      imageDataMap[String(size)] = ctx.getImageData(0, 0, size, size);
    }
    await chrome.action.setIcon({ imageData: imageDataMap });
  } catch (_) {
    // ignore; default icons remain
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SCREEN_STREAM_ID') {
    handleScreenCapture(message.sources, sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'CAPTURE_TAB') {
    handleTabCapture(sendResponse);
    return true;
  }
});

/**
 * Handle screen capture with audio
 */
async function handleScreenCapture(sources, sendResponse) {
  try {
    // Request desktop capture
    chrome.desktopCapture.chooseDesktopMedia(
      sources || ['screen', 'window', 'tab'],
      async (streamId) => {
        if (!streamId) {
          sendResponse({ 
            success: false, 
            error: 'User cancelled screen sharing' 
          });
          return;
        }
        
        sendResponse({ 
          success: true, 
          streamId: streamId 
        });
      }
    );
  } catch (error) {
    // console.error('Screen capture error:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

/**
 * Handle tab capture (for screenshot)
 */
async function handleTabCapture(sendResponse) {
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      sendResponse({ 
        success: false, 
        error: 'No active tab found' 
      });
      return;
    }

    // Capture visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100
    });

    sendResponse({ 
      success: true, 
      dataUrl: dataUrl 
    });
  } catch (error) {
    // console.error('Tab capture error:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('AES Bug Reporter extension installed');
    // Open settings on first install
    chrome.runtime.openOptionsPage();
    setActionIconFromSvg();
  } else if (details.reason === 'update') {
    console.log('AES Bug Reporter extension updated');
    setActionIconFromSvg();
  }
});

// Keep service worker alive
let keepAliveInterval = null;

function keepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  
  keepAliveInterval = setInterval(() => {
    console.log('Keep alive ping');
  }, 20000); // Ping every 20 seconds
}

keepAlive();

// Listen for extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('AES Bug Reporter: Extension started');
  keepAlive();
  setActionIconFromSvg();
});

