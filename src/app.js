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
  // Handle messages that should work even without a game engine
  if (message.type === 'startCountdown') {
    startCountdown(message.data.timestamp);
    return;
  }

  if (gameEngine) {
    switch (message.type) {
      case 'ball':
        // Guest receives ball data from host and transforms Y components for its view
        if (!isHost) {
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
        }
        // Host ignores ball messages (it's the source of truth)
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
  // First, notify the other player that we want to start the game
  if (connection && connection.isConnected) {
    connection.sendMessage({
      type: 'startCountdown',
      data: {
        timestamp: Date.now(),
      },
    });
  }

  // Start the countdown
  startCountdown();
}

/**
 * Start the countdown sequence
 * @param {number} [syncTimestamp] - Optional timestamp for synchronization between players
 */
function startCountdown(syncTimestamp) {
  console.log('Starting countdown, syncTimestamp:', syncTimestamp);
  
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

    // Initialize count to 3
    let count = 3;
    
    // Start with 3
    countdownNumber.textContent = '3';
    countdownNumber.style.animation = 'none';
    // Trigger reflow to restart animation
    void countdownNumber.offsetWidth;
    countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';

    // Calculate delay if syncTimestamp is provided (for guest)
    let initialDelay = 0;
    if (syncTimestamp) {
      // Calculate how much time has passed since the host started the countdown
      const currentTime = Date.now();
      const elapsedTime = currentTime - syncTimestamp;
      
      console.log('Elapsed time since countdown started:', elapsedTime);

      // If less than 3 seconds have passed, adjust the countdown
      if (elapsedTime < 3000) {
        initialDelay = Math.max(0, 1000 - (elapsedTime % 1000));
        
        // Calculate which number we should start with
        const secondsElapsed = Math.floor(elapsedTime / 1000);
        count = Math.max(1, 3 - secondsElapsed);
        
        console.log('Starting countdown at:', count, 'with delay:', initialDelay);
        
        // Update the display immediately to the correct number
        if (count < 3) {
          countdownNumber.textContent = count.toString();
        }
      } else {
        // If more than 3 seconds have passed, skip countdown
        console.log('Skipping countdown, too much time elapsed');
        countdownScreen.classList.add('hidden');
        startGameAfterCountdown();
        return;
      }
    }
    
    // Start the countdown after the initial delay (if any)
    setTimeout(() => {
      let countdownInterval;
      
      const runCountdown = () => {
        count--;
        console.log('Countdown:', count);

        if (count > 0) {
          // Update the countdown number
          countdownNumber.textContent = count.toString();
          countdownNumber.style.animation = 'none';
          // Trigger reflow to restart animation
          void countdownNumber.offsetWidth;
          countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';
        } else {
          // Countdown finished
          clearInterval(countdownInterval);

          // Hide countdown screen
          countdownScreen.classList.add('hidden');

          // Start the actual game
          startGameAfterCountdown();
        }
      };
      
      // If we're not starting at 3, we need to run the first countdown immediately
      if (count < 3) {
        runCountdown();
      }
      
      // Set up the interval for the remaining counts
      countdownInterval = setInterval(runCountdown, 1000);
    }, initialDelay);
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
      onBallOut: sendBallData,
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

  // If host, send the latest ball state to the guest
  if (isHost && connection) {
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
  playerScore.textContent = localScore;
  opponentScore.textContent = remoteScore;

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
 * Handle touch/mouse start
 * @param {Event} event - Touch or mouse event
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
 * @param {Event} event - Touch or mouse event
 */
function handleTouchMove(event) {
  if (!gameEngine || !gameEngine.gameState.isPlaying || gameEngine.gameState.isPaused) {
    return;
  }

  event.preventDefault();

  const touch = event.touches ? event.touches[0] : event;
  const currentX = touch.clientX;

  // Map screen coordinates to game coordinates
  const rect = gameCanvas.getBoundingClientRect();
  const scaleX = settings.fieldWidth / rect.width;

  const gameX = (currentX - rect.left) * scaleX;

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
 * @param {Event} event - Touch or mouse event
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
 * @param {HTMLTextAreaElement|HTMLInputElement} element - The element containing text to copy
 */
function copyToClipboard(element) {
  if (navigator.clipboard && element.value) {
    navigator.clipboard.writeText(element.value).catch(err => {
      console.error('Could not copy text: ', err);
      element.select();
      try {
        document.execCommand('copy');
      } catch (e) {
        console.error('Fallback clipboard copy failed: ', e);
        alert('Failed to copy to clipboard. Please copy the text manually.');
      }
    });
  } else {
    element.select();
    try {
      document.execCommand('copy');
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

/**
 * Handle paste event
 * @param {Event} event - Paste event
 */
function handlePaste(event) {
  // Get the pasted text
  const pastedText = event.clipboardData.getData('text/plain');

  // Set the input field value with the pasted text (allow default paste behavior)
  setTimeout(() => {
    // Check if the pasted text is valid JSON
    try {
      const parsedJson = JSON.parse(pastedText);

      // Only auto-submit if it's an object with expected properties
      if (typeof parsedJson === 'object' && parsedJson !== null) {
        // For offer data, check if it has type: 'offer' and sdp
        if (event.target === offerInput && parsedJson.type === 'offer' && parsedJson.sdp) {
          submitOfferBtn.click();
        }
        // For answer data, check if it has type: 'answer' and sdp
        else if (event.target === answerInput && parsedJson.type === 'answer' && parsedJson.sdp) {
          submitAnswerBtn.click();
        }
      }
    } catch (e) {
      // Not valid JSON, do nothing and let user submit manually
      console.log('Pasted content is not valid JSON');
    }
  }, 0);
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
