import { Peer } from '../lib/peer.js';
import QRCode from 'qrcode';

const errorCorrectionLevel = 'L';

/**
 * @typedef {import('../types/index.js').ConnectionData} ConnectionData
 * @typedef {import('../types/index.js').GameMessage} GameMessage
 */

/**
 * Manages WebRTC connections between players
 */
export class Connection {
  /**
   * Create a new Connection instance
   * @param {Object} options - Connection options
   * @param {boolean} options.isHost - Whether this client is the host
   * @param {Function} options.onConnected - Callback when connection is established
   * @param {Function} options.onMessage - Callback when message is received
   * @param {Function} options.onDisconnected - Callback when connection is lost
   */
  constructor({ isHost, onConnected, onMessage, onDisconnected }) {
    this.peer = null;
    this.isHost = isHost;
    this.onConnected = onConnected;
    this.onMessage = onMessage;
    this.onDisconnected = onDisconnected;
    this.isConnected = false;
    this._offerSent = false;
    this._answerSent = false;
    this._connectionState = 'new'; // new, connecting, connected, disconnected
    this._connectionAttemptTimeout = null;
  }

  /**
   * Initialize the connection as host
   * @returns {Promise<string>} The offer data to share with the guest
   */
  async initAsHost() {
    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer({ initiator: true });

        // Store collected ICE candidates
        const iceCandidates = [];
        let offerData = null;

        this.peer.on('signal', async data => {
          if (data.type === 'offer') {
            // Store the offer to combine with ICE candidates later
            offerData = data;
          } else if (data.type === 'candidate') {
            // Store ICE candidates
            iceCandidates.push(data.candidate);
          }

          // If we have an offer and at least some ICE candidates, or gathering is taking too long,
          // send the combined data
          if (offerData && (iceCandidates.length > 0 || this._isTimeToSendOffer())) {
            const completeOfferData = {
              type: 'offer',
              sdp: offerData.sdp,
              iceCandidates: iceCandidates,
            };

            resolve(JSON.stringify(completeOfferData));
          }
        });

        this.setupPeerEvents();

        // Set a timeout to send whatever we have if ICE gathering is slow
        this._offerTimeout = setTimeout(() => {
          if (offerData && !this._offerSent) {
            const completeOfferData = {
              type: 'offer',
              sdp: offerData.sdp,
              iceCandidates: iceCandidates,
            };
            this._offerSent = true;
            resolve(JSON.stringify(completeOfferData));
          }
        }, 5000); // 5 second timeout
      } catch (error) {
        console.error('Error initializing as host:', error);
        reject(error);
      }
    });
  }

  // Helper to determine if it's time to send the offer
  _isTimeToSendOffer() {
    // This is called for each ICE candidate, so we'll just check if we've collected enough
    // or if the gathering state indicates we're done
    return this._offerSent || false;
  }

  /**
   * Initialize the connection as guest
   * @param {string} offerData - The offer data from the host
   * @returns {Promise<string>} The answer data to share with the host
   */
  async initAsGuest(offerData) {
    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer();

        // Store collected ICE candidates
        const iceCandidates = [];
        let answerData = null;

        this.peer.on('signal', async data => {
          if (data.type === 'answer') {
            // Store the answer to combine with ICE candidates later
            answerData = data;
          } else if (data.type === 'candidate') {
            // Store ICE candidates
            iceCandidates.push(data.candidate);
          }

          // If we have an answer and at least some ICE candidates, or gathering is taking too long,
          // send the combined data
          if (answerData && (iceCandidates.length > 0 || this._isTimeToSendAnswer())) {
            const completeAnswerData = {
              type: 'answer',
              sdp: answerData.sdp,
              iceCandidates: iceCandidates,
            };

            resolve(JSON.stringify(completeAnswerData));
          }
        });

        this.setupPeerEvents();

        // Set a timeout to send whatever we have if ICE gathering is slow
        this._answerTimeout = setTimeout(() => {
          if (answerData && !this._answerSent) {
            const completeAnswerData = {
              type: 'answer',
              sdp: answerData.sdp,
              iceCandidates: iceCandidates,
            };
            this._answerSent = true;
            resolve(JSON.stringify(completeAnswerData));
          }
        }, 5000); // 5 second timeout

        // Process the offer data
        try {
          let offer;

          try {
            // First try to parse as JSON
            const parsedOffer = JSON.parse(offerData);
            offer = parsedOffer;

            // Process any ICE candidates that came with the offer
            if (offer.iceCandidates && Array.isArray(offer.iceCandidates)) {
              // We'll process the offer first, then add the candidates
              setTimeout(() => {
                offer.iceCandidates.forEach(candidate => {
                  this.peer.signal({ type: 'candidate', candidate });
                });
              }, 500); // Short delay to ensure offer is processed first
            }

            // Remove ICE candidates from the offer before signaling
            const signalOffer = { type: 'offer', sdp: offer.sdp };
            this.peer.signal(signalOffer);
          } catch (parseError) {
            console.error(parseError);
            // If parsing fails, it might be just the SDP string
            offer = {
              type: 'offer',
              sdp: offerData,
            };
            console.log('Signaling offer to peer:', offer);
            this.peer.signal(offer);
          }
        } catch (error) {
          console.error('Error processing offer data:', error);
          reject(new Error('Error processing offer. Please try again.'));
        }
      } catch (error) {
        console.error('Error initializing as guest:', error);
        reject(error);
      }
    });
  }

  // Helper to determine if it's time to send the answer
  _isTimeToSendAnswer() {
    // This is called for each ICE candidate, so we'll just check if we've collected enough
    // or if the gathering state indicates we're done
    return this._answerSent || false;
  }

  /**
   * Process the answer from the guest (host side)
   * @param {string} answerData - The answer data from the guest
   */
  async processAnswer(answerData) {
    try {
      let answer;

      try {
        // First try to parse as JSON (for backward compatibility)
        answer = JSON.parse(answerData);

        // Process any ICE candidates that came with the answer
        if (answer.iceCandidates && Array.isArray(answer.iceCandidates)) {
          // We'll process the answer first, then add the candidates
          setTimeout(() => {
            answer.iceCandidates.forEach(candidate => {
              this.peer.signal({ type: 'candidate', candidate });
            });
          }, 500); // Short delay to ensure answer is processed first
        }

        // Remove ICE candidates from the answer before signaling
        const signalAnswer = { type: 'answer', sdp: answer.sdp };
        this.peer.signal(signalAnswer);
      } catch (parseError) {
        console.error(parseError);
        // If not valid JSON, assume it's just the SDP string
        answer = {
          type: 'answer',
          sdp: answerData,
        };
        this.peer.signal(answer);
      }
    } catch (error) {
      console.error('Error processing answer:', error);
      throw new Error('Error processing answer. Please try again.');
    }
  }

  /**
   * Set up the peer connection events
   * @private
   */
  setupPeerEvents() {
    // Set connection state to connecting
    this._connectionState = 'connecting';

    // Set a timeout to prevent indefinite "connecting" state
    this._connectionAttemptTimeout = setTimeout(() => {
      // Only trigger disconnect if we're still in connecting state after timeout
      if (this._connectionState === 'connecting') {
        console.log('Connection attempt timed out after 30 seconds');
        this._connectionState = 'disconnected';

        // Only trigger disconnect callback if we were previously connected
        if (this.isConnected) {
          if (this.onDisconnected) {
            this.onDisconnected();
          }
        } else {
          // For initial connection attempts, we'll handle this differently
          console.log(
            'Connection attempt failed, but not triggering disconnect callback for initial connection'
          );
        }
      }
    }, 30000); // 30 second timeout

    this.peer.on('connect', () => {
      console.log('Peer connection established');

      // Clear the connection attempt timeout
      if (this._connectionAttemptTimeout) {
        clearTimeout(this._connectionAttemptTimeout);
        this._connectionAttemptTimeout = null;
      }

      this.isConnected = true;
      this._connectionState = 'connected';

      // If this is the host, send a ping message when connected
      if (this.isHost) {
        this.sendMessage({
          type: 'ping',
          data: {
            timestamp: Date.now(),
          },
        });
        console.log('Host sent ping message');
      }

      if (this.onConnected) {
        this.onConnected();
      }
    });

    this.peer.on('data', data => {
      console.log('Received data from peer', data);
      if (this.onMessage) {
        try {
          const message = JSON.parse(data);

          // Handle ping-pong messages
          if (message.type === 'ping' && !this.isHost) {
            // Guest responds to ping with a pong
            this.sendMessage({
              type: 'pong',
              data: {
                timestamp: Date.now(),
                pingTimestamp: message.data.timestamp,
              },
            });
            console.log('Guest responded with pong message');
          }

          this.onMessage(message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      }
    });

    this.peer.on('close', () => {
      console.log('Peer connection closed');

      // Only trigger disconnect if we were previously connected
      if (this._connectionState === 'connected') {
        this.isConnected = false;
        this._connectionState = 'disconnected';

        if (this.onDisconnected) {
          this.onDisconnected();
        }
      } else {
        console.log('Connection closed during setup, not triggering disconnect callback');
      }
    });

    this.peer.on('error', error => {
      console.error('Peer connection error:', error);

      // Only trigger disconnect if we were previously connected or if this is a critical error
      if (this._connectionState === 'connected' || this._isCriticalError(error)) {
        this.isConnected = false;
        this._connectionState = 'disconnected';

        if (this.onDisconnected) {
          this.onDisconnected();
        }
      } else {
        console.log(
          'Non-critical error during connection setup, not triggering disconnect callback'
        );
      }
    });
  }

  /**
   * Check if an error is critical and should abort the connection
   * @param {Error} error - The error to check
   * @returns {boolean} Whether the error is critical
   * @private
   */
  _isCriticalError(error) {
    // Consider certain errors as critical based on their message
    if (error && error.message) {
      const criticalPatterns = [
        'failed to set remote answer',
        'cannot establish connection',
        'ICE failed',
        'connection timeout',
      ];

      return criticalPatterns.some(pattern =>
        error.message.toLowerCase().includes(pattern.toLowerCase())
      );
    }

    return false;
  }

  /**
   * Send a message to the connected peer
   * @param {GameMessage} message - The message to send
   * @returns {boolean} Whether the message was sent successfully
   */
  sendMessage(message) {
    if (!this.isConnected || !this.peer) {
      return false;
    }

    try {
      const data = JSON.stringify(message);
      this.peer.send(data);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  /**
   * Generate a QR code from data
   * @param {string|Uint8Array<ArrayBufferLike>} data - The data to encode in the QR code
   * @param {HTMLElement} container - The container element to render the QR code in
   * @returns {Promise<void>}
   */
  static async generateQRCode(data, container) {
    try {
      // Clear the container
      container.innerHTML = '';

      // Create a canvas element
      const canvas = document.createElement('canvas');

      // Set explicit size constraints
      canvas.style.maxWidth = '100%';
      canvas.style.height = 'auto';

      // Add the canvas to the container
      container.appendChild(canvas);

      let canvasData = data;

      if (typeof data === 'object') {
        canvasData = [{ data, mode: 'byte' }];
      }

      // Generate QR code on the canvas with better options
      await QRCode.toCanvas(canvas, canvasData, {
        width: 300,
        margin: 1,
        errorCorrectionLevel,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
    } catch (error) {
      console.error('Error generating QR code:', error);

      // Show error message in container
      container.innerHTML = '<p style="color: red;">Error generating QR code</p>';
    }
  }

  /**
   * Disconnect from the peer
   */
  disconnect() {
    // Clear any pending timeouts
    if (this._connectionAttemptTimeout) {
      clearTimeout(this._connectionAttemptTimeout);
      this._connectionAttemptTimeout = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
      this.isConnected = false;
      this._connectionState = 'disconnected';
    }
  }
}
