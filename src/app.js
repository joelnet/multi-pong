import { Connection } from './network/connection.js';
import { GameEngine } from './game/engine.js';
import { GameRenderer } from './game/renderer.js';
import { generateQRCode, initQRScanner as createQRScanner, clearQRScanner } from './lib/qrcode.js';
import settings from './settings.json';

/**
 * @typedef {import('./types/index.js').SwipeData} SwipeData
 * @typedef {import('./types/index.js').GameMessage} GameMessage
 */

// DOM Elements
const connectionScreen = document.getElementById('connection-screen');
const gameScreen = document.getElementById('game-screen');
const hostBtn = document.getElementById('host-btn');
const guestBtn = document.getElementById('guest-btn');
const hostScreen = document.getElementById('host-screen');
const guestScreen = document.getElementById('guest-screen');
const qrHost = document.getElementById('qr-host');
const offerData = document.getElementById('offer-data');
const offerInput = document.getElementById('offer-input');
const submitOfferBtn = document.getElementById('submit-offer-btn');
const hostAnswerInput = document.getElementById('host-answer-input');
const guestAnswerOutput = document.getElementById('guest-answer-output');
const answerData = document.getElementById('answer-data');
const answerInput = document.getElementById('answer-input');
const copyAnswerBtn = document.getElementById('copy-answer-btn');
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const guestConnectionStatus = document.getElementById('guest-connection-status');
const connectionSuccess = document.getElementById('connection-success');
const startGameBtn = document.getElementById('start-game-btn');
const gameCanvas = document.getElementById('game-canvas');
const playerScore = document.getElementById('player-score');
const opponentScore = document.getElementById('opponent-score');

// Game state
let connection = null;
let gameEngine = null;
let gameRenderer = null;
let isHost = false;
let animationFrameId = null;
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

/**
 * Initialize the application
 */
function init() {
  // Set up event listeners
  hostBtn.addEventListener('click', initHost);
  guestBtn.addEventListener('click', initGuest);
  submitOfferBtn.addEventListener('click', submitOffer);
  copyAnswerBtn.addEventListener('click', () => copyToClipboard(answerData));
  submitAnswerBtn.addEventListener('click', submitAnswer);
  startGameBtn.addEventListener('click', startGame);

  // Add event listener for the host done button
  const hostDoneBtn = document.getElementById('host-done-btn');
  if (hostDoneBtn) {
    hostDoneBtn.addEventListener('click', showHostWaitingScreen);
  }

  // Add event listener for QR code click to copy (host)
  const qrHost = document.getElementById('qr-host');
  if (qrHost) {
    qrHost.addEventListener('click', () => {
      copyToClipboard(offerData);

      // Show visual feedback
      showCopyFeedback(qrHost);
    });
  }

  // Add event listener for QR code click to copy (guest)
  const qrGuest = document.getElementById('qr-guest');
  if (qrGuest) {
    qrGuest.addEventListener('click', () => {
      copyToClipboard(answerData);

      // Show visual feedback
      showCopyFeedback(qrGuest);
    });
  }

  // Set up touch/mouse events for the game
  gameCanvas.addEventListener('mousedown', handleTouchStart);
  gameCanvas.addEventListener('mousemove', handleTouchMove);
  gameCanvas.addEventListener('mouseup', handleTouchEnd);
  gameCanvas.addEventListener('touchstart', handleTouchStart);
  gameCanvas.addEventListener('touchmove', handleTouchMove);
  gameCanvas.addEventListener('touchend', handleTouchEnd);

  // Handle window resize
  window.addEventListener('resize', handleResize);
}

/**
 * Show copy feedback on a QR code container
 * @param {HTMLElement} container - The QR code container
 */
