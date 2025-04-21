import { deflate, inflate } from 'pako';

const dictionary = [
  'v=0',
  'o=- ',
  's=-',
  't=0 0',
  'a=group:BUNDLE',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=application',
  'm=audio',
  'm=video',
  'UDP/DTLS/SCTP',
  'RTP/SAVPF',
  'a=rtcp-mux',
  'a=setup:actpass',
  'a=mid:',
  'a=ice-ufrag:',
  'a=ice-pwd:',
  'a=ice-options:trickle',
  'a=ice-options:',
  'a=fingerprint:sha-256',
  'a=sendrecv',
  'a=rtpmap:',
  'a=fmtp:',
  'a=rtcp-fb:',
  'a=ssrc:',
  'a=sctp-port:',
  'a=max-message-size:',
  'a=candidate:',
  'a=end-of-candidates',
  'a=rtcp-rsize',
  'a=recvonly',
  'a=sendonly',
  'a=inactive',
  'a=msid:',
  'a=ssrc-group:FID',
  'a=rtcp:',
  'a=rtcp-mux-only',
  'a=rtcp-fb:96 goog-remb',
  'a=rtcp-fb:96 transport-cc',
  'a=rtcp-fb:96 ccm fir',
  'a=rtcp-fb:96 nack',
  'a=rtcp-fb:96 nack pli',
  'a=fmtp:111 minptime=10;useinbandfec=1',
  'a=fmtp:96 apt=98',
  'a=fmtp:97 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f',
  'IN IP4',
  'candidate:',
].join('\r\n');

/**
 * Compress a string
 * @param {string} value - The string to compress
 * @returns {Uint8Array} The compressed string
 */
export function compress(value) {
  return deflate(value, { dictionary });
}

/**
 * Decompress a string
 * @param {Uint8Array} value - The compressed string
 * @returns {string} The decompressed string
 */
export function decompress(value) {
  return inflate(value, { dictionary, to: 'string' });
}
