import { Connection } from './network/connection.js';
import { GameEngine } from './game/engine.js';
import { GameRenderer } from './game/renderer.js';
import { generateQRCode, initQRScanner as createQRScanner, clearQRScanner } from './lib/qrcode.js';
import settings from './settings.json';

/** @typedef {import('./types/index.js').GameMessage} GameMessage */

// DOM Elements
const connectionScreen = document.getElementById('connection-screen');
const gameScreen = document.getElementById('game-screen');
/** @type {HTMLButtonElement} */
const hostBtn = /** @type {HTMLButtonElement} */ (document.getElementById('host-btn'));
/** @type {HTMLButtonElement} */
const guestBtn = /** @type {HTMLButtonElement} */ (document.getElementById('guest-btn'));
const hostScreen = document.getElementById('host-screen');
const guestScreen = document.getElementById('guest-screen');
const qrHost = document.getElementById('qr-host');
/** @type {HTMLTextAreaElement} */
const offerData = /** @type {HTMLTextAreaElement} */ (document.getElementById('offer-data'));
/** @type {HTMLTextAreaElement} */
const offerInput = /** @type {HTMLTextAreaElement} */ (document.getElementById('offer-input'));
/** @type {HTMLButtonElement} */
const submitOfferBtn = /** @type {HTMLButtonElement} */ (
  document.getElementById('submit-offer-btn')
);
const hostAnswerInput = document.getElementById('host-answer-input');
const guestAnswerOutput = document.getElementById('guest-answer-output');
/** @type {HTMLTextAreaElement} */
const answerData = /** @type {HTMLTextAreaElement} */ (document.getElementById('answer-data'));
/** @type {HTMLTextAreaElement} */
const answerInput = /** @type {HTMLTextAreaElement} */ (document.getElementById('answer-input'));
/** @type {HTMLButtonElement} */
const submitAnswerBtn = /** @type {HTMLButtonElement} */ (
  document.getElementById('submit-answer-btn')
);
const guestConnectionStatus = document.getElementById('guest-connection-status');
const connectionSuccess = document.getElementById('connection-success');
/** @type {HTMLButtonElement} */
const startGameBtn = /** @type {HTMLButtonElement} */ (document.getElementById('start-game-btn'));
/** @type {HTMLCanvasElement} */
const gameCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game-canvas'));
/** @type {HTMLElement} */
const playerScore = /** @type {HTMLElement} */ (document.getElementById('player-score'));
/** @type {HTMLElement} */
const opponentScore = /** @type {HTMLElement} */ (document.getElementById('opponent-score'));

// Game state
/** @type {Connection} */
let connection = null;
/** @type {GameEngine} */
let gameEngine = null;
/** @type {GameRenderer} */
let gameRenderer = null;
let isHost = false;
/** @type {number} */
let animationFrameId = null;
/** @type {any} */
let hostQrCodeScanner = null;
/** @type {any} */
let guestQrCodeScanner = null;

/**
 * Initialize the application
 */