function showCopyFeedback(container) {
  // Show visual feedback
  const feedbackEl = document.createElement('div');
  feedbackEl.textContent = 'Copied!';
  feedbackEl.style.position = 'absolute';
  feedbackEl.style.top = '50%';
  feedbackEl.style.left = '50%';
  feedbackEl.style.transform = 'translate(-50%, -50%)';
  feedbackEl.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  feedbackEl.style.color = 'var(--primary-color)';
  feedbackEl.style.padding = '10px 20px';
  feedbackEl.style.borderRadius = '4px';
  feedbackEl.style.zIndex = '10';

  container.style.position = 'relative';
  container.appendChild(feedbackEl);

  setTimeout(() => {
    feedbackEl.remove();
  }, 1500);
}

/**
 * Initialize as host
 */
async function initHost() {
  isHost = true;
  hostBtn.disabled = true;
  guestBtn.disabled = true;

  // Hide the connection options
  document.querySelector('.connection-options').classList.add('hidden');

  hostScreen.classList.remove('hidden');

  try {
    // Create connection
    connection = new Connection({
      isHost: true,
      onConnected: handleConnectionSuccess,
      onMessage: handleMessage,
      onDisconnected: handleDisconnect,
    });

    // Initialize as host and get offer data
    const offer = await connection.initAsHost();
    offerData.value = offer;

    // Generate QR code
    await generateQRCode(offer, qrHost);
  } catch (error) {
    console.error('Error initializing as host:', error);
    resetConnection();
  }
}

/**
 * Show the host waiting screen
 */
function showHostWaitingScreen() {
  // Hide the share section
  document.getElementById('host-share-section').classList.add('hidden');

  hostAnswerInput.classList.remove('hidden');

  // Initialize QR scanner for the host
  initHostQRScanner();
}

/**
 * Initialize the QR code scanner for the host
 */
function initHostQRScanner() {
  // Define the success callback
  const onScanSuccess = decodedText => {
    console.log(`QR Code detected: ${decodedText}`);

    try {
      // Try to parse the JSON data
      const jsonData = JSON.parse(decodedText);
      console.log('Parsed JSON data:', jsonData);
    } catch (error) {
      console.log('QR code contains non-JSON data, treating as raw SDP string');
    }

    // Fill the answer input with the scanned data
    answerInput.value = decodedText;

    // Clear the scanner HTML
    clearQRScanner(html5QrcodeScanner);

    // Auto-submit the answer data
    submitAnswer();
  };

  // Initialize the QR code scanner
  const html5QrcodeScanner = createQRScanner('host-qr-scanner', onScanSuccess);

  // Store scanner instance in a global variable for easy access
  window.hostQrCodeScanner = html5QrcodeScanner;
}

/**
 * Initialize as guest
 */
function initGuest() {
  isHost = false;
  hostBtn.disabled = true;
  guestBtn.disabled = true;

  // Hide the connection options
  document.querySelector('.connection-options').classList.add('hidden');

  // Show the guest screen
  guestScreen.classList.remove('hidden');

  // Automatically initialize the QR scanner
  initQRScanner();
}

/**
 * Initialize the QR code scanner
 */
function initQRScanner() {
  // Define the success callback
  const onScanSuccess = data => {
    console.log('QR Code detected!');

    try {
      // Try to parse the JSON data
      const jsonData = JSON.parse(data);
      console.log('Parsed JSON data:', jsonData);
    } catch (error) {
      console.log('QR code contains non-JSON data, treating as raw SDP string');
    }

    // Fill the offer input with the processed data
    offerInput.value = data;

    // Clear the scanner HTML
    clearQRScanner(html5QrcodeScanner);

    // Auto-submit the offer data
    submitOffer();
  };

  // Initialize the QR code scanner
  const html5QrcodeScanner = createQRScanner('qr-scanner', onScanSuccess);

  // Store scanner instance in a global variable for easy access
  window.qrCodeScanner = html5QrcodeScanner;
}

/**
 * Submit offer as guest
 */
