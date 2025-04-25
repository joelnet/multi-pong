/**
 * @fileoverview Sound effects generator using Web Audio API
 * Creates synthetic retro-style sound effects for pong/tron without requiring sound files
 */

/**
 * @typedef {Object} SoundEffectsAPI
 * @property {Function} playPaddleHit - Play paddle hit sound
 * @property {Function} playWallHit - Play wall hit sound
 * @property {Function} playScore - Play score sound
 * @property {Function} playGameStart - Play game start sound
 * @property {Function} playGameOver - Play game over sound
 */

/**
 * Creates and manages synthetic sound effects
 * @returns {SoundEffectsAPI} Sound effects API
 */
export const createSoundEffects = () => {
  // Create audio context
  const AudioContext = window.AudioContext;
  let audioContext = null;

  // Initialize audio context on first user interaction
  const initAudioContext = () => {
    if (!audioContext) {
      audioContext = new AudioContext();
    }
    return audioContext;
  };

  /**
   * Creates an oscillator for generating tones
   * @param {number} frequency - The frequency of the tone
   * @param {string} type - The type of oscillator (sine, square, sawtooth, triangle)
   * @param {number} duration - Duration of the sound in seconds
   * @param {number} [volume=0.5] - Volume of the sound (0-1)
   * @param {number} [fadeOutTime=0.1] - Time to fade out in seconds
   */
  const createTone = (frequency, type, duration, volume = 0.5, fadeOutTime = 0.1) => {
    const context = initAudioContext();

    // Create oscillator
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);

    // Create gain node for volume control
    const gainNode = context.createGain();
    gainNode.gain.setValueAtTime(volume, context.currentTime);

    // Add fade out
    gainNode.gain.exponentialRampToValueAtTime(
      0.001, // Close to zero but not zero (would cause error)
      context.currentTime + duration
    );

    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    // Start and stop
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  };

  /**
   * Creates a frequency sweep effect
   * @param {number} startFreq - Starting frequency
   * @param {number} endFreq - Ending frequency
   * @param {string} type - Oscillator type
   * @param {number} duration - Duration in seconds
   * @param {number} [volume=0.5] - Volume (0-1)
   */
  const createSweep = (startFreq, endFreq, type, duration, volume = 0.5) => {
    const context = initAudioContext();

    // Create oscillator
    const oscillator = context.createOscillator();
    oscillator.type = type;

    // Create gain node
    const gainNode = context.createGain();
    gainNode.gain.setValueAtTime(volume, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);

    // Set frequency sweep
    oscillator.frequency.setValueAtTime(startFreq, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFreq, context.currentTime + duration);

    // Connect and play
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  };

  /**
   * Creates a noise burst effect
   * @param {number} duration - Duration in seconds
   * @param {number} [volume=0.3] - Volume (0-1)
   */
  const createNoise = (duration, volume = 0.3) => {
    const context = initAudioContext();

    // Create buffer for noise
    const bufferSize = context.sampleRate * duration;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);

    // Fill buffer with random values (white noise)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // Create source from buffer
    const noise = context.createBufferSource();
    noise.buffer = buffer;

    // Create gain node
    const gainNode = context.createGain();
    gainNode.gain.setValueAtTime(volume, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);

    // Connect and play
    noise.connect(gainNode);
    gainNode.connect(context.destination);

    noise.start();
    noise.stop(context.currentTime + duration);
  };

  // Sound effect implementations

  /**
   * Play paddle hit sound - a short mid-frequency blip
   */
  const playPaddleHit = () => {
    createTone(220, 'square', 0.08, 0.4);
  };

  /**
   * Play wall hit sound - a short high-frequency blip
   */
  const playWallHit = () => {
    createTone(440, 'square', 0.05, 0.3);
  };

  /**
   * Play score sound - an upward sweep
   */
  const playScore = () => {
    createSweep(220, 880, 'sawtooth', 0.3, 0.5);
  };

  /**
   * Play game start sound - a sequence of tones
   */
  const playGameStart = () => {
    const context = initAudioContext();
    const now = context.currentTime;

    // Play a sequence of tones with slight delay
    setTimeout(() => createTone(220, 'square', 0.1, 0.4), 0);
    setTimeout(() => createTone(330, 'square', 0.1, 0.4), 150);
    setTimeout(() => createTone(440, 'square', 0.1, 0.4), 300);
    setTimeout(() => createTone(880, 'square', 0.2, 0.5), 450);
  };

  /**
   * Play game over sound - a downward sweep with noise
   */
  const playGameOver = () => {
    createSweep(880, 110, 'sawtooth', 0.5, 0.5);
    setTimeout(() => createNoise(0.3, 0.2), 300);
  };

  return {
    playPaddleHit,
    playWallHit,
    playScore,
    playGameStart,
    playGameOver,
  };
};

export default createSoundEffects;
