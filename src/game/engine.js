import settings from '../settings.json';

/**
 * @typedef {import('../types/index.js').Ball} Ball
 * @typedef {import('../types/index.js').Paddle} Paddle
 * @typedef {import('../types/index.js').Player} Player
 * @typedef {import('../types/index.js').GameState} GameState
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
        radius: settings.ballRadius,
        velocityX: 0,
        velocityY: 0,
        speed: settings.initialBallSpeed,
      },
      localPlayer: {
        paddle: {
          x: settings.fieldWidth / 2,
          y: settings.fieldHeight - settings.paddleHeight * 2, // Position near bottom
          width: settings.paddleWidth,
          height: settings.paddleHeight,
        },
        score: 0,
        isHost: this.isHost,
      },
      remotePlayer: {
        paddle: {
          x: settings.fieldWidth / 2,
          y: settings.paddleHeight * 2, // Position near top
          width: settings.paddleWidth,
          height: settings.paddleHeight,
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
    // FORCE the game state to playing
    this.gameState.isPlaying = true;
    this.gameState.isPaused = false;

    console.log('Game started, isPlaying set to:', this.gameState.isPlaying);

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

    // Give a random initial X direction, always start towards guest (positive Y for host)
    const initialAngle = ((Math.random() > 0.5 ? 1 : -1) * Math.PI) / 4; // 45 degrees
    ball.velocityX = settings.initialBallSpeed * Math.cos(initialAngle);
    ball.velocityY = settings.initialBallSpeed * Math.sin(initialAngle);

    // Host serves towards guest (positive Y)
    ball.velocityY = Math.abs(ball.velocityY);

    // Ensure speed property is set correctly
    ball.speed = settings.initialBallSpeed;
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

    // BUGFIX: Ensure we have a valid lastUpdateTime
    if (!this.lastUpdateTime) {
      this.lastUpdateTime = timestamp - 16; // Assume ~60fps (16ms frame time)
    }

    // Calculate deltaTime and ensure it's not too large or zero
    let deltaTime = (timestamp - this.lastUpdateTime) / 1000; // Convert to seconds
    // If deltaTime is zero or negative, force a reasonable value
    if (deltaTime <= 0) {
      deltaTime = 0.016; // Force 16ms if deltaTime is invalid
    }
    // Cap deltaTime to prevent huge jumps
    if (deltaTime > 0.1) {
      deltaTime = 0.1;
    }

    this.lastUpdateTime = timestamp;

    // Update ball position locally without sending network updates
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

    // Update ball position
    ball.x += ball.velocityX * deltaTime;
    ball.y += ball.velocityY * deltaTime;

    // Bounce off left/right walls
    if (ball.x - ball.radius < 0 || ball.x + ball.radius > settings.fieldWidth) {
      ball.velocityX = -ball.velocityX;

      // Adjust position to prevent getting stuck in the wall
      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
      } else {
        ball.x = settings.fieldWidth - ball.radius;
      }
    }

    // Bounce off top/bottom walls
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > settings.fieldHeight) {
      ball.velocityY = -ball.velocityY;

      // Adjust position to prevent getting stuck in the wall
      if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
      } else {
        ball.y = settings.fieldHeight - ball.radius;
      }
    }

    // Check if ball is out of bounds (top or bottom)
    if (ball.y > settings.fieldHeight + ball.radius) {
      this.handleBallOut();
    } else if (ball.y < -ball.radius) {
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

    // Simplified 2D AABB collision detection
    const collidesWithPaddle = paddle => {
      const paddleLeft = paddle.x - paddle.width / 2;
      const paddleRight = paddle.x + paddle.width / 2;
      const paddleTop = paddle.y - paddle.height / 2;
      const paddleBottom = paddle.y + paddle.height / 2;

      const ballLeft = ball.x - ball.radius;
      const ballRight = ball.x + ball.radius;
      const ballTop = ball.y - ball.radius;
      const ballBottom = ball.y + ball.radius;

      return (
        ballRight > paddleLeft &&
        ballLeft < paddleRight &&
        ballBottom > paddleTop &&
        ballTop < paddleBottom
      );
    };

    // Check collision with local paddle (at the bottom)
    if (
      ball.velocityY > 0 &&
      ball.y > settings.fieldHeight / 2 &&
      collidesWithPaddle(localPaddle)
    ) {
      this.handlePaddleCollision(localPaddle);
    }

    // Check collision with remote paddle (at the top)
    if (
      ball.velocityY < 0 &&
      ball.y < settings.fieldHeight / 2 &&
      collidesWithPaddle(remotePaddle)
    ) {
      this.handlePaddleCollision(remotePaddle);
    }
  }

  /**
   * Handle collision between ball and paddle
   * @param {Paddle} paddle - The paddle that was hit
   * @private
   */
  handlePaddleCollision(paddle) {
    const ball = this.gameState.ball;

    // Reverse Y velocity
    ball.velocityY = -ball.velocityY;

    // Adjust X velocity based on where it hit the paddle
    // Map hit position from -1 (left edge) to 1 (right edge)
    const hitX = (ball.x - paddle.x) / (paddle.width / 2);
    const influenceX = 0.75; // How much the paddle edge affects angle
    ball.velocityX += hitX * influenceX * ball.speed; // Adjust angle

    // Prevent ball from getting stuck by moving it slightly away from paddle
    const overlap = ball.radius + paddle.height / 2 - Math.abs(ball.y - paddle.y);
    if (overlap > 0) {
      ball.y += ball.velocityY > 0 ? overlap : -overlap;
    }

    // Increase ball speed slightly after each hit
    ball.speed = Math.min(
      ball.speed + this.gameState.settings.ballSpeedIncrement,
      this.gameState.settings.maxBallSpeed
    );
  }

  /**
   * Handle ball going out of bounds
   * @private
   */
  handleBallOut() {
    const ball = this.gameState.ball;

    // Update score based on which side the ball went out (top or bottom)
    if (ball.y > settings.fieldHeight + ball.radius) {
      // Ball went out on local player's side (bottom)
      this.gameState.remotePlayer.score += 1;
    } else if (ball.y < -ball.radius) {
      // Ball went out on remote player's side (top)
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
      this.initBallMovement(); // Reset ball position and velocity
      // Host decides who serves next based on score, maybe alternate?
      // For now, always serve towards the guest
      this.gameState.ball.velocityY = Math.abs(this.gameState.ball.velocityY);
    }
  }

  /**
   * Update paddle position
   * @param {number} x - New x position (Y position is fixed)
   * @param {boolean} isLocalPaddle - Whether to update the local or remote paddle
   */
  updatePaddlePosition(x, isLocalPaddle = true) {
    const paddle = isLocalPaddle
      ? this.gameState.localPlayer.paddle
      : this.gameState.remotePlayer.paddle;

    paddle.x = Math.max(paddle.width / 2, Math.min(settings.fieldWidth - paddle.width / 2, x));

    // Y position is fixed for 2D pong paddles
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

    if (data.remotePaddle && typeof data.remotePaddle.x === 'number') {
      // Only update x position from remote for paddle
      this.gameState.remotePlayer.paddle.x = data.remotePaddle.x;
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
