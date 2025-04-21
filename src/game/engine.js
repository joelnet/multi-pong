import settings from '../settings.json';

/**
 * @typedef {import('../types/index.js').Ball} Ball
 * @typedef {import('../types/index.js').Paddle} Paddle
 * @typedef {import('../types/index.js').Player} Player
 * @typedef {import('../types/index.js').GameState} GameState
 * @typedef {import('../types/index.js').SwipeData} SwipeData
 */

/**
 * Game engine responsible for game logic and physics
 */
export class GameEngine {
  /**
   * Create a new GameEngine instance
   * @param {Object} options - Game engine options
   * @param {boolean} options.isHost - Whether this client is the host
   * @param {Function} options.onScoreUpdate - Callback when score is updated
   * @param {Function} options.onBallOut - Callback when ball goes out of bounds
   * @param {Function} options.onGameOver - Callback when game is over
   */
  constructor({ isHost, onScoreUpdate, onBallOut, onGameOver }) {
    this.isHost = isHost;
    this.onScoreUpdate = onScoreUpdate;
    this.onBallOut = onBallOut;
    this.onGameOver = onGameOver;

    this.gameState = this.createInitialGameState();
    this.lastUpdateTime = 0;
  }

  /**
   * Create the initial game state
   * @returns {GameState} The initial game state
   * @private
   */
  createInitialGameState() {
    /** @type {GameState} */
    const gameState = {
      ball: {
        x: settings.fieldWidth / 2,
        y: settings.fieldHeight / 2,
        z: settings.fieldDepth / 2,
        radius: settings.ballRadius,
        velocityX: 0,
        velocityY: 0,
        velocityZ: 0,
        speed: settings.initialBallSpeed,
      },
      localPlayer: {
        paddle: {
          x: settings.fieldWidth / 2,
          y: settings.fieldHeight - 50,
          width: settings.paddleWidth,
          height: settings.paddleHeight,
          depth: 0,
        },
        score: 0,
        isHost: this.isHost,
      },
      remotePlayer: {
        paddle: {
          x: settings.fieldWidth / 2,
          y: 50,
          width: settings.paddleWidth,
          height: settings.paddleHeight,
          depth: settings.fieldDepth,
        },
        score: 0,
        isHost: !this.isHost,
      },
      isPlaying: false,
      isPaused: false,
      settings: {
        winScore: settings.winScore,
        initialBallSpeed: settings.initialBallSpeed,
        ballSpeedIncrement: settings.ballSpeedIncrement,
        maxBallSpeed: settings.maxBallSpeed,
      },
    };

    return gameState;
  }

  /**
   * Start the game
   */
  startGame() {
    this.gameState.isPlaying = true;
    this.gameState.isPaused = false;

    // If host, initialize ball movement
    if (this.isHost) {
      this.initBallMovement();
    }

    this.lastUpdateTime = performance.now();
  }

  /**
   * Initialize ball movement (host only)
   * @private
   */
  initBallMovement() {
    const ball = this.gameState.ball;

    // Reset ball position
    ball.x = settings.fieldWidth / 2;
    ball.y = settings.fieldHeight / 2;
    ball.z = settings.fieldDepth / 2;

    // Set initial velocity (random angle within bounds)
    const angle = (Math.random() * Math.PI) / 2 - Math.PI / 4; // -45 to 45 degrees
    ball.velocityX = Math.sin(angle) * ball.speed;
    ball.velocityY = 0;
    ball.velocityZ = this.isHost ? ball.speed : -ball.speed; // Direction depends on who serves
  }

  /**
   * Update game state
   * @param {number} timestamp - Current timestamp
   * @returns {boolean} Whether the game state was updated
   */
  update(timestamp) {
    if (!this.gameState.isPlaying || this.gameState.isPaused) {
      return false;
    }

    const deltaTime = (timestamp - this.lastUpdateTime) / 1000; // Convert to seconds
    this.lastUpdateTime = timestamp;

    // Update ball position
    this.updateBall(deltaTime);

    // Check for collisions
    this.checkCollisions();

    return true;
  }

