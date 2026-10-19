export interface VoiceTokenOptions {
  apiKey: string;
  apiSecret: string;
  identity: string;
  name: string;
  roomCode: string;
  ttlSeconds?: number;
  nowSeconds?: number;
}

export interface VoiceTokenClaims {
  iss: string;
  sub: string;
  nbf: number;
  exp: number;
  name: string;
  video: {
    room: string;
    roomJoin: true;
    canPublish: true;
    canSubscribe: true;
    canPublishData: true;
  };
}

export const VOICE_TOKEN_TTL_SECONDS = 6 * 60 * 60;
const CLOCK_SKEW_SECONDS = 10;

export function buildVoiceClaims(options: VoiceTokenOptions): VoiceTokenClaims {
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  return {
    iss: options.apiKey,
    sub: options.identity,
    nbf: now - CLOCK_SKEW_SECONDS,
    exp: now + (options.ttlSeconds ?? VOICE_TOKEN_TTL_SECONDS),
    name: options.name,
    video: {
      room: options.roomCode,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  };
}

export async function signVoiceToken(options: VoiceTokenOptions): Promise<string> {
  const claims = buildVoiceClaims(options);
  const signingInput = `${base64UrlEncode(jsonBytes({ alg: 'HS256', typ: 'JWT' }))}.${base64UrlEncode(jsonBytes(claims))}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(options.apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
