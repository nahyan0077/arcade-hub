// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startRelay, type RelayServer } from '../../../server/relay';

const VOICE = {
  url: 'ws://livekit.local:7880',
  apiKey: 'devkey',
  apiSecret: 'devsecret',
};

let configured: RelayServer;
let unconfigured: RelayServer;

beforeAll(async () => {
  configured = await startRelay(0, { voice: VOICE });
  unconfigured = await startRelay(0, { voice: null });
});

afterAll(async () => {
  await configured.close();
  await unconfigured.close();
});

function voiceUrl(server: RelayServer): string {
  return `http://127.0.0.1:${server.port}/voice/token`;
}

function decodePayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');
  const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
  return JSON.parse(json) as Record<string, unknown>;
}

describe('relay voice token endpoint', () => {
  it('mints a LiveKit join token for a valid room', async () => {
    const response = await fetch(voiceUrl(configured), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomCode: 'ABC234', name: 'Alice' }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { url: string; token: string };
    expect(body.url).toBe(VOICE.url);

    const claims = decodePayload(body.token);
    expect(claims).toMatchObject({ iss: 'devkey', name: 'Alice' });
    expect(claims.sub).toMatch(/^[0-9a-f-]{36}$/);
    expect(claims.video).toMatchObject({ room: 'ABC234', roomJoin: true });
  });

  it('rejects an invalid room code or name', async () => {
    const badRoom = await fetch(voiceUrl(configured), {
      method: 'POST',
      body: JSON.stringify({ roomCode: 'bad!', name: 'Alice' }),
    });
    expect(badRoom.status).toBe(400);

    const badName = await fetch(voiceUrl(configured), {
      method: 'POST',
      body: JSON.stringify({ roomCode: 'ABC234', name: '  ' }),
    });
    expect(badName.status).toBe(400);

    const malformed = await fetch(voiceUrl(configured), {
      method: 'POST',
      body: 'not json',
    });
    expect(malformed.status).toBe(400);
  });

  it('answers 503 when voice is not configured', async () => {
    const response = await fetch(voiceUrl(unconfigured), {
      method: 'POST',
      body: JSON.stringify({ roomCode: 'ABC234', name: 'Alice' }),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'voice-unconfigured' });
  });

  it('serves a plain-text root and 404s elsewhere', async () => {
    const root = await fetch(`http://127.0.0.1:${configured.port}/`);
    expect(root.status).toBe(200);
    expect(await root.text()).toBe('tic-tac-toe relay');

    const missing = await fetch(`http://127.0.0.1:${configured.port}/nope`);
    expect(missing.status).toBe(404);
  });
});