function init() {
  // Set up event listeners
  hostBtn.addEventListener('click', initHost);
  guestBtn.addEventListener('click', initGuest);
  submitOfferBtn.addEventListener('click', submitOffer);
  submitAnswerBtn.addEventListener('click', submitAnswer);
  startGameBtn.addEventListener('click', startGame);

  // Add event listener for the play again button
  const playAgainBtn = document.getElementById('play-again-btn');
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', startGame);
  }

  // Add paste event listeners for auto-submit
  offerInput.addEventListener('paste', handlePaste);
  answerInput.addEventListener('paste', handlePaste);

  // Add event listener for the host done button
  const hostDoneBtn = document.getElementById('host-done-btn');
  if (hostDoneBtn) {
    hostDoneBtn.addEventListener('click', showHostWaitingScreen);
  }

  // Add event listener for QR code click to copy (host)
  const qrHost = document.getElementById('qr-host');
  if (qrHost) {
    qrHost.addEventListener('click', () => {
      copyToClipboard(offerData.value);

      // Show visual feedback
      showCopyFeedback(qrHost);
    });
  }

  // Add event listener for QR code click to copy (guest)
  const qrGuest = document.getElementById('qr-guest');
  if (qrGuest) {
    qrGuest.addEventListener('click', () => {
      copyToClipboard(answerData.value);

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
 * Initialize the QR code scanner for both host and guest
 */
function initHostQRScanner() {
  // Define the success callback based on whether we're host or guest
  const onScanSuccess = decodedText => {
    console.log(`QR Code detected: ${decodedText}`);

    try {
      // Try to parse the JSON data
      const jsonData = JSON.parse(decodedText);
      console.log('Parsed JSON data:', jsonData);
    } catch (error) {
      console.log('QR code contains non-JSON data, treating as raw SDP string');
    }

    if (isHost) {
      // Fill the answer input with the scanned data
      answerInput.value = decodedText;

      // Auto-submit the answer data
      submitAnswer();
    } else {
      // Fill the offer input with the processed data
      offerInput.value = decodedText;

      // Auto-submit the offer data
      submitOffer();
    }

    // Clear the scanner HTML
    clearQRScanner(html5QrcodeScanner);
  };

  // Initialize the QR code scanner with the appropriate element ID
  const elementId = isHost ? 'host-qr-scanner' : 'guest-qr-scanner';
  const html5QrcodeScanner = createQRScanner(elementId, onScanSuccess);

  // Store scanner instance in a module-level variable for access
  if (isHost) {
    hostQrCodeScanner = html5QrcodeScanner;
  } else {
    guestQrCodeScanner = html5QrcodeScanner;
  }
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
  // Initialize the QR scanner for the guest using the host's scanner implementation
  initHostQRScanner();
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
        /** @type {HTMLTextAreaElement} */
        const answerDataElement = /** @type {HTMLTextAreaElement} */ (
          document.getElementById('answer-data')
        );
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
  // Handle messages that should work even without a game engine
  if (message.type === 'startCountdown') {
    startCountdown(message.data.timestamp);
    return;
  }

  if (gameEngine) {
    switch (message.type) {
      case 'ball':
        // Guest receives ball data from host and transforms Y components for its view
        if (message.data) {
          const receivedBall = message.data;
          const fieldHeight = settings.fieldHeight; // Use settings
          const transformedBall = {
            ...receivedBall, // Copy all properties first
            y: fieldHeight - receivedBall.y, // Flip Y position
            velocityY: -receivedBall.velocityY, // Flip Y velocity
            // x and velocityX remain the same as host's
          };
          gameEngine.updateFromRemote({ ball: transformedBall });
        } else {
          console.warn('Guest received invalid ball data:', message.data);
        }
        break;
      case 'paddle':
        // Guest receives paddle data from host
        // Host receives paddle data from guest
        if (message.data && typeof message.data.x === 'number') {
          gameEngine.updateFromRemote({ remotePaddle: message.data });
        } else {
          console.warn('Received invalid paddle data:', message.data);
        }
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
  if (guestQrCodeScanner) {
    clearQRScanner(guestQrCodeScanner);
    guestQrCodeScanner = null;
  }

  if (hostQrCodeScanner) {
    clearQRScanner(hostQrCodeScanner);
    hostQrCodeScanner = null;
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
  // Calculate a future timestamp for synchronized countdown start
  // Use a small buffer (100ms) just to account for message transmission
  const startTimestamp = Date.now() + 100;

  // First, notify the other player that we want to start the game
  if (connection && connection.isConnected) {
    connection.sendMessage({
      type: 'startCountdown',
      data: {
        timestamp: startTimestamp,
      },
    });
  }

  // Start the countdown with the future timestamp
  startCountdown(startTimestamp);
}

/**
 * Start the countdown sequence
 * @param {number} startTimestamp - Timestamp when the countdown should start
 */
function startCountdown(startTimestamp) {
  console.log('Countdown will start at timestamp:', startTimestamp);

  // Hide the game over screen if it's visible
  const gameOverScreen = document.getElementById('game-over-screen');
  if (gameOverScreen) {
    gameOverScreen.classList.add('hidden');
  }

  // Hide connection screen
  connectionScreen.classList.add('hidden');

  // Show countdown screen
  const countdownScreen = document.getElementById('countdown-screen');
  const countdownNumber = document.getElementById('countdown-number');

  if (countdownScreen && countdownNumber) {
    countdownScreen.classList.remove('hidden');

    // Show 3 immediately
    countdownNumber.textContent = '3';
    countdownNumber.style.animation = 'none';
    void countdownNumber.offsetWidth;
    countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';

    // Calculate how long to wait before starting the countdown for 2 and 1
    const now = Date.now();
    const waitTime = Math.max(0, startTimestamp - now);

    console.log(`Waiting ${waitTime}ms before continuing countdown`);

    // Wait until the specified start time before showing 2
    setTimeout(() => {
      // Count down from 2 to 1
      let count = 2;

      const countdownInterval = setInterval(() => {
        // Update the countdown number
        countdownNumber.textContent = count.toString();
        countdownNumber.style.animation = 'none';
        void countdownNumber.offsetWidth;
        countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';

        count--;

        if (count < 0) {
          // Countdown finished
          clearInterval(countdownInterval);
          countdownScreen.classList.add('hidden');
          startGameAfterCountdown();
        }
      }, 1000);
    }, waitTime);
  } else {
    // If countdown elements don't exist, start the game immediately
    startGameAfterCountdown();
  }
}

/**
 * Start the game after countdown completes
 */
function startGameAfterCountdown() {
  // Show game screen
  gameScreen.classList.remove('hidden');

  // Disable start button to prevent multiple clicks
  startGameBtn.disabled = true;

  // Initialize game engine if not already done
  if (!gameEngine) {
    gameEngine = new GameEngine({
      isHost,
      onScoreUpdate: updateScore,
      onBallOut: handleBallOut,
      onGameOver: handleGameOver,
    });

    // Initialize game renderer
    gameRenderer = new GameRenderer(gameCanvas);

    // Handle window resize
    handleResize();
  }

  // Start the game
  gameEngine.startGame();

  // Start the game loop
  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(gameLoop);
  }

  console.log('Game started!');
}

/**
 * Game loop
 * @param {number} timestamp - Current timestamp
 */
function gameLoop(timestamp) {
  if (!gameEngine || !gameRenderer) return;

  // Update game state
  gameEngine.update(timestamp);

  // If source of truth, send the latest ball state to the guest
  if (gameEngine && gameEngine.isSourceOfTruth() && connection) {
    const gameState = gameEngine.getGameState();

    // Note: Ignoring isReturn flag for now to focus on basic animation
    sendBallData(gameState.ball, false);
  }

  // Render game
  gameRenderer.render(gameEngine.getGameState());

  // Continue loop
  animationFrameId = requestAnimationFrame(gameLoop);
}

/**
 * Update score display
 * @param {number} localScore - Local player score
 * @param {number} remoteScore - Remote player score
 */
function updateScore(localScore, remoteScore) {
  playerScore.textContent = String(localScore);
  opponentScore.textContent = String(remoteScore);

  // If this client is the host, send the score update to the guest.
  // The guest's handleMessage will receive this and trigger its own engine/UI update.
  if (isHost && connection) {
    // Use the correct method name: sendMessage
    connection.sendMessage({
      type: 'score',
      // Send the scores as received by this function.
      // Guest's engine will interpret these based on the host's perspective.
      data: {
        local: localScore, // Host's score
        remote: remoteScore, // Guest's score
      },
    });
  }

  // Apply screen shake effect on score update
  if (gameRenderer) {
    gameRenderer.screenShake(10, 500);
  }
}

/**
 * Send ball data to other player
 * @param {import('./types/index.js').Ball} ball - Ball data
 * @param {boolean} [isReturn=false] - Whether this is a ball return (for effects)
 */
function sendBallData(ball, isReturn = false) {
  if (!connection) return;

  connection.sendMessage({
    type: 'ball',
    data: ball,
  });

  // Only create particle effects and screen shake when the ball is returned
  if (isReturn && gameRenderer) {
    gameRenderer.createParticleEffect(ball.x, ball.y);
    gameRenderer.screenShake();
  }
}

/**
 * Handle ball going out of bounds or being returned
 * @param {import('./types/index.js').Ball} ball - Ball data
 * @param {boolean} [isReturn=false] - Whether this is a ball return
 * @param {boolean} [isWallHit=false] - Whether this is a wall hit
 */
function handleBallOut(ball, isReturn = false, isWallHit = false) {
  // Create particle effect at ball position
  if (gameRenderer) {
    // Different color based on direction
    const color = ball.velocityY > 0 ? '#00f3ff' : '#ff00e6';

    if (isReturn) {
      // More particles for paddle hit
      gameRenderer.createParticleEffect(ball.x, ball.y, color);
      // Apply screen shake on paddle hit
      gameRenderer.screenShake(5, 200);
    } else if (isWallHit) {
      // Fewer particles for wall hit
      gameRenderer.createParticleEffect(ball.x, ball.y, color);
      // Lighter screen shake for wall hit
      gameRenderer.screenShake(3, 150);
    }
  }

  // Send ball data to other player if we're the host
  if (isHost) {
    sendBallData(ball, isReturn);
  }
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

  // If this is the host, send game over message to guest
  if (isHost && connection && connection.isConnected) {
    connection.sendMessage({
      type: 'gameOver',
      data: {
        localWon: !localWon, // Invert for guest perspective
      },
    });
  }

  // Show game over screen
  const gameOverScreen = document.getElementById('game-over-screen');
  if (gameOverScreen) {
    gameOverScreen.classList.remove('hidden');

    // Update game result message
    const gameResult = document.getElementById('game-result');
    if (gameResult) {
      gameResult.textContent = localWon ? 'You Win!' : 'You Lose!';
    }

    // Update final scores
    const finalPlayerScore = document.getElementById('final-player-score');
    const finalOpponentScore = document.getElementById('final-opponent-score');
    const gameOverPingStatus = document.getElementById('game-over-ping-status');

    if (finalPlayerScore && finalOpponentScore) {
      finalPlayerScore.textContent = playerScore.textContent;
      finalOpponentScore.textContent = opponentScore.textContent;
    }

    // Copy ping status to game over screen
    if (gameOverPingStatus) {
      const gamePingStatus = document.getElementById('game-ping-status');
      if (gamePingStatus) {
        gameOverPingStatus.textContent = gamePingStatus.textContent;
      }
    }
  }

  // Hide game screen
  gameScreen.classList.add('hidden');

  // Hide connection screen (we'll show game over screen instead)
  connectionScreen.classList.add('hidden');

  // Reset game
  if (gameEngine) {
    gameEngine.resetGame();
  }
}

/**
 * Handle touch start
 * @param {TouchEvent|MouseEvent} event - Touch or mouse event
 */
function handleTouchStart(event) {
  if (!gameEngine || !gameEngine.gameState.isPlaying || gameEngine.gameState.isPaused) {
    return;
  }

  event.preventDefault();

  handleTouchMove(event); // Pass the event to immediately update position
  console.log('Touch start');
}

/**
 * Handle touch/mouse move
 * @param {TouchEvent|MouseEvent} event - Touch or mouse event
 */
function handleTouchMove(event) {
  if (!gameEngine || !gameEngine.gameState.isPlaying || gameEngine.gameState.isPaused) {
    return;
  }

  event.preventDefault();

  let clientX;
  // Check if it's a touch event
  if ('touches' in event && event.touches.length > 0) {
    clientX = event.touches[0].clientX;
  } else if ('clientX' in event) {
    // It's a mouse event
    clientX = event.clientX;
  } else {
    // Unknown event type
    return;
  }

  // Map screen coordinates to game coordinates
  const rect = gameCanvas.getBoundingClientRect();
  const scaleX = settings.fieldWidth / rect.width;

  const gameX = (clientX - rect.left) * scaleX;

  // Update local paddle position
  gameEngine.updatePaddlePosition(gameX, true);

  // Send local paddle position to remote player
  if (connection) {
    const localPaddle = gameEngine.getGameState().localPlayer.paddle;
    connection.sendMessage({
      type: 'paddle',
      data: { x: localPaddle.x }, // Send only the x coordinate
    });
  }
}

/**
 * Handle touch/mouse end
 * @param {TouchEvent|MouseEvent} event - Touch or mouse event
 */
function handleTouchEnd(event) {
  if (!gameEngine || !gameEngine.gameState.isPlaying || gameEngine.gameState.isPaused) {
    return;
  }

  event.preventDefault();

  // No action needed on touch end for simple paddle movement
  console.log('Touch end');
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
 * @param {HTMLTextAreaElement|HTMLInputElement|string} source - The element or string containing text to copy
 */
function copyToClipboard(source) {
  let textToCopy = '';
  if (typeof source === 'string') {
    textToCopy = source;
  } else if (source?.value) {
    textToCopy = source.value;
  } else if (source?.textContent) {
    textToCopy = source.textContent;
  } else {
    console.error('Invalid source for clipboard copy');
    return;
  }

  if (navigator.clipboard) {
    navigator.clipboard.writeText(textToCopy).catch(err => {
      console.error('Could not copy text: ', err);
      fallbackCopy(textToCopy);
    });
  } else {
    fallbackCopy(textToCopy);
  }
}

/**
 * Fallback method for copying text
 * @param {string} text - Text to copy
 */
function fallbackCopy(text) {
  const tempTextArea = document.createElement('textarea');
  tempTextArea.value = text;
  tempTextArea.style.position = 'fixed';
  tempTextArea.style.opacity = '0';
  document.body.appendChild(tempTextArea);
  tempTextArea.select();
  try {
    document.execCommand('copy');
  } catch (e) {
    console.error('Clipboard copy failed: ', e);
    alert('Failed to copy to clipboard. Please copy the text manually.');
  }
  document.body.removeChild(tempTextArea);
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

/**
 * Handle paste event
 * @param {ClipboardEvent} event - Paste event
 */
function handlePaste(event) {
  const pastedText = event.clipboardData.getData('text/plain');

  setTimeout(() => {
    try {
      const parsedJson = JSON.parse(pastedText);

      if (typeof parsedJson === 'object' && parsedJson !== null) {
        if (event.target === offerInput && parsedJson.type === 'offer' && parsedJson.sdp) {
          submitOfferBtn.click();
        } else if (event.target === answerInput && parsedJson.type === 'answer' && parsedJson.sdp) {
          submitAnswerBtn.click();
        }
      }
    } catch (e) {
      console.log('Pasted content is not valid JSON');
    }
  }, 0);
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
