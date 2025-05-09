import { Connection } from './network/connection.js';
import { GameEngine } from './game/engine.js';
import { GameRenderer } from './game/renderer.js';
import { generateQRCode, initQRScanner as createQRScanner, clearQRScanner } from './lib/qrcode.js';
import { $, $$, showScene } from './lib/dom.js';
import settings from './settings.json';

/** @typedef {import('./types/index.js').GameMessage} GameMessage */

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
  $('host-btn').addEventListener('click', initHost);
  $('guest-btn').addEventListener('click', initGuest);
  $('submit-offer-btn').addEventListener('click', submitOffer);
  $('submit-answer-btn').addEventListener('click', submitAnswer);
  $('start-game-btn').addEventListener('click', startGame);

  // Add event listener for the play again button
  $('play-again-btn')?.addEventListener('click', startGame);
  // Add paste event listeners for auto-submit
  $('offer-input').addEventListener('paste', handlePaste);
  $('answer-input').addEventListener('paste', handlePaste);

  // Add event listener for the host done button
  $('host-done-btn')?.addEventListener('click', showHostWaitingScreen);

  // Add event listener for QR code click to copy (host)
  $('qr-host')?.addEventListener('click', () => {
    copyToClipboard($('offer-data').value);

    // Show visual feedback
    showCopyFeedback($('qr-host'));
  });

  // Add event listener for QR code click to copy (guest)
  $('qr-guest')?.addEventListener('click', () => {
    copyToClipboard($('answer-data').value);

    // Show visual feedback
    showCopyFeedback($('qr-guest'));
  });

  // Set up touch/mouse events for the game
  $('game-canvas').addEventListener('mousedown', handleTouchStart);
  $('game-canvas').addEventListener('mousemove', handleTouchMove);
  $('game-canvas').addEventListener('mouseup', handleTouchEnd);
  $('game-canvas').addEventListener('touchstart', handleTouchStart);
  $('game-canvas').addEventListener('touchmove', handleTouchMove);
  $('game-canvas').addEventListener('touchend', handleTouchEnd);

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
  $('host-btn').disabled = true;
  $('guest-btn').disabled = true;

  // Hide the connection options
  $('connection-options').classList.add('hidden');

  showScene('host-screen');

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
    $('offer-data').value = offer;

    // Generate QR code
    await generateQRCode(offer, $('qr-host'));
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
  $('host-share-section')?.classList.add('hidden');
  $('host-answer-input')?.classList.remove('hidden');

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
      $('answer-input').value = decodedText;

      // Auto-submit the answer data
      submitAnswer();
    } else {
      // Fill the offer input with the processed data
      $('offer-input').value = decodedText;

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
  $('host-btn').disabled = true;
  $('guest-btn').disabled = true;

  // Hide the connection options
  $('connection-options').classList.add('hidden');

  // Show the guest screen
  showScene('guest-screen');
  // Initialize the QR scanner for the guest using the host's scanner implementation
  initHostQRScanner();
}

/**
 * Submit offer as guest
 */
async function submitOffer() {
  const offerValue = $('offer-input').value.trim();

  if (!offerValue) {
    alert('Please enter or scan an offer');
    return;
  }

  // Hide the submit button since we're auto-connecting
  if ($('submit-offer-btn')) {
    $('submit-offer-btn').style.display = 'none';
  }

  // Show loading state
  $('guest-connection-status').textContent = 'Connecting...';

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
      .then(answerDataValue => {
        // Hide the offer input section
        const guestOfferSection = $('guest-offer-section');
        if (guestOfferSection) {
          guestOfferSection?.classList.add('hidden');
        }

        // Show the answer data
        if ($('answer-data')) {
          $('answer-data').value = answerDataValue;
        }

        if ($('answer-section')) {
          $('answer-section').classList.remove('hidden');
        } else {
          // If answer-section doesn't exist, show the guest-answer-output instead
          $('guest-answer-output')?.classList.remove('hidden');
        }

        // Generate QR code for the answer data
        if ($('qr-guest')) {
          generateQRCode(answerDataValue, $('qr-guest'));
        }

        // Update status
        $('guest-connection-status').textContent = 'Waiting for host to accept...';

        // Note: The connection will be established automatically when the host processes the answer
        // through the onConnected callback (handleConnectionSuccess)
      })
      .catch(error => {
        console.error('Error initializing as guest:', error);
        alert('Error connecting: ' + error.message);

        // Show the submit button again in case of error
        if ($('submit-offer-btn')) {
          $('submit-offer-btn').style.display = '';
        }

        $('guest-connection-status').textContent = 'Not connected';
      });
  } catch (error) {
    console.error('Error initializing as guest:', error);
    alert('Error connecting: ' + error.message);

    // Show the submit button again in case of error
    if ($('submit-offer-btn')) {
      $('submit-offer-btn').style.display = '';
    }

    $('guest-connection-status').textContent = 'Not connected';
  }
}

/**
 * Handle successful connection
 */
