import settings from '../settings.json';
import { createParticleEffect } from '../effects/particles.js';

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
    window.addEventListener('resize', () => this.resize());

    // Particle effects container
    this.particles = [];
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

    // Draw the ball
    this.drawBall(gameState.ball);

    // Draw particle effects
    this.updateAndDrawParticles();
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
    ctx.arc(x, y, ballSize, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;
  }

  /**
   * Create a particle effect at the specified position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} color - Particle color
   */
  createParticleEffect(x, y, color = '#00f3ff') {
    const particles = createParticleEffect({
      x: x * this.scaleX,
      y: y * this.scaleY,
      count: 20,
      color,
      speed: 5,
      lifetime: 1000,
    });

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
}