async function submitOffer() {
  const offerValue = offerInput.value.trim();

  if (!offerValue) {
    alert('Please enter or scan an offer');
    return;
  }

  // Hide the submit button since we're auto-connecting
  if (submitOfferBtn) {
    submitOfferBtn.style.display = 'none';
  }

  // Show loading state
  guestConnectionStatus.textContent = 'Connecting...';

  try {
    // Initialize the connection as guest
    connection = new Connection({
      isHost: false,
      onConnected: handleConnectionSuccess,
      onMessage: handleMessage,
      onDisconnected: handleDisconnect,
    });

    // Process the offer data
    connection
      .initAsGuest(offerValue)
      .then(answerData => {
        // Hide the offer input section
        hideOfferInputSection();

        // Show the answer data
        const answerDataElement = document.getElementById('answer-data');
        if (answerDataElement) {
          answerDataElement.value = answerData;
        }

        const answerSection = document.getElementById('answer-section');
        if (answerSection) {
          answerSection.classList.remove('hidden');
        } else {
          // If answer-section doesn't exist, show the guest-answer-output instead
          const guestAnswerOutput = document.getElementById('guest-answer-output');
          if (guestAnswerOutput) {
            guestAnswerOutput.classList.remove('hidden');
          }
        }

        // Generate QR code for the answer data
        const qrContainer = document.getElementById('qr-guest');
        if (qrContainer) {
          generateQRCode(answerData, qrContainer);
        }

        // Update status
        if (guestConnectionStatus) {
          guestConnectionStatus.textContent = 'Waiting for host to accept...';
        }

        // Note: The connection will be established automatically when the host processes the answer
        // through the onConnected callback (handleConnectionSuccess)
      })
      .catch(error => {
        console.error('Error initializing as guest:', error);
        alert('Error connecting: ' + error.message);

        // Show the submit button again in case of error
        if (submitOfferBtn) {
          submitOfferBtn.style.display = '';
        }

        guestConnectionStatus.textContent = 'Not connected';
      });
  } catch (error) {
    console.error('Error initializing as guest:', error);
    alert('Error connecting: ' + error.message);

    // Show the submit button again in case of error
    if (submitOfferBtn) {
      submitOfferBtn.style.display = '';
    }

    guestConnectionStatus.textContent = 'Not connected';
  }
}

/**
 * Hide the offer input section
 */
function hideOfferInputSection() {
  // Hide the entire offer section container
  const offerSection = document.getElementById('guest-offer-section');
  if (offerSection) {
    offerSection.classList.add('hidden');
  }
}

/**
 * Handle successful connection
 */
function handleConnectionSuccess() {
  // Hide all screens first
  hostScreen.classList.add('hidden');
  guestScreen.classList.add('hidden');

  // Show connection success screen
  connectionSuccess.classList.remove('hidden');

  // Update connection status for both host and guest
  const hostConnectionStatus = document.getElementById('host-connection-status');
  if (hostConnectionStatus) {
    hostConnectionStatus.textContent = 'Connected!';
  }

  const guestConnectionStatus = document.getElementById('guest-connection-status');
  if (guestConnectionStatus) {
    guestConnectionStatus.textContent = 'Connected!';
  }

  // Enable the start game button
  if (startGameBtn) {
    startGameBtn.disabled = false;
  }
}

/**
 * Handle incoming message
 * @param {GameMessage} message - The received message
 */