function handleConnectionSuccess() {
  // Hide all screens first
  $('host-screen').classList.add('hidden');
  $('guest-screen').classList.add('hidden');

  // Show connection success screen
  showScene('connection-success');

  // Update connection status for both host and guest
  if ($('host-connection-status')) {
    $('host-connection-status').textContent = 'Connected!';
  }

  if ($('guest-connection-status')) {
    $('guest-connection-status').textContent = 'Connected!';
  }

  // Enable the start game button
  if ($('start-game-btn')) {
    $('start-game-btn').disabled = false;
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

  try {
    const pingStatus = $('ping-status');
    const gamePingStatus = $('game-ping-status');

    if (pingStatus) {
      pingStatus.textContent = pingText;
    }

    if (gamePingStatus) {
      gamePingStatus.textContent = pingText;
    }

    if (!pingStatus && !gamePingStatus) {
      $$('[id$="ping-status"]').forEach(element => {
        element.textContent = pingText;
      });
    }

    if (!pingStatus && !gamePingStatus && $$('[id$="ping-status"]').length === 0) {
      if ($('game-screen')) {
        const newPingStatus = document.createElement('div');
        newPingStatus.id = 'emergency-ping-status';
        newPingStatus.className = 'status game-status';
        newPingStatus.textContent = pingText;
        $('game-screen').appendChild(newPingStatus);
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

  $('host-btn').disabled = false;
  $('guest-btn').disabled = false;
  $('submit-offer-btn').disabled = false;
  $('submit-answer-btn').disabled = false;

  // Show the connection options again
  $('connection-options').classList.remove('hidden');

  // Hide all screens
  $('host-screen').classList.add('hidden');
  $('guest-screen').classList.add('hidden');
  $('connection-success').classList.add('hidden');

  // Reset host screen sections
  $('host-share-section')?.classList.remove('hidden');
  $('host-answer-input')?.classList.add('hidden');

  // Reset guest screen sections
  $('guest-offer-section')?.classList.remove('hidden');
  $('guest-answer-output')?.classList.add('hidden');

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
  $('offer-data').value = '';
  $('offer-input').value = '';
  $('answer-input').value = '';
  $('answer-data').value = '';
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
  $('game-over-screen')?.classList.add('hidden');

  // Hide all connection-related screens
  $('connection-options')?.classList.add('hidden');
  $('host-screen')?.classList.add('hidden');
  $('guest-screen')?.classList.add('hidden');
  $('connection-success').classList.add('hidden');

  // Show countdown screen
  const countdownScreen = $('countdown-screen');
  const countdownNumber = $('countdown-number');

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
  $('game-screen').classList.remove('hidden');

  // Disable start button to prevent multiple clicks
  $('start-game-btn').disabled = true;

  // Initialize game engine if not already done
  if (!gameEngine) {
    gameEngine = new GameEngine({
      isHost,
      onScoreUpdate: updateScore,
      onBallOut: handleBallOut,
      onGameOver: handleGameOver,
    });

    // Initialize game renderer
    gameRenderer = new GameRenderer($('game-canvas'));

    // Handle window resize
    handleResize();
  }

  // Start the game
  gameEngine.startGame();
  if (!isHost) {
    // guest needs to serve the first ball
    sendBallData(gameEngine.gameState.ball, false);
  }

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

  const previousBall = { ...gameEngine.gameState.ball };

  // Update game state
  gameEngine.update(timestamp);

  // If source of truth, send the latest ball state to the guest
  if (gameEngine?.isSourceOfTruth()) {
    const gameState = gameEngine.getGameState();
    const nextBall = gameState.ball;

    // If ball velocity changed send data
    if (
      nextBall.velocityX !== previousBall.velocityX ||
      nextBall.velocityY !== previousBall.velocityY
    ) {
      sendBallData(nextBall, false);
    }
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
  $('player-score').textContent = String(localScore);
  $('opponent-score').textContent = String(remoteScore);

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
  console.log('handleBallOut called with:', { ball, isReturn, isWallHit });
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
  if ($('game-over-screen')) {
    $('game-over-screen').classList.remove('hidden');

    // Update game result message
    if ($('game-result')) {
      $('game-result').textContent = localWon ? 'You Win!' : 'You Lose!';
    }

    // Update final scores
    const finalPlayerScore = $('final-player-score');
    const finalOpponentScore = $('final-opponent-score');
    const gameOverPingStatus = $('game-over-ping-status');

    if (finalPlayerScore && finalOpponentScore) {
      finalPlayerScore.textContent = $('player-score').textContent;
      finalOpponentScore.textContent = $('opponent-score').textContent;
    }

    // Copy ping status to game over screen
    if (gameOverPingStatus) {
      const gamePingStatus = $('game-ping-status');
      if (gamePingStatus) {
        gameOverPingStatus.textContent = gamePingStatus.textContent;
      }
    }
  }

  // Hide game screen
  $('game-screen').classList.add('hidden');

  // Hide all connection-related screens
  $('connection-options').classList.add('hidden');
  $('host-screen').classList.add('hidden');
  $('guest-screen').classList.add('hidden');
  $('connection-success').classList.add('hidden');

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
  const rect = $('game-canvas').getBoundingClientRect();
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
  const answer = $('answer-input').value.trim();
  if (!answer) {
    alert('Please enter a valid answer');
    return;
  }

  // Hide the submit button since we're auto-connecting
  if ($('submit-answer-btn')) {
    $('submit-answer-btn').style.display = 'none';
  }

  // Update status to show we're connecting
  if ($('host-connection-status')) {
    $('host-connection-status').textContent = 'Connecting...';
  }

  try {
    // Process answer - connection will be established automatically
    // through the onConnected callback (handleConnectionSuccess)
    connection.processAnswer(answer);
  } catch (error) {
    console.error('Error processing answer:', error);

    // Show the submit button again in case of error
    if ($('submit-answer-btn')) {
      $('submit-answer-btn').style.display = '';
    }

    if ($('host-connection-status')) {
      $('host-connection-status').textContent = 'Connection failed';
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
        if (event.target === $('offer-input') && parsedJson.type === 'offer' && parsedJson.sdp) {
          $('submit-offer-btn').click();
        } else if (
          event.target === $('answer-input') &&
          parsedJson.type === 'answer' &&
          parsedJson.sdp
        ) {
          $('submit-answer-btn').click();
        }
      }
    } catch (e) {
      console.log('Pasted content is not valid JSON');
    }
  }, 0);
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
