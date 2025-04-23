/**
 * Updates ping display in the UI
 * @param {number} rtt - Round trip time in milliseconds
 */
export function updatePing(rtt) {
  const pingText = `Ping: ${rtt}ms`;

  const pingStatus = document.getElementById('ping-status');
  const gamePingStatus = document.getElementById('game-ping-status');

  if (pingStatus) {
    pingStatus.textContent = pingText;
  }

  if (gamePingStatus) {
    gamePingStatus.textContent = pingText;
  }

  if (!pingStatus && !gamePingStatus) {
    const gameScreen = document.getElementById('game-screen');
    if (gameScreen) {
      let fallbackPing = document.getElementById('fallback-ping-status');
      if (!fallbackPing) {
        fallbackPing = document.createElement('div');
        fallbackPing.id = 'fallback-ping-status';
        fallbackPing.className = 'status game-status';
        fallbackPing.style.position = 'absolute';
        fallbackPing.style.top = '10px';
        fallbackPing.style.right = '10px';
        fallbackPing.style.color = '#00f3ff';
        fallbackPing.style.zIndex = '1000';
        gameScreen.appendChild(fallbackPing);
      }
      fallbackPing.textContent = pingText;
    }
  }
}
