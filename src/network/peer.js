/**
 * A simple WebRTC peer connection wrapper
 */
import settings from '../settings.json';

/**
 * @typedef {Object} PeerOptions
 * @property {boolean} [initiator=false] - Whether this peer is the initiator of the connection
 * @property {Object} [config] - RTCPeerConnection configuration
 */

/**
 * @typedef {Error} PeerError
 * @property {any} [originalEvent] - The original event that caused the error
 */
/**
 * Create a new Peer instance
 * @param {PeerOptions} options - Peer options
 */
export class Peer {
  /**
   * Create a new Peer instance
   * @param {PeerOptions} options - Peer options
   */
  constructor(options = {}) {
    this.initiator = options.initiator || false;
    this.config = options.config || {
      iceServers: settings.webrtc.iceServers,
      iceCandidatePoolSize: settings.webrtc.iceCandidatePoolSize,
    };

    this.peerConnection = null;
    this.dataChannel = null;
    this.connected = false;
    this.destroyed = false;

    // Event callbacks
    this.onSignalCallback = null;
    this.onConnectCallback = null;
    this.onDataCallback = null;
    this.onCloseCallback = null;
    this.onErrorCallback = null;

    this._init();
  }

  /**
   * Initialize the peer connection
   * @private
   */
  _init() {
    try {
      this.peerConnection = new RTCPeerConnection(this.config);
      console.log('RTCPeerConnection created with config:', JSON.stringify(this.config));

      // Log connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        if (this.peerConnection.connectionState === 'connected') {
          console.log('WebRTC connection state is connected');
          this._checkDataChannelState();
        }
      };

      // Log signaling state changes
      this.peerConnection.onsignalingstatechange = () => {
        console.log('Signaling state changed to:', this.peerConnection.signalingState);
      };

      // Set up ICE candidate handling
      this.peerConnection.onicecandidate = event => {
        if (event.candidate && this.onSignalCallback) {
          this.onSignalCallback({ type: 'candidate', candidate: event.candidate });
        }
      };

      // Handle ICE connection state changes
      this.peerConnection.oniceconnectionstatechange = () => {
        if (
          this.peerConnection.iceConnectionState === 'connected' ||
          this.peerConnection.iceConnectionState === 'completed'
        ) {
          // The ICE connection is established, check if data channel is open
          this._checkDataChannelState();
        } else if (
          this.peerConnection.iceConnectionState === 'disconnected' ||
          this.peerConnection.iceConnectionState === 'failed'
        ) {
          this._handleDisconnect();
        }
      };

