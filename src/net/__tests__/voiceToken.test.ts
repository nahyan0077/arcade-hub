// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { buildVoiceClaims, signVoiceToken, VOICE_TOKEN_TTL_SECONDS } from '../voiceToken';

const OPTIONS = {
  apiKey: 'devkey',
  apiSecret: 'devsecret',
  identity: 'player-1',
  name: 'ALICE',
  room: 'ABC234',
  nowSeconds: 1_700_000_000,
};

function decodePayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');
  const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
  return JSON.parse(json) as Record<string, unknown>;
}

describe('voice token claims', () => {
  it('builds LiveKit-shaped join claims', () => {
    const claims = buildVoiceClaims(OPTIONS);
    expect(claims).toEqual({
      iss: 'devkey',
      sub: 'player-1',
      nbf: 1_700_000_000 - 10,
      exp: 1_700_000_000 + VOICE_TOKEN_TTL_SECONDS,
      name: 'ALICE',
      video: {
        room: 'ABC234',
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    });
  });
});

describe('signVoiceToken', () => {
  it('produces a three-part JWT whose claims decode', async () => {
    const token = await signVoiceToken(OPTIONS);
    expect(token.split('.')).toHaveLength(3);

    const header = JSON.parse(
      Buffer.from(token.split('.')[0], 'base64url').toString(),
    ) as Record<string, unknown>;
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });

    const payload = decodePayload(token);
    expect(payload).toMatchObject({ iss: 'devkey', sub: 'player-1' });
    expect(payload.video).toMatchObject({ room: 'ABC234', roomJoin: true });
  });

  it('signs with HMAC-SHA256 over header.payload, verifiable by an independent implementation', async () => {
    const token = await signVoiceToken(OPTIONS);
    const [headerPart, payloadPart, signaturePart] = token.split('.');

    const expected = createHmac('sha256', OPTIONS.apiSecret)
      .update(`${headerPart}.${payloadPart}`)
      .digest('base64url');
    expect(signaturePart).toBe(expected);

    expect(decodePayload(token)).toEqual(buildVoiceClaims(OPTIONS));
  });

  it('respects a custom ttl', async () => {
    const token = await signVoiceToken({ ...OPTIONS, ttlSeconds: 60 });
    const payload = decodePayload(token);
    expect(payload.exp).toBe(OPTIONS.nowSeconds! + 60);
  });
});
