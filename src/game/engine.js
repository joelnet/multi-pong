import settings from '../settings.json';
import { createSoundEffects } from '../effects/sound.js';

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

    // Initialize sound effects
    this.soundEffects = createSoundEffects();
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
    this.gameState.isPlaying = true;
    this.gameState.isPaused = false;

    console.log('Game started, isPlaying set to:', this.gameState.isPlaying);

    // Play game start sound
    this.soundEffects.playGameStart();

    // Ball moves towards the guest, who is the source of truth, so start ball movement.
    if (!this.isHost) {
      this.initBallMovement(false); // Serve towards remote player (top)
    }

    this.lastUpdateTime = performance.now();
  }

  /**
   * Initialize ball movement (called by the source of truth player)
   * @param {boolean} [serveTowardsLocal=false] - If true, serve towards the local player (bottom), otherwise serve towards remote (top).
   * @private
   */
  initBallMovement(serveTowardsLocal = false) {
    const ball = this.gameState.ball;

    // Set ball X position to the center horizontally
    ball.x = settings.fieldWidth / 2;

    // Set ball Y position based on serving direction
    // If serving towards local (bottom), start from top of screen
    // If serving towards remote (top), start from bottom of screen
    const paddleOffset = settings.paddleHeight * 3; // Keep some distance from the paddle

    if (serveTowardsLocal) {
      // Serving towards local (bottom), start from top area
      ball.y = paddleOffset;
    } else {
      // Serving towards remote (top), start from bottom area
      ball.y = settings.fieldHeight - paddleOffset;
    }

    // Give a random initial X direction
    // Use a slightly less steep angle than 45deg
    const angleRange = Math.PI / 6; // +/- 30 degrees from horizontal
    const initialAngle = Math.random() * angleRange * 2 - angleRange; // Random angle between -30 and +30 deg

    ball.velocityX = settings.initialBallSpeed * Math.cos(initialAngle);
    ball.velocityY = settings.initialBallSpeed * Math.sin(initialAngle);

    // Ensure the Y velocity has a minimum magnitude to prevent very horizontal serves
    const minYVelocityFraction = 0.2; // Minimum 20% of speed goes to Y velocity
    if (Math.abs(ball.velocityY) < settings.initialBallSpeed * minYVelocityFraction) {
      const signY =
        ball.velocityY === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(ball.velocityY);
      ball.velocityY = signY * settings.initialBallSpeed * minYVelocityFraction;
      // Recalculate X velocity to maintain speed
      const signX =
        ball.velocityX === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(ball.velocityX);
      ball.velocityX =
        signX *
        Math.sqrt(
          settings.initialBallSpeed * settings.initialBallSpeed - ball.velocityY * ball.velocityY
        );
    }

    // Host is local (bottom, positive Y), Remote is guest (top, negative Y)
    // If serveTowardsLocal is true, Y velocity should be positive.
    // If serveTowardsLocal is false, Y velocity should be negative.
    ball.velocityY = serveTowardsLocal ? Math.abs(ball.velocityY) : -Math.abs(ball.velocityY);

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

    // Update position based on velocity
    ball.x += ball.velocityX * deltaTime;
    ball.y += ball.velocityY * deltaTime;

    // Collision with left/right walls
    if (ball.x - ball.radius < 0 || ball.x + ball.radius > settings.fieldWidth) {
      ball.velocityX = -ball.velocityX;
      // Clamp position to prevent sticking
      ball.x = Math.max(ball.radius, Math.min(settings.fieldWidth - ball.radius, ball.x));
    }

    // Check if ball went out of bounds (top/bottom)
    // Let handleBallOut manage scoring and reset.
    if (ball.y > settings.fieldHeight + ball.radius || ball.y < -ball.radius) {
      // Only the source of truth should process scoring and reset logic
      if (this.isSourceOfTruth()) {
        this.handleBallOut();
      }
      // Non-source clients will receive the updated state from the source of truth.
      // No immediate action needed here for the non-source.
    }

    // Collision with paddles (handled in checkCollisions)
    // Only the source of truth should check for collisions
    if (this.isSourceOfTruth()) {
      this.checkCollisions();
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

    // Check collision with local paddle (bottom)
    if (
      ball.velocityY > 0 && // Ball is moving downward
      ball.y + ball.radius > localPaddle.y - localPaddle.height / 2 && // Ball bottom edge is below paddle top edge
      ball.y - ball.radius < localPaddle.y + localPaddle.height / 2 && // Ball top edge is above paddle bottom edge
      ball.x + ball.radius > localPaddle.x - localPaddle.width / 2 && // Ball right edge is right of paddle left edge
      ball.x - ball.radius < localPaddle.x + localPaddle.width / 2 // Ball left edge is left of paddle right edge
    ) {
      // Handle collision with local paddle
      this.handlePaddleCollision(localPaddle);

      // Notify about ball return (for effects)
      if (this.onBallOut) {
        this.onBallOut(ball, true);
      }

      return true;
    }

    // Check collision with remote paddle (top)
    if (
      ball.velocityY < 0 && // Ball is moving upward
      ball.y - ball.radius < remotePaddle.y + remotePaddle.height / 2 && // Ball top edge is above paddle bottom edge
      ball.y + ball.radius > remotePaddle.y - remotePaddle.height / 2 && // Ball bottom edge is below paddle top edge
      ball.x + ball.radius > remotePaddle.x - remotePaddle.width / 2 && // Ball right edge is right of paddle left edge
      ball.x - ball.radius < remotePaddle.x + remotePaddle.width / 2 // Ball left edge is left of paddle right edge
    ) {
      // Handle collision with remote paddle
      this.handlePaddleCollision(remotePaddle);

      // Notify about ball return (for effects)
      if (this.onBallOut) {
        this.onBallOut(ball, true);
      }

      return true;
    }

    // Check collision with side walls
    if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= settings.fieldWidth) {
      ball.velocityX = -ball.velocityX;

      // Play wall hit sound
      this.soundEffects.playWallHit();

      // If ball is outside the field, correct its position
      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
      } else if (ball.x + ball.radius > settings.fieldWidth) {
        ball.x = settings.fieldWidth - ball.radius;
      }
    }

    return false;
  }

  /**
   * Handle collision between ball and paddle
   * @param {Paddle} paddle - The paddle that was hit
   * @private
   */
  handlePaddleCollision(paddle) {
    const ball = this.gameState.ball;

    // Play paddle hit sound
    this.soundEffects.playPaddleHit();

    // Reverse ball Y direction
    ball.velocityY = -ball.velocityY;

    // Adjust angle based on where the ball hit the paddle
    // If ball hits the edge of the paddle, it will bounce at a steeper angle
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

    // Add a small random variation to the velocity for more dynamic gameplay
    const randomVariation = 0.1; // 10% variation
    ball.velocityX += (Math.random() * 2 - 1) * randomVariation * ball.speed;

    // Normalize the velocity vector to maintain consistent speed
    const currentSpeed = Math.sqrt(
      ball.velocityX * ball.velocityX + ball.velocityY * ball.velocityY
    );
    ball.velocityX = (ball.velocityX / currentSpeed) * ball.speed;
    ball.velocityY = (ball.velocityY / currentSpeed) * ball.speed;
  }

  /**
   * Handle ball going out of bounds
   * @private
   */
  handleBallOut() {
    const ball = this.gameState.ball;
    let pointWinner; // 'local' or 'remote'

    // Update score based on which side the ball went out (top or bottom)
    if (ball.y > settings.fieldHeight + ball.radius) {
      // Ball went out on local player's side (bottom) -> remote player scores
      this.gameState.remotePlayer.score += 1;
      pointWinner = 'remote';
    } else if (ball.y < -ball.radius) {
      // Ball went out on remote player's side (top) -> local player scores
      this.gameState.localPlayer.score += 1;
      pointWinner = 'local';
    } else {
      // Should not happen if called correctly from updateBall
      console.warn('handleBallOut called unexpectedly - ball not out of bounds?');
      return;
    }

    // Play score sound
    this.soundEffects.playScore();

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
      // Stop the ball visually until game restarts
      ball.velocityX = 0;
      ball.velocityY = 0;

      // Play game over sound
      this.soundEffects.playGameOver();

      if (this.onGameOver) {
        this.onGameOver(this.gameState.localPlayer.score > this.gameState.remotePlayer.score);
      }
    } else {
      // Reset ball for next round, serving towards the player who LOST the point
      const serveTowardsLocal = pointWinner === 'remote'; // If remote won point, serve towards local

      // After a point, the source of truth for the next serve is determined by the serve direction
      // If serving towards local (bottom), the remote player (top) is the source of truth
      // If serving towards remote (top), the local player (bottom) is the source of truth
      const isSourceForNextServe =
        (serveTowardsLocal && !this.isHost) || (!serveTowardsLocal && this.isHost);

      if (isSourceForNextServe) {
        this.initBallMovement(serveTowardsLocal);
      }
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
   * Determines if this player is the source of truth for the ball
   * based on the ball's direction of travel
   * @returns {boolean} Whether this player is the source of truth
   */
  isSourceOfTruth() {
    const ball = this.gameState.ball;

    // If ball is moving down (positive Y) and player is host, they are the source of truth
    if (ball.velocityY > 0 && this.isHost) {
      return true;
    }

    // If ball is moving up (positive Y) and player is guest, they are the source of truth
    if (ball.velocityY > 0 && !this.isHost) {
      return true;
    }

    // Otherwise, not the source of truth
    return false;
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
