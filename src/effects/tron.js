/**
 * @typedef {Object} GridOptions
 * @property {number} cellSize - Size of grid cells in pixels
 * @property {string} primaryColor - Primary grid color
 * @property {string} secondaryColor - Secondary grid color
 * @property {number} fadeDistance - Distance at which grid lines fade out
 * @property {number} pulseSpeed - Speed of the grid pulse effect
 */

/**
 * @typedef {Object} GlowOptions
 * @property {string} color - Base color for the glow
 * @property {number} intensity - Intensity of the glow (0-1)
 * @property {number} size - Size of the glow in pixels
 */

/**
 * @typedef {Object} LightTrailOptions
 * @property {number} maxLength - Maximum number of segments in the trail
 * @property {number} width - Width of the trail
 * @property {string} color - Color of the trail
 * @property {number} fadeRate - Rate at which the trail fades (0-1)
 */

/**
 * @typedef {Object} EnergyFieldOptions
 * @property {string} color - Color of the energy field
 * @property {number} intensity - Intensity of the field (0-1)
 * @property {number} frequency - Frequency of the field waves
 * @property {number} speed - Speed of the field animation
 */

/**
 * Creates a Tron-style grid effect
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {GridOptions} options - Grid options
 */
export function drawTronGrid(ctx, width, height, options) {
  const { cellSize = 50, fadeDistance = 500, pulseSpeed = 0.001 } = options;

  // Calculate the pulse effect (0-1)
  const pulse = Math.sin(performance.now() * pulseSpeed) * 0.5 + 0.5;

  // Draw horizontal lines
  for (let y = 0; y <= height; y += cellSize) {
    // Calculate distance from center for fade effect
    const distFromCenterY = Math.abs(y - height / 2);
    const fadeFactorY = Math.max(0, 1 - distFromCenterY / fadeDistance);

    // Apply pulse to opacity
    const opacityY = fadeFactorY * (0.3 + pulse * 0.2);

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);

    // Alternate between primary and secondary colors
    ctx.strokeStyle =
      y % (cellSize * 2) === 0
        ? `rgba(0, 243, 255, ${opacityY})`
        : `rgba(0, 243, 255, ${opacityY * 0.5})`;

    ctx.lineWidth = y % (cellSize * 2) === 0 ? 2 : 1;
    ctx.stroke();
  }

  // Draw vertical lines
  for (let x = 0; x <= width; x += cellSize) {
    // Calculate distance from center for fade effect
    const distFromCenterX = Math.abs(x - width / 2);
    const fadeFactorX = Math.max(0, 1 - distFromCenterX / fadeDistance);

    // Apply pulse to opacity
    const opacityX = fadeFactorX * (0.3 + pulse * 0.2);

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);

    // Alternate between primary and secondary colors
    ctx.strokeStyle =
      x % (cellSize * 2) === 0
        ? `rgba(0, 243, 255, ${opacityX})`
        : `rgba(0, 243, 255, ${opacityX * 0.5})`;

    ctx.lineWidth = x % (cellSize * 2) === 0 ? 2 : 1;
    ctx.stroke();
  }
}

/**
 * Creates a Tron-style energy field effect
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {EnergyFieldOptions} options - Energy field options
 */
