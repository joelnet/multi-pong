import settings from '../settings.json';

/**
 * @typedef {import('../types/index.js').GameState} GameState
 */

/**
 * Game renderer responsible for drawing the game
 */
export class GameRenderer {
  /**
   * Create a new GameRenderer instance
   * @param {HTMLCanvasElement} canvas - The canvas element to render on
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();

    // Set up resize listener
    window.addEventListener('resize', this.resize.bind(this));

    // Particle effects container
    this.particles = [];

    // Trail effect for the ball
    this.ballTrail = [];
    this.maxTrailLength = 10;

    // For debug visualization
    this.showDebugInfo = false;
  }

  /**
   * Resize the canvas to match the window size
   */
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // Calculate scale factor to maintain aspect ratio
    this.scaleX = this.canvas.width / settings.fieldWidth;
    this.scaleY = this.canvas.height / settings.fieldHeight;
  }

  /**
   * Clear the canvas
   * @private
   */
  clear() {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Render the game state
   * @param {GameState} gameState - The current game state
   */
  render(gameState) {
    this.clear();

    // Draw the game field
    this.drawField();

    // Draw the paddles
    this.drawPaddle(gameState.localPlayer.paddle, true);
    this.drawPaddle(gameState.remotePlayer.paddle, false);

    // Update ball trail
    this.updateBallTrail(gameState.ball);

    // Draw the ball trail
    this.drawBallTrail();

    // Draw the ball
    this.drawBall(gameState.ball);

    // Draw particle effects
    this.updateAndDrawParticles();

    // Draw debug info if enabled
    if (this.showDebugInfo) {
      this.drawDebugInfo(gameState);
    }
  }

  /**
   * Draw the game field
   * @private
   */
  drawField() {
    const ctx = this.ctx;

    // Draw the center line
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([15, 15]);
    ctx.beginPath();
    ctx.moveTo(0, this.canvas.height / 2);
    ctx.lineTo(this.canvas.width, this.canvas.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw the field boundaries with a glow effect
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.rect(0, 0, this.canvas.width, this.canvas.height);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /**
   * Draw a paddle
   * @param {import('../types/index.js').Paddle} paddle - The paddle to draw
   * @param {boolean} isLocal - Whether this is the local player's paddle
   * @private
   */
  drawPaddle(paddle, isLocal) {
    const ctx = this.ctx;

    // Calculate paddle position and size based on perspective
    let paddleWidth = paddle.width * this.scaleX;
    let paddleHeight = paddle.height * this.scaleY;

    // Apply perspective scaling for remote paddle
    if (!isLocal) {
      const perspectiveFactor = 0.5; // Remote paddle appears smaller
      paddleWidth *= perspectiveFactor;
      paddleHeight *= perspectiveFactor;
    }

    const x = paddle.x * this.scaleX - paddleWidth / 2;
    const y = paddle.y * this.scaleY - paddleHeight / 2;

    // Draw paddle with glow effect
    ctx.fillStyle = isLocal ? '#00f3ff' : '#ff00e6';
    ctx.shadowColor = isLocal ? '#00f3ff' : '#ff00e6';
    ctx.shadowBlur = 15;
    ctx.fillRect(x, y, paddleWidth, paddleHeight);

    // Draw paddle border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, paddleWidth, paddleHeight);

    // Reset shadow
    ctx.shadowBlur = 0;
  }

  /**
   * Update the ball trail
   * @param {import('../types/index.js').Ball} ball - The ball to update trail for
   * @private
   */
  updateBallTrail(ball) {
    // Add current position to trail
    this.ballTrail.unshift({
      x: ball.x * this.scaleX,
      y: ball.y * this.scaleY,
      z: ball.z,
      radius: ball.radius * this.scaleX * (1 - ball.z / settings.fieldDepth),
    });

    // Limit trail length
    if (this.ballTrail.length > this.maxTrailLength) {
      this.ballTrail.pop();
    }
  }

  /**
   * Draw the ball trail
   * @private
   */
  drawBallTrail() {
    const ctx = this.ctx;

    for (let i = 0; i < this.ballTrail.length; i++) {
      const trailPoint = this.ballTrail[i];
      const opacity = 1 - i / this.maxTrailLength;

      ctx.fillStyle = `rgba(0, 243, 255, ${opacity * 0.5})`;
      ctx.beginPath();
      ctx.arc(trailPoint.x, trailPoint.y, trailPoint.radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Draw the ball
   * @param {import('../types/index.js').Ball} ball - The ball to draw
   * @private
   */
  drawBall(ball) {
    const ctx = this.ctx;

    // Calculate ball position and size based on perspective
    const depthFactor = 1 - ball.z / settings.fieldDepth;
    const ballSize = ball.radius * 2 * this.scaleX * depthFactor;

    const x = ball.x * this.scaleX;
    const y = ball.y * this.scaleY;

    // Draw ball with glow effect
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(x, y, ballSize / 2, 0, Math.PI * 2);
    ctx.fill();

    // Add inner highlight
    ctx.fillStyle = '#00f3ff';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x, y, ballSize / 4, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;
  }

  /**
   * Draw debug information
   * @param {GameState} gameState - The current game state
   * @private
   */
  drawDebugInfo(gameState) {
    const ctx = this.ctx;
    const ball = gameState.ball;

    // Draw ball velocity vector
    const velocityScale = 10;
    const startX = ball.x * this.scaleX;
    const startY = ball.y * this.scaleY;
    const endX = startX + ball.velocityX * velocityScale;
    const endY = startY + ball.velocityY * velocityScale;

    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Draw ball z-position indicator
    const zText = `Z: ${ball.z.toFixed(1)}`;
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.fillText(zText, startX + 15, startY - 15);

    // Draw ball speed
    const speed = Math.sqrt(ball.velocityX ** 2 + ball.velocityY ** 2 + ball.velocityZ ** 2);
    const speedText = `Speed: ${speed.toFixed(1)}`;
    ctx.fillText(speedText, startX + 15, startY);
  }

  /**
   * Create a particle effect at the specified position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} color - Particle color
   */
  createParticleEffect(x, y, color = '#00f3ff') {
    const particleCount = 20;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      const size = 1 + Math.random() * 3;

      // Parse color to RGB
      let r, g, b;
      if (color.startsWith('#')) {
        const hex = color.substring(1);
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      } else {
        // Default to cyan if color parsing fails
        r = 0;
        g = 243;
        b = 255;
      }

      particles.push({
        x: x * this.scaleX,
        y: y * this.scaleY,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        size,
        color: { r, g, b },
        lifetime: 1000,
        createdAt: performance.now(),
      });
    }

    this.particles.push(...particles);
  }

  /**
   * Update and draw all active particles
   * @private
   */
  updateAndDrawParticles() {
    const ctx = this.ctx;
    const currentTime = performance.now();

    // Update and draw each particle
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];

      // Update particle position
      particle.x += particle.velocityX;
      particle.y += particle.velocityY;

      // Calculate opacity based on remaining lifetime
      const age = currentTime - particle.createdAt;
      const opacity = 1 - age / particle.lifetime;

      // Draw particle
      ctx.fillStyle = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${opacity})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();

      // Remove particle if its lifetime is over
      if (age >= particle.lifetime) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * Apply a screen shake effect
   * @param {number} intensity - Intensity of the shake
   * @param {number} duration - Duration of the shake in milliseconds
   */
  screenShake(intensity = 5, duration = 300) {
    const startTime = performance.now();
    const originalTransform = this.canvas.style.transform;

    const shake = () => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / duration;

      if (progress < 1) {
        const currentIntensity = intensity * (1 - progress);
        const dx = (Math.random() * 2 - 1) * currentIntensity;
        const dy = (Math.random() * 2 - 1) * currentIntensity;

        this.canvas.style.transform = `translate(${dx}px, ${dy}px)`;

        requestAnimationFrame(shake);
      } else {
        this.canvas.style.transform = originalTransform;
      }
    };

    requestAnimationFrame(shake);
  }

  /**
   * Toggle debug information display
   */
  toggleDebugInfo() {
    this.showDebugInfo = !this.showDebugInfo;
  }
}