function handleMessage(message) {
  if (gameEngine) {
    switch (message.type) {
      case 'ball':
        gameEngine.updateFromRemote({ ball: message.data });
        break;
      case 'paddle':
        gameEngine.updateFromRemote({ remotePaddle: message.data });
        break;
      case 'score':
        gameEngine.updateFromRemote({ score: message.data });
        break;
      case 'ping':
        break;
      case 'pong': {
        const rtt = Date.now() - message.data.pingTimestamp;
        updatePingDisplay(rtt);
        break;
      }
      case 'start':
        startGame();
        break;
      case 'pause':
        gameEngine.pauseGame();
        break;
      case 'resume':
        gameEngine.resumeGame();
        break;
      case 'gameOver':
        handleGameOver(message.data.localWon);
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }
}

/**
 * Update ping display in all UI elements
 * @param {number} rtt - Round trip time in milliseconds
 */
function updatePingDisplay(rtt) {
  const pingText = `Ping: ${rtt}ms`;

  // Try direct DOM manipulation first
  try {
    // Get all ping status elements by ID
    const pingStatus = document.getElementById('ping-status');
    const gamePingStatus = document.getElementById('game-ping-status');

    // Update them if they exist
    if (pingStatus) {
      pingStatus.textContent = pingText;
    }

    if (gamePingStatus) {
      gamePingStatus.textContent = pingText;
    }

    // Fallback to query selector if direct access didn't work
    if (!pingStatus && !gamePingStatus) {
      document.querySelectorAll('[id$="ping-status"]').forEach(element => {
        element.textContent = pingText;
      });
    }

    // Ultimate fallback - create a ping display if none exists
    if (
      !pingStatus &&
      !gamePingStatus &&
      document.querySelectorAll('[id$="ping-status"]').length === 0
    ) {
      const gameScreen = document.getElementById('game-screen');
      if (gameScreen) {
        const newPingStatus = document.createElement('div');
        newPingStatus.id = 'emergency-ping-status';
        newPingStatus.className = 'status game-status';
        newPingStatus.textContent = pingText;
        gameScreen.appendChild(newPingStatus);
      }
    }
  } catch (error) {
    console.error('Error updating ping display:', error);
  }
}

/**
 * Handle disconnection
 */
function handleDisconnect() {
  alert('Connection lost. Please refresh and try again.');
  resetConnection();
}

/**
 * Reset connection state
 */
function resetConnection() {
  if (connection) {
    connection.disconnect();
    connection = null;
  }

  hostBtn.disabled = false;
  guestBtn.disabled = false;
  submitOfferBtn.disabled = false;
  submitAnswerBtn.disabled = false;

  // Show the connection options again
  document.querySelector('.connection-options').classList.remove('hidden');

  // Hide all screens
  hostScreen.classList.add('hidden');
  guestScreen.classList.add('hidden');
  connectionSuccess.classList.add('hidden');

  // Reset host screen sections
  const hostShareSection = document.getElementById('host-share-section');
  if (hostShareSection) {
    hostShareSection.classList.remove('hidden');
  }

  hostAnswerInput.classList.add('hidden');

  // Reset guest screen sections
  const guestOfferSection = document.getElementById('guest-offer-section');
  if (guestOfferSection) {
    guestOfferSection.classList.remove('hidden');
  }

  guestAnswerOutput.classList.add('hidden');

  // Clear the QR scanners if they exist
  if (window.qrCodeScanner) {
    clearQRScanner(window.qrCodeScanner);
    window.qrCodeScanner = null;
  }

  if (window.hostQrCodeScanner) {
    clearQRScanner(window.hostQrCodeScanner);
    window.hostQrCodeScanner = null;
  }

  // Reset form fields
  offerData.value = '';
  offerInput.value = '';
  answerInput.value = '';
  answerData.value = '';
}

/**
 * Start the game
 */
function startGame() {
  // Hide connection screen and show game screen
  connectionScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');

  // Initialize game engine and renderer
  gameEngine = new GameEngine({
    isHost,
    onScoreUpdate: updateScore,
    onBallOut: sendBallData,
    onGameOver: handleGameOver,
  });

  gameRenderer = new GameRenderer(gameCanvas);

  // Start game engine
  gameEngine.startGame();

  // Send start message to other player
  if (connection) {
    connection.sendMessage({
      type: 'start',
      data: null,
    });
  }

  // Start game loop
  gameLoop(performance.now());

  // Handle resize
  handleResize();

  // Ensure ping display is still visible and working during gameplay
  const pingStatusElements = document.querySelectorAll('[id$="ping-status"]');
  pingStatusElements.forEach(element => {
    element.classList.remove('hidden');
  });
}

/**
 * Game loop
 * @param {number} timestamp - Current timestamp
 */
function gameLoop(timestamp) {
  if (!gameEngine || !gameRenderer) return;

  // Update game state
  gameEngine.update(timestamp);

  // Render game
  gameRenderer.render(gameEngine.getGameState());

  // Send paddle position to other player
  sendPaddlePosition();

  // Continue loop
  animationFrameId = requestAnimationFrame(gameLoop);
}

/**
 * Update score display
 * @param {number} localScore - Local player score
 * @param {number} remoteScore - Remote player score
 */
function updateScore(localScore, remoteScore) {
  playerScore.textContent = localScore;
  opponentScore.textContent = remoteScore;
}

/**
 * Send ball data to other player
 * @param {import('./types/index.js').Ball} ball - Ball data
 */
function sendBallData(ball) {
  if (!connection) return;

  connection.sendMessage({
    type: 'ball',
    data: ball,
  });

  // Create particle effect
  if (gameRenderer) {
    gameRenderer.createParticleEffect(ball.x, ball.y);
    gameRenderer.screenShake();
  }
}

/**
 * Send paddle position to other player
 */
function sendPaddlePosition() {
  if (!connection || !gameEngine) return;

  const gameState = gameEngine.getGameState();
  const paddle = gameState.localPlayer.paddle;

  connection.sendMessage({
    type: 'paddle',
    data: paddle,
  });
}

/**
 * Handle game over
 * @param {boolean} localWon - Whether the local player won
 */
function handleGameOver(localWon) {
  // Cancel animation frame
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Show game over message
  const message = localWon ? 'You Win!' : 'You Lose!';
  alert(`Game Over! ${message}`);

  // Reset game
  if (gameEngine) {
    gameEngine.resetGame();
  }

  // Show connection screen again
  connectionScreen.classList.remove('hidden');
  gameScreen.classList.add('hidden');

  // Reset connection
  resetConnection();
}

/**
 * Handle touch/mouse start
 * @param {Event} event - Touch or mouse event
 */
function handleTouchStart(event) {
  // Get touch coordinates
  const touch = event.touches ? event.touches[0] : event;
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchStartTime = performance.now();
}

/**
 * Handle touch/mouse move
 * @param {Event} event - Touch or mouse event
 */
function handleTouchMove(event) {
  if (!gameEngine) return;

  // Get touch coordinates
  const touch = event.touches ? event.touches[0] : event;
  const x = touch.clientX;
  const y = touch.clientY;

  // Update paddle position
  const canvas = gameRenderer.canvas;

  // Convert screen coordinates to game coordinates
  const gameX = (x / canvas.width) * settings.fieldWidth;
  const gameY = (y / canvas.height) * settings.fieldHeight;

  gameEngine.updatePaddlePosition(gameX, gameY);
}

/**
 * Handle touch/mouse end
 * @param {Event} event - Touch or mouse event
 */
function handleTouchEnd(event) {
  if (!gameEngine) return;

  // Get touch coordinates
  const touch = event.changedTouches ? event.changedTouches[0] : event;
  const touchEndX = touch.clientX;
  const touchEndY = touch.clientY;
  const touchEndTime = performance.now();

  // Calculate swipe data
  const deltaX = touchEndX - touchStartX;
  const deltaY = touchEndY - touchStartY;
  const duration = touchEndTime - touchStartTime;

  // Only process if it's a significant swipe
  if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const speed = (distance / duration) * 1000; // pixels per second
    const angle = Math.atan2(deltaY, deltaX);

    /** @type {SwipeData} */
    const swipeData = {
      startX: touchStartX,
      startY: touchStartY,
      endX: touchEndX,
      endY: touchEndY,
      duration,
      speed,
      angle,
    };

    // Process swipe to return the ball
    if (gameEngine.processSwipe(swipeData)) {
      // Create particle effect for successful swipe
      if (gameRenderer) {
        gameRenderer.createParticleEffect(
          (touchEndX / gameRenderer.canvas.width) * settings.fieldWidth,
          (touchEndY / gameRenderer.canvas.height) * settings.fieldHeight,
          '#ff00e6'
        );
      }
    }
  }
}

