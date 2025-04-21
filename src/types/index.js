/**
 * @typedef {Object} GameSettings
 * @property {number} winScore - The score needed to win the game
 * @property {number} initialBallSpeed - The initial speed of the ball
 * @property {number} ballSpeedIncrement - How much the ball speed increases after each volley
 * @property {number} maxBallSpeed - The maximum speed the ball can reach
 */

/**
 * @typedef {Object} Ball
 * @property {number} x - X position of the ball
 * @property {number} y - Y position of the ball
 * @property {number} z - Z position of the ball (depth)
 * @property {number} radius - Radius of the ball
 * @property {number} velocityX - X velocity component
 * @property {number} velocityY - Y velocity component
 * @property {number} velocityZ - Z velocity component (toward/away from player)
 * @property {number} speed - Current speed of the ball
 */

/**
 * @typedef {Object} Paddle
 * @property {number} x - X position of the paddle
 * @property {number} y - Y position of the paddle
 * @property {number} width - Width of the paddle
 * @property {number} height - Height of the paddle
 * @property {number} depth - Depth position of the paddle (fixed)
 */

/**
 * @typedef {Object} Player
 * @property {Paddle} paddle - The player's paddle
 * @property {number} score - Current score
 * @property {boolean} isHost - Whether this player is the host
 */

/**
 * @typedef {Object} GameState
 * @property {Ball} ball - The game ball
 * @property {Player} localPlayer - The local player
 * @property {Player} remotePlayer - The remote player
 * @property {boolean} isPlaying - Whether the game is currently in progress
 * @property {boolean} isPaused - Whether the game is paused
 * @property {GameSettings} settings - Game settings
 */

/**
 * @typedef {Object} SwipeData
 * @property {number} startX - Starting X position of the swipe
 * @property {number} startY - Starting Y position of the swipe
 * @property {number} endX - Ending X position of the swipe
 * @property {number} endY - Ending Y position of the swipe
 * @property {number} duration - Duration of the swipe in milliseconds
 * @property {number} speed - Speed of the swipe
 * @property {number} angle - Angle of the swipe in radians
 */

/**
 * @typedef {Object} ConnectionData
 * @property {string} type - Type of connection data ('offer' or 'answer')
 * @property {Object} data - The WebRTC connection data
 */

/**
 * @typedef {Object} GameMessage
 * @property {string} type - Type of message ('ball', 'score', 'start', 'pause', 'resume', 'gameOver')
 * @property {Object} data - The message data
 */

export {};