  /**
   * Update ball position
   * @param {number} deltaTime - Time since last update in seconds
   * @private
   */
  updateBall(deltaTime) {
    const ball = this.gameState.ball;

    // Update position based on velocity
    ball.x += ball.velocityX * deltaTime;
    ball.y += ball.velocityY * deltaTime;
    ball.z += ball.velocityZ * deltaTime;

    // Bounce off side walls
    if (ball.x - ball.radius < 0 || ball.x + ball.radius > settings.fieldWidth) {
      ball.velocityX = -ball.velocityX;

      // Adjust position to prevent getting stuck in the wall
      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
      } else {
        ball.x = settings.fieldWidth - ball.radius;
      }
    }

    // Bounce off top/bottom walls (if enabled)
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > settings.fieldHeight) {
      ball.velocityY = -ball.velocityY;

      // Adjust position to prevent getting stuck in the wall
      if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
      } else {
        ball.y = settings.fieldHeight - ball.radius;
      }
    }

    // Check if ball is out of bounds (z-axis)
    if (ball.z < 0 || ball.z > settings.fieldDepth) {
      this.handleBallOut();
    }
  }

  /**
   * Check for collisions between ball and paddles
   * @private
   */
  checkCollisions() {
    const ball = this.gameState.ball;
    const localPaddle = this.gameState.localPlayer.paddle;
    const remotePaddle = this.gameState.remotePlayer.paddle;

    // Check collision with local paddle
    if (
      ball.z <= localPaddle.depth + ball.radius &&
      ball.z >= localPaddle.depth &&
      ball.velocityZ < 0 &&
      ball.x >= localPaddle.x - localPaddle.width / 2 &&
      ball.x <= localPaddle.x + localPaddle.width / 2 &&
      ball.y >= localPaddle.y - localPaddle.height / 2 &&
      ball.y <= localPaddle.y + localPaddle.height / 2
    ) {
      this.handlePaddleCollision(localPaddle, true);
    }

    // Check collision with remote paddle
    if (
      ball.z >= remotePaddle.depth - ball.radius &&
      ball.z <= remotePaddle.depth &&
      ball.velocityZ > 0 &&
      ball.x >= remotePaddle.x - remotePaddle.width / 2 &&
      ball.x <= remotePaddle.x + remotePaddle.width / 2 &&
      ball.y >= remotePaddle.y - remotePaddle.height / 2 &&
      ball.y <= remotePaddle.y + remotePaddle.height / 2
    ) {
      this.handlePaddleCollision(remotePaddle, false);
    }
  }

  /**
   * Handle collision between ball and paddle
   * @param {Paddle} paddle - The paddle that was hit
   * @param {boolean} isLocalPaddle - Whether the paddle belongs to the local player
   * @private
   */
  handlePaddleCollision(paddle, isLocalPaddle) {
    const ball = this.gameState.ball;

    // Reverse z-direction
    ball.velocityZ = -ball.velocityZ;

    // Adjust x-velocity based on where the ball hit the paddle
    const hitPosition = (ball.x - paddle.x) / (paddle.width / 2);
    ball.velocityX = hitPosition * ball.speed;

    // Increase ball speed
    ball.speed = Math.min(
      ball.speed + this.gameState.settings.ballSpeedIncrement,
      this.gameState.settings.maxBallSpeed
    );

    // Normalize the velocity vector to maintain consistent speed
    const magnitude = Math.sqrt(
      ball.velocityX * ball.velocityX +
        ball.velocityY * ball.velocityY +
        ball.velocityZ * ball.velocityZ
    );

    ball.velocityX = (ball.velocityX / magnitude) * ball.speed;
    ball.velocityY = (ball.velocityY / magnitude) * ball.speed;
    ball.velocityZ = (ball.velocityZ / magnitude) * ball.speed;

    // If this is the local paddle, we need to notify the other player
    if (isLocalPaddle && this.onBallOut) {
      this.onBallOut(ball);
    }
  }

  /**
   * Handle ball going out of bounds
   * @private
   */
  handleBallOut() {
    const ball = this.gameState.ball;

    // Update score based on which side the ball went out
    if (ball.z < 0) {
      // Ball went out on local player's side
      this.gameState.remotePlayer.score += 1;
    } else {
      // Ball went out on remote player's side
      this.gameState.localPlayer.score += 1;
    }

    // Notify score update
    if (this.onScoreUpdate) {
      this.onScoreUpdate(this.gameState.localPlayer.score, this.gameState.remotePlayer.score);
    }

    // Check if game is over
    if (
      this.gameState.localPlayer.score >= this.gameState.settings.winScore ||
      this.gameState.remotePlayer.score >= this.gameState.settings.winScore
    ) {
      this.gameState.isPlaying = false;

      if (this.onGameOver) {
        this.onGameOver(this.gameState.localPlayer.score > this.gameState.remotePlayer.score);
      }
    } else {
      // Reset ball for next round
      this.initBallMovement();
    }
  }

  /**
   * Update paddle position
   * @param {number} x - New x position
   * @param {number} y - New y position
   * @param {boolean} isLocalPaddle - Whether to update the local or remote paddle
   */
  updatePaddlePosition(x, y, isLocalPaddle = true) {
    const paddle = isLocalPaddle
      ? this.gameState.localPlayer.paddle
      : this.gameState.remotePlayer.paddle;

    paddle.x = Math.max(paddle.width / 2, Math.min(settings.fieldWidth - paddle.width / 2, x));

    paddle.y = Math.max(paddle.height / 2, Math.min(settings.fieldHeight - paddle.height / 2, y));
  }

  /**
   * Process a swipe to return the ball
   * @param {SwipeData} swipeData - Data about the swipe
   * @returns {boolean} Whether the swipe successfully returned the ball
   */
  processSwipe(swipeData) {
    const ball = this.gameState.ball;

    // Check if ball is in range to be hit
    if (ball.z > settings.fieldDepth / 4 || ball.velocityZ > 0) {
      return false;
    }

    // Calculate new velocity based on swipe
    const speed = Math.min(
      swipeData.speed / 10, // Scale down the swipe speed
      this.gameState.settings.maxBallSpeed
    );

    ball.velocityX = Math.cos(swipeData.angle) * speed;
    ball.velocityY = Math.sin(swipeData.angle) * speed;
    ball.velocityZ = -ball.velocityZ; // Reverse direction

    // Increase ball speed
    ball.speed = Math.min(
      ball.speed + this.gameState.settings.ballSpeedIncrement,
      this.gameState.settings.maxBallSpeed
    );

    return true;
  }

  /**
   * Reset the game state
   */
  resetGame() {
    this.gameState = this.createInitialGameState();
  }

  /**
   * Pause the game
   */
  pauseGame() {
    this.gameState.isPaused = true;
  }

  /**
   * Resume the game
   */
  resumeGame() {
    this.gameState.isPaused = false;
    this.lastUpdateTime = performance.now();
  }

  /**
   * Get the current game state
   * @returns {GameState} The current game state
   */
  getGameState() {
    return this.gameState;
  }

  /**
   * Update the game state with data from the remote player
   * @param {Object} data - The remote game state data
   */
  updateFromRemote(data) {
    if (data.ball) {
      this.gameState.ball = data.ball;
    }

    if (data.remotePaddle) {
      this.gameState.remotePlayer.paddle = data.remotePaddle;
    }

    if (data.score !== undefined) {
      this.gameState.remotePlayer.score = data.score.remote;
      this.gameState.localPlayer.score = data.score.local;

      if (this.onScoreUpdate) {
        this.onScoreUpdate(this.gameState.localPlayer.score, this.gameState.remotePlayer.score);
      }
    }
  }
}