export function drawEnergyField(ctx, width, height, options) {
  const { intensity = 0.5, frequency = 0.01, speed = 0.001 } = options;

  // Create a gradient for the energy field
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(0, 0, 30, 0.1)');
  gradient.addColorStop(0.5, `rgba(0, 243, 255, ${0.05 * intensity})`);
  gradient.addColorStop(1, 'rgba(0, 0, 30, 0.1)');

  // Fill the background with the gradient
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Draw energy waves
  const time = performance.now() * speed;
  const waveHeight = 2 * intensity;

  ctx.beginPath();

  // Draw multiple waves with different phases
  for (let i = 0; i < 3; i++) {
    const phase = (i * Math.PI) / 3;

    ctx.beginPath();

    // Draw a wave across the center of the field
    for (let x = 0; x < width; x += 5) {
      const y = height / 2 + Math.sin(x * frequency + time + phase) * waveHeight;

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    // Style and draw the wave
    ctx.strokeStyle = `rgba(0, 243, 255, ${0.3 * intensity})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/**
 * Creates a neon glow effect
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Function} drawFunction - Function that draws the shape to apply glow to
 * @param {GlowOptions} options - Glow options
 */
export function applyNeonGlow(ctx, drawFunction, options) {
  const { color = '#00f3ff', intensity = 1, size = 20 } = options;

  // Save the current context state
  ctx.save();

  // Set shadow properties for glow effect
  ctx.shadowColor = color;
  ctx.shadowBlur = size * intensity;

  // Draw the shape with glow
  drawFunction();

  // For stronger glow, draw multiple times
  if (intensity > 0.7) {
    drawFunction();
  }

  // Restore the context state
  ctx.restore();
}

/**
 * Creates a light trail effect
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array<{x: number, y: number}>} points - Array of points defining the trail
 * @param {LightTrailOptions} options - Light trail options
 */
export function drawLightTrail(ctx, points, options) {
  const { maxLength = 20, width = 10, color = '#00f3ff' } = options;

  if (points.length < 2) return;

  // Limit the number of points
  const trailPoints = points.slice(0, maxLength);

  // Draw the main trail
  ctx.beginPath();
  ctx.moveTo(trailPoints[0].x, trailPoints[0].y);

  for (let i = 1; i < trailPoints.length; i++) {
    ctx.lineTo(trailPoints[i].x, trailPoints[i].y);
  }

  // Create gradient along the trail
  const gradient = ctx.createLinearGradient(
    trailPoints[trailPoints.length - 1].x,
    trailPoints[trailPoints.length - 1].y,
    trailPoints[0].x,
    trailPoints[0].y
  );

  // Parse color to create gradient
  let r, g, b;
  if (color.startsWith('#')) {
    const hex = color.substring(1);
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else {
    // Default to cyan
    r = 0;
    g = 243;
    b = 255;
  }

  // Create gradient stops with fading
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

  // Style and draw the trail
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = gradient;

  // Apply glow effect
  ctx.shadowColor = color;
  ctx.shadowBlur = width * 2;

  ctx.stroke();
  ctx.shadowBlur = 0;

  // Draw a brighter core for the trail
  ctx.beginPath();
  ctx.moveTo(trailPoints[0].x, trailPoints[0].y);

  for (let i = 1; i < Math.min(5, trailPoints.length); i++) {
    ctx.lineTo(trailPoints[i].x, trailPoints[i].y);
  }

  ctx.lineWidth = width * 0.5;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
}

/**
 * Creates a hexagonal pattern background
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {Object} options - Hexagon options
 */
export function drawHexagonalBackground(ctx, width, height, options = {}) {
  const { size = 40, pulseSpeed = 0.0005 } = options;

  const pulse = Math.sin(performance.now() * pulseSpeed) * 0.5 + 0.5;
  const opacity = 0.05 + pulse * 0.1;

  // Calculate hex dimensions
  const hexHeight = size * 2;
  const hexWidth = Math.sqrt(3) * size;
  const verticalSpacing = hexHeight * 0.75;

  // Draw hexagons
  for (let row = -1; row < height / verticalSpacing + 1; row++) {
    const isOddRow = row % 2 === 1;
    const xOffset = isOddRow ? hexWidth / 2 : 0;

    for (let col = -1; col < width / hexWidth + 1; col++) {
      const x = col * hexWidth + xOffset;
      const y = row * verticalSpacing;

      // Calculate distance from center for fade effect
      const centerX = width / 2;
      const centerY = height / 2;
      const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
      const maxDistance = Math.sqrt(Math.pow(width / 2, 2) + Math.pow(height / 2, 2));
      const fadeOpacity = Math.max(0, 1 - distance / maxDistance) * opacity;

      // Draw hexagon
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 + Math.PI / 6;
        const hx = x + size * Math.cos(angle);
        const hy = y + size * Math.sin(angle);

        if (i === 0) {
          ctx.moveTo(hx, hy);
        } else {
          ctx.lineTo(hx, hy);
        }
      }
      ctx.closePath();

      // Style and draw
      ctx.strokeStyle = `rgba(0, 243, 255, ${fadeOpacity})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

/**
 * Creates a shockwave effect at a specific point
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X coordinate of the center
 * @param {number} y - Y coordinate of the center
 * @param {Object} options - Shockwave options
 * @returns {Object} Shockwave object to be updated
 */
export function createShockwave(x, y, options = {}) {
  const { color = '#00f3ff', maxRadius = 100, duration = 1000, thickness = 5 } = options;

  return {
    x,
    y,
    radius: 0,
    maxRadius,
    startTime: performance.now(),
    duration,
    color,
    thickness,
    active: true,

    update() {
      const elapsed = performance.now() - this.startTime;
      const progress = Math.min(1, elapsed / this.duration);

      this.radius = this.maxRadius * progress;
      this.opacity = 1 - progress;

      if (progress >= 1) {
        this.active = false;
      }

      return this.active;
    },

    draw(ctx) {
      if (!this.active) return;

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 243, 255, ${this.opacity})`;
      ctx.lineWidth = this.thickness * (1 - this.radius / this.maxRadius);
      ctx.stroke();

      // Inner glow
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 0.9, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${this.opacity * 0.5})`;
      ctx.lineWidth = this.thickness * 0.5 * (1 - this.radius / this.maxRadius);
      ctx.stroke();
    },
  };
}

// Collection to store active shockwaves
export const activeShockwaves = [];

/**
 * Updates and draws all active shockwaves
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 */
export function updateShockwaves(ctx) {
  // Update and draw each shockwave
  for (let i = activeShockwaves.length - 1; i >= 0; i--) {
    const shockwave = activeShockwaves[i];

    // Update the shockwave
    const isActive = shockwave.update();

    // Draw if still active
    if (isActive) {
      shockwave.draw(ctx);
    } else {
      // Remove inactive shockwaves
      activeShockwaves.splice(i, 1);
    }
  }
}