/**
 * Handle window resize
 */
function handleResize() {
  if (gameRenderer) {
    gameRenderer.resize();
  }
}

/**
 * Copy text to clipboard
 * @param {HTMLTextAreaElement|HTMLInputElement} element - The element containing text to copy
 */
function copyToClipboard(element) {
  if (navigator.clipboard && element.value) {
    navigator.clipboard
      .writeText(element.value)
      .then(() => {
        alert('Copied to clipboard!');
      })
      .catch(err => {
        console.error('Could not copy text: ', err);
        element.select();
        try {
          document.execCommand('copy');
          alert('Copied to clipboard!');
        } catch (e) {
          console.error('Fallback clipboard copy failed: ', e);
          alert('Failed to copy to clipboard. Please copy the text manually.');
        }
      });
  } else {
    element.select();
    try {
      document.execCommand('copy');
      alert('Copied to clipboard!');
    } catch (e) {
      console.error('Clipboard copy failed: ', e);
      alert('Failed to copy to clipboard. Please copy the text manually.');
    }
  }
}

/**
 * Submit answer as host
 */
function submitAnswer() {
  const answer = answerInput.value.trim();
  if (!answer) {
    alert('Please enter a valid answer');
    return;
  }

  // Hide the submit button since we're auto-connecting
  if (submitAnswerBtn) {
    submitAnswerBtn.style.display = 'none';
  }

  // Update status to show we're connecting
  const hostConnectionStatus = document.getElementById('host-connection-status');
  if (hostConnectionStatus) {
    hostConnectionStatus.textContent = 'Connecting...';
  }

  try {
    // Process answer - connection will be established automatically
    // through the onConnected callback (handleConnectionSuccess)
    connection.processAnswer(answer);
  } catch (error) {
    console.error('Error processing answer:', error);

    // Show the submit button again in case of error
    if (submitAnswerBtn) {
      submitAnswerBtn.style.display = '';
    }

    if (hostConnectionStatus) {
      hostConnectionStatus.textContent = 'Connection failed';
    }

    alert('Error processing answer. Please try again.');
  }
}

// Add a global function to update ping display that can be called from anywhere
window.updatePing = function (rtt) {
  const pingText = `Ping: ${rtt}ms`;

  // Try to update both ping status elements
  const pingStatus = document.getElementById('ping-status');
  const gamePingStatus = document.getElementById('game-ping-status');

  if (pingStatus) {
    pingStatus.textContent = pingText;
  }

  if (gamePingStatus) {
    gamePingStatus.textContent = pingText;
  }

  // If neither element was found, create a fallback
  if (!pingStatus && !gamePingStatus) {
    const gameScreen = document.getElementById('game-screen');
    if (gameScreen) {
      // Check if we already created a fallback
      let fallbackPing = document.getElementById('fallback-ping-status');
      if (!fallbackPing) {
        fallbackPing = document.createElement('div');
        fallbackPing.id = 'fallback-ping-status';
        fallbackPing.className = 'status game-status';
        fallbackPing.style.position = 'absolute';
        fallbackPing.style.top = '10px';
        fallbackPing.style.right = '10px';
        fallbackPing.style.color = '#00f3ff';
        fallbackPing.style.zIndex = '1000';
        gameScreen.appendChild(fallbackPing);
      }
      fallbackPing.textContent = pingText;
    }
  }
};

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