      // If we're the initiator, create the data channel
      if (this.initiator) {
        this.dataChannel = this.peerConnection.createDataChannel('data');
        this._setupDataChannel();

        // Create and send the offer
        this._createOffer();
      } else {
        // If we're not the initiator, set up to receive the data channel
        this.peerConnection.ondatachannel = event => {
          console.log('Data channel received from remote peer');
          this.dataChannel = event.channel;
          this._setupDataChannel();
        };
      }
    } catch (error) {
      this._handleError(error);
    }
  }

  /**
   * Check the data channel state and trigger connect if open
   * @private
   */
  _checkDataChannelState() {
    if (this.dataChannel && this.dataChannel.readyState === 'open' && !this.connected) {
      console.log('Data channel is now open');
      this.connected = true;
      if (this.onConnectCallback) {
        this.onConnectCallback();
      }
    } else if (this.dataChannel) {
      console.log('Data channel state:', this.dataChannel.readyState);
    }
  }

  /**
   * Set up the data channel event handlers
   * @private
   */
  _setupDataChannel() {
    if (!this.dataChannel) return;

    console.log('Setting up data channel, current state:', this.dataChannel.readyState);

    this.dataChannel.onopen = () => {
      console.log('Data channel opened');
      this.connected = true;
      if (this.onConnectCallback) {
        this.onConnectCallback();
      }
    };

    this.dataChannel.onmessage = event => {
      if (this.onDataCallback) {
        this.onDataCallback(event.data);
      }
    };

    this.dataChannel.onerror = error => {
      console.error('Data channel error:', error);
      // Create a proper Error object
      const errorObj = new Error('Data channel error');
      // @ts-ignore - Adding custom property to Error
      errorObj.originalEvent = error;
      this._handleError(errorObj);
    };

    this.dataChannel.onclose = () => {
      console.log('Data channel closed');
      this._handleDisconnect();
    };

    // If the data channel is already open, trigger the connect event
    if (this.dataChannel.readyState === 'open' && !this.connected) {
      console.log('Data channel was already open');
      this.connected = true;
      if (this.onConnectCallback) {
        this.onConnectCallback();
      }
    }
  }

  /**
   * Create and send an offer
   * @private
   */
  async _createOffer() {
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      if (this.onSignalCallback) {
        // Send the offer with the correct structure
        this.onSignalCallback({
          type: 'offer',
          sdp: offer.sdp,
        });
      }
    } catch (error) {
      this._handleError(error);
    }
  }

  /**
   * Create and send an answer
   * @private
   */
  async _createAnswer() {
    try {
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      if (this.onSignalCallback) {
        // Send the answer with the correct structure
        this.onSignalCallback({
          type: 'answer',
          sdp: answer.sdp,
        });
      }
    } catch (error) {
      this._handleError(error);
    }
  }

  /**
   * Handle disconnection
   * @private
   */
  _handleDisconnect() {
    if (this.destroyed) return;

    this.connected = false;
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  /**
   * Handle errors
   * @param {PeerError} error - The error that occurred
   * @private
   */
  _handleError(error) {
    if (this.destroyed) return;

    console.error('Peer error:', error);

    // Only trigger the error callback if we're already connected
    // or if this is a critical error that should abort the connection
    if (this.connected || this._isCriticalError(error)) {
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
    } else {
      // For non-critical errors during connection setup, just log them
      console.warn('Non-critical error during connection setup:', error);
    }
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
   * Set event handlers
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  on(event, callback) {
    switch (event) {
      case 'signal':
        this.onSignalCallback = callback;
        break;
      case 'connect':
        this.onConnectCallback = callback;
        break;
      case 'data':
        this.onDataCallback = callback;
        break;
      case 'close':
        this.onCloseCallback = callback;
        break;
      case 'error':
        this.onErrorCallback = callback;
        break;
      default:
        console.warn(`Unknown event: ${event}`);
    }
  }

  /**
   * Process signaling data from the remote peer
   * @param {Object} data - Signaling data
   */
  signal(data) {
    if (this.destroyed) return;

    try {
      console.log('Processing signal:', data.type, data);

      if (data.type === 'offer') {
        // Handle the case where data might already be an RTCSessionDescription or contain sdp
        const offerDescription = data.sdp ? new RTCSessionDescription(data) : data;
        this.peerConnection
          .setRemoteDescription(offerDescription)
          .then(() => {
            console.log('Remote description set (offer)');
            return this._createAnswer();
          })
          .catch(error => this._handleError(error));
      } else if (data.type === 'answer') {
        // Handle the case where data might already be an RTCSessionDescription or contain sdp
        const answerDescription = data.sdp ? new RTCSessionDescription(data) : data;
        this.peerConnection
          .setRemoteDescription(answerDescription)
          .then(() => {
            console.log('Remote description set (answer)');
            // For the initiator, check if we need to create a data channel
            if (this.initiator && !this.dataChannel) {
              this.dataChannel = this.peerConnection.createDataChannel('data');
              this._setupDataChannel();
            }
            // Check connection state after setting remote description
            this._checkDataChannelState();
          })
          .catch(error => this._handleError(error));
      } else if (data.type === 'candidate') {
        this.peerConnection
          .addIceCandidate(new RTCIceCandidate(data.candidate))
          .catch(error => this._handleError(error));
      }
    } catch (error) {
      this._handleError(error);
      console.error('Error in signal method:', error, 'with data:', JSON.stringify(data));
    }
  }

  /**
   * Send data to the remote peer
   * @param {string|ArrayBuffer|Blob|ArrayBufferView} data - Data to send
   */
  send(data) {
    if (this.destroyed || !this.connected) return;

    try {
      // Handle different data types
      if (typeof data === 'string') {
        // Convert string to Uint8Array for compatibility
        const encoder = new TextEncoder();
        this.dataChannel.send(encoder.encode(data));
      } else if (data instanceof ArrayBuffer) {
        // Convert ArrayBuffer to Uint8Array
        this.dataChannel.send(new Uint8Array(data));
      } else if (data instanceof Blob) {
        // For Blob, we need to read it as ArrayBuffer first
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            this.dataChannel.send(new Uint8Array(reader.result));
          }
        };
        reader.readAsArrayBuffer(data);
      } else {
        // For ArrayBufferView types (already compatible)
        this.dataChannel.send(data);
      }
    } catch (error) {
      this._handleError(error);
    }
  }

  /**
   * Destroy the peer connection
   */
  destroy() {
    if (this.destroyed) return;

    this.destroyed = true;
    this.connected = false;

    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (error) {
        // Ignore
      }
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (error) {
        // Ignore
      }
      this.peerConnection = null;
    }
  }
}
