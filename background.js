// Background service worker for Chrome extension
// Handles screen capture permissions and background tasks

console.log('Bug Reporter: Background service worker loaded');

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
    console.error('Screen capture error:', error);
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
    console.error('Tab capture error:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Bug Reporter extension installed');
    // Open settings on first install
    chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    console.log('Bug Reporter extension updated');
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
  console.log('Bug Reporter: Extension started');
  keepAlive();
});

