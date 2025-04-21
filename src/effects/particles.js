/**
 * @typedef {Object} ParticleOptions
 * @property {number} x - X position to create particles
 * @property {number} y - Y position to create particles
 * @property {number} count - Number of particles to create
 * @property {string} color - Color of particles (CSS color string)
 * @property {number} speed - Base speed of particles
 * @property {number} lifetime - Lifetime of particles in milliseconds
 * @property {number} [minSize=1] - Minimum particle size
 * @property {number} [maxSize=4] - Maximum particle size
 */

/**
 * @typedef {Object} Particle
 * @property {number} x - X position
 * @property {number} y - Y position
 * @property {number} size - Particle size
 * @property {number} velocityX - X velocity
 * @property {number} velocityY - Y velocity
 * @property {number} createdAt - Timestamp when particle was created
 * @property {number} lifetime - Lifetime of particle in milliseconds
 * @property {Object} color - RGB color values
 * @property {number} color.r - Red component (0-255)
 * @property {number} color.g - Green component (0-255)
 * @property {number} color.b - Blue component (0-255)
 */

/**
 * Parse a CSS color string into RGB components
 * @param {string} colorStr - CSS color string
 * @returns {Object} RGB color object
 */
function parseColor(colorStr) {
  // Create a temporary element to parse the color
  const tempEl = document.createElement('div');
  tempEl.style.color = colorStr;
  document.body.appendChild(tempEl);

  // Get computed color
  const computedColor = window.getComputedStyle(tempEl).color;
  document.body.removeChild(tempEl);

  // Parse RGB values
  const match = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
    };
  }

  // Default to white if parsing fails
  return { r: 255, g: 255, b: 255 };
}

/**
 * Create a particle effect at the specified position
 * @param {ParticleOptions} options - Particle effect options
 * @returns {Particle[]} Array of created particles
 */
export function createParticleEffect(options) {
  const { x, y, count, color, speed, lifetime, minSize = 1, maxSize = 4 } = options;

  const particles = [];
  const rgbColor = parseColor(color);
  const now = performance.now();

  for (let i = 0; i < count; i++) {
    // Calculate random angle for particle movement
    const angle = Math.random() * Math.PI * 2;

    // Calculate random speed variation
    const speedVariation = 0.5 + Math.random();

    // Create particle
    particles.push({
      x,
      y,
      size: minSize + Math.random() * (maxSize - minSize),
      velocityX: Math.cos(angle) * speed * speedVariation,
      velocityY: Math.sin(angle) * speed * speedVariation,
      createdAt: now,
      lifetime: lifetime * (0.8 + Math.random() * 0.4), // Add some variation to lifetime
      color: rgbColor,
    });
  }

  return particles;
}

/**
 * Create a directional particle effect (e.g., for ball movement)
 * @param {ParticleOptions} options - Particle effect options
 * @param {number} directionX - X direction component
 * @param {number} directionY - Y direction component
 * @returns {Particle[]} Array of created particles
 */
export function createDirectionalParticleEffect(options, directionX, directionY) {
  const { x, y, count, color, speed, lifetime, minSize = 1, maxSize = 3 } = options;

  const particles = [];
  const rgbColor = parseColor(color);
  const now = performance.now();

  // Normalize direction vector
  const length = Math.sqrt(directionX * directionX + directionY * directionY);
  const normalizedDirX = directionX / length;
  const normalizedDirY = directionY / length;

  for (let i = 0; i < count; i++) {
    // Calculate angle with some variation around the main direction
    const angleVariation = ((Math.random() - 0.5) * Math.PI) / 2; // ±45 degrees
    const angle = Math.atan2(normalizedDirY, normalizedDirX) + angleVariation;

    // Calculate speed with variation
    const speedVariation = 0.3 + Math.random() * 0.7;

    // Create particle
    particles.push({
      x,
      y,
      size: minSize + Math.random() * (maxSize - minSize),
      velocityX: -Math.cos(angle) * speed * speedVariation, // Negative to go opposite to movement
      velocityY: -Math.sin(angle) * speed * speedVariation,
      createdAt: now,
      lifetime: lifetime * (0.7 + Math.random() * 0.6),
      color: rgbColor,
    });
  }

  return particles;
}
