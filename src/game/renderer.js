import settings from '../settings.json';
import {
  drawTronGrid,
  drawEnergyField,
  applyNeonGlow,
  drawLightTrail,
  drawHexagonalBackground,
  createShockwave,
  activeShockwaves,
  updateShockwaves,
} from '../effects/tron.js';

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
    this.maxTrailLength = 20; // Increased from 10 for longer trails

    // For debug visualization
    this.showDebugInfo = false;

    // For paddle trails
    this.localPaddleTrail = [];
    this.remotePaddleTrail = [];
    this.maxPaddleTrailLength = 10;

    // For screen shake effect
    this.shakeOffset = { x: 0, y: 0 };
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeStartTime = 0;

    // Background effects
    this.backgroundEffects = {
      grid: true,
      hexagons: true,
      energyField: true,
    };
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
    // Create a dark gradient background instead of solid black
    const gradient = this.ctx.createRadialGradient(
      this.canvas.width / 2,
      this.canvas.height / 2,
      0,
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.canvas.width * 0.7
    );

    gradient.addColorStop(0, '#001a2c');
    gradient.addColorStop(1, '#000510');

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw background effects
    if (this.backgroundEffects.hexagons) {
      drawHexagonalBackground(this.ctx, this.canvas.width, this.canvas.height);
    }

    if (this.backgroundEffects.grid) {
      drawTronGrid(this.ctx, this.canvas.width, this.canvas.height, {
        cellSize: 80,
        fadeDistance: Math.max(this.canvas.width, this.canvas.height) * 0.6,
      });
    }

    if (this.backgroundEffects.energyField) {
      drawEnergyField(this.ctx, this.canvas.width, this.canvas.height, {
        intensity: 0.4,
        frequency: 0.005,
      });
    }
  }

  /**
   * Render the game state
   * @param {GameState} gameState - The current game state
   */
  render(gameState) {
    this.clear();

    // Apply screen shake if active
    if (this.shakeIntensity > 0) {
      this.shake();
    }

    // Draw the game field
    this.drawField();

    // Update paddle trails
    this.updatePaddleTrail(gameState.localPlayer.paddle, true);
    this.updatePaddleTrail(gameState.remotePlayer.paddle, false);

    // Draw paddle trails
    this.drawPaddleTrails();

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

    // Draw shockwaves
    updateShockwaves(this.ctx);

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

    // Draw the center line with a more pronounced glow
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.7)';
    ctx.lineWidth = 4;
    ctx.setLineDash([15, 15]);

    // Apply neon glow to center line
    applyNeonGlow(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(0, this.canvas.height / 2);
        ctx.lineTo(this.canvas.width, this.canvas.height / 2);
        ctx.stroke();
      },
      { color: '#00f3ff', intensity: 0.8, size: 15 }
    );

    ctx.setLineDash([]);

    // Draw the field boundaries with a stronger glow effect
    applyNeonGlow(
      ctx,
      () => {
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.rect(0, 0, this.canvas.width, this.canvas.height);
        ctx.stroke();
      },
      { color: '#00f3ff', intensity: 1, size: 20 }
    );

    // Add corner accents for a more Tron-like look
    const cornerSize = 40;
    const corners = [
      { x: 0, y: 0 }, // Top-left
      { x: this.canvas.width, y: 0 }, // Top-right
      { x: 0, y: this.canvas.height }, // Bottom-left
      { x: this.canvas.width, y: this.canvas.height }, // Bottom-right
    ];

    corners.forEach(corner => {
      const isLeft = corner.x === 0;
      const isTop = corner.y === 0;

      applyNeonGlow(
        ctx,
        () => {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 4;
          ctx.beginPath();

          if (isLeft) {
            ctx.moveTo(corner.x, corner.y + (isTop ? 0 : -cornerSize));
            ctx.lineTo(corner.x, corner.y);
            ctx.lineTo(corner.x + cornerSize, corner.y);
          } else {
            ctx.moveTo(corner.x, corner.y + (isTop ? 0 : -cornerSize));
            ctx.lineTo(corner.x, corner.y);
            ctx.lineTo(corner.x - cornerSize, corner.y);
          }

          ctx.stroke();
        },
        { color: '#00f3ff', intensity: 1, size: 15 }
      );
    });
  }

  /**
   * Draw a paddle
   * @param {import('../types/index.js').Paddle} paddle - The paddle to draw
   * @param {boolean} isLocal - Whether this is the local player's paddle
   * @private
   */
  drawPaddle(paddle, isLocal) {
    const ctx = this.ctx;

    // Calculate screen coordinates
    const paddleWidth = paddle.width * this.scaleX;
    const paddleHeight = paddle.height * this.scaleY;
    const x = paddle.x * this.scaleX - paddleWidth / 2;
    const y = paddle.y * this.scaleY - paddleHeight / 2;

    // Define paddle color based on player
    const paddleColor = isLocal ? '#00f3ff' : '#ff00e6'; // Local=cyan, Remote=magenta

    // Draw paddle with enhanced glow effect
    applyNeonGlow(
      ctx,
      () => {
        // Draw paddle body
        ctx.fillStyle = paddleColor;
        ctx.fillRect(x, y, paddleWidth, paddleHeight);

        // Draw paddle border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, paddleWidth, paddleHeight);

        // Add inner highlight for depth
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 3, y + 3, paddleWidth - 6, paddleHeight - 6);

        // Add accent lines for Tron aesthetic
        ctx.beginPath();
        ctx.moveTo(x + paddleWidth * 0.2, y);
        ctx.lineTo(x + paddleWidth * 0.2, y + paddleHeight);
        ctx.moveTo(x + paddleWidth * 0.8, y);
        ctx.lineTo(x + paddleWidth * 0.8, y + paddleHeight);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      },
      {
        color: paddleColor,
        intensity: 0.9,
        size: 20,
      }
    );
  }

  /**
   * Update the paddle trail
   * @param {import('../types/index.js').Paddle} paddle - The paddle to update trail for
   * @param {boolean} isLocal - Whether this is the local player's paddle
   * @private
   */
  updatePaddleTrail(paddle, isLocal) {
    const trailArray = isLocal ? this.localPaddleTrail : this.remotePaddleTrail;

    // Only add to trail if paddle has moved
    if (trailArray.length === 0 || trailArray[0].x !== paddle.x * this.scaleX) {
      // Add current position to trail
      trailArray.unshift({
        x: paddle.x * this.scaleX,
        y: paddle.y * this.scaleY,
      });

      // Limit trail length
      if (trailArray.length > this.maxPaddleTrailLength) {
        trailArray.pop();
      }
    }
  }

  /**
   * Draw paddle trails
   * @private
   */
  drawPaddleTrails() {
    // Draw local paddle trail
    if (this.localPaddleTrail.length > 1) {
      drawLightTrail(this.ctx, this.localPaddleTrail, {
        maxLength: this.maxPaddleTrailLength,
        width: 5,
        color: '#00f3ff',
        fadeRate: 0.9,
      });
    }

    // Draw remote paddle trail
    if (this.remotePaddleTrail.length > 1) {
      drawLightTrail(this.ctx, this.remotePaddleTrail, {
        maxLength: this.maxPaddleTrailLength,
        width: 5,
        color: '#ff00e6',
        fadeRate: 0.9,
      });
    }
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
      velocityX: ball.velocityX,
      velocityY: ball.velocityY,
      speed: Math.sqrt(ball.velocityX * ball.velocityX + ball.velocityY * ball.velocityY),
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
    if (this.ballTrail.length < 2) return;

    // Draw the trail using the light trail effect
    drawLightTrail(this.ctx, this.ballTrail, {
      maxLength: this.maxTrailLength,
      width: 8,
      color: '#ffffff',
      fadeRate: 0.95,
    });

    // Add a secondary trail with different color for effect
    const secondaryColor = this.ballTrail[0].velocityY > 0 ? '#00f3ff' : '#ff00e6';
    drawLightTrail(this.ctx, this.ballTrail, {
      maxLength: Math.floor(this.maxTrailLength / 2),
      width: 4,
      color: secondaryColor,
      fadeRate: 0.8,
    });
  }

  /**
   * Draw the ball
   * @param {import('../types/index.js').Ball} ball - The ball to draw
   * @private
   */
  drawBall(ball) {
    const ctx = this.ctx;
    const ballRadius = ball.radius * this.scaleX;
    const x = ball.x * this.scaleX;
    const y = ball.y * this.scaleY;

    // Create a pulsing effect for the ball
    const pulseSpeed = 0.005;
    const pulseAmount = 0.2;
    const pulse = Math.sin(performance.now() * pulseSpeed) * pulseAmount + 1;

    // Draw the ball with enhanced glow
    applyNeonGlow(
      ctx,
      () => {
        // Create a radial gradient for the ball
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, ballRadius * pulse);

        // Determine color based on direction (up=cyan, down=magenta)
        const primaryColor = ball.velocityY > 0 ? '#00f3ff' : '#ff00e6';
        const secondaryColor = ball.velocityY > 0 ? '#00a0ff' : '#ff00a0';

        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, primaryColor);
        gradient.addColorStop(1, secondaryColor);

        // Draw the main ball
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, ballRadius * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Add a white core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, ballRadius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Add ring accent
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, ballRadius * 0.7 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      },
      {
        color: ball.velocityY > 0 ? '#00f3ff' : '#ff00e6',
        intensity: 1,
        size: 25,
      }
    );

    // Draw velocity vector for debug mode
    if (this.showDebugInfo) {
      const velocityScale = 5;
      const startX = ball.x * this.scaleX;
      const startY = ball.y * this.scaleY;
      const endX = startX + ball.velocityX * velocityScale;
      const endY = startY + ball.velocityY * velocityScale;

      ctx.strokeStyle = '#ff0000'; // Red velocity vector
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Draw ball speed (2D)
      const speed = Math.sqrt(ball.velocityX ** 2 + ball.velocityY ** 2);
      const speedText = `Speed: ${speed.toFixed(1)}`;
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Arial';
      ctx.fillText(speedText, startX + ballRadius * this.scaleX + 5, startY);

      // Draw ball position
      const posText = `Pos: ${ball.x.toFixed(0)}, ${ball.y.toFixed(0)}`;
      ctx.fillText(posText, startX + ballRadius * this.scaleX + 5, startY + 12);
    }
  }

  /**
   * Create a particle effect at the specified position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} color - Particle color
   */
  createParticleEffect(x, y, color = '#00f3ff') {
    const particleCount = 30; // Increased from 20
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 5; // Increased speed
      const size = 1 + Math.random() * 4; // Increased size

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
        lifetime: 1500, // Increased from 1000
        createdAt: performance.now(),
        // Add rotation for more dynamic particles
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        // Add shape variation
        shape: Math.random() > 0.7 ? 'square' : 'circle',
      });
    }

    this.particles.push(...particles);

    // Create a shockwave effect at collision point
    activeShockwaves.push(
      createShockwave(x * this.scaleX, y * this.scaleY, {
        maxRadius: 80,
        duration: 800,
        color: color,
      })
    );
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

      // Update rotation if applicable
      if (particle.rotation !== undefined) {
        particle.rotation += particle.rotationSpeed;
      }

      // Calculate opacity based on remaining lifetime
      const age = currentTime - particle.createdAt;
      const opacity = 1 - age / particle.lifetime;

      // Draw particle with glow effect
      ctx.save();
      ctx.shadowColor = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${opacity})`;
      ctx.shadowBlur = particle.size * 2;
      ctx.fillStyle = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${opacity})`;

      if (particle.shape === 'square') {
        // Draw rotated square
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
        ctx.translate(-particle.x, -particle.y);
      } else {
        // Draw circle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

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
  screenShake(intensity = 8, duration = 400) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeStartTime = performance.now();
  }

  /**
   * Apply the shake effect to the canvas
   * @private
   */
  shake() {
    const elapsed = performance.now() - this.shakeStartTime;
    const progress = Math.min(1, elapsed / this.shakeDuration);

    if (progress < 1) {
      // Calculate decreasing intensity
      const currentIntensity = this.shakeIntensity * (1 - progress);

      // Calculate random offset
      this.shakeOffset = {
        x: (Math.random() * 2 - 1) * currentIntensity,
        y: (Math.random() * 2 - 1) * currentIntensity,
      };

      // Apply transform to canvas
      this.ctx.save();
      this.ctx.translate(this.shakeOffset.x, this.shakeOffset.y);
    } else {
      // Reset shake effect
      this.shakeIntensity = 0;
      this.shakeOffset = { x: 0, y: 0 };
    }
  }

  /**
   * Toggle debug information display
   */
  toggleDebugInfo() {
    this.showDebugInfo = !this.showDebugInfo;
  }
}
