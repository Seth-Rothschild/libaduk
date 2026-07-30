import { createZip, readZip } from './zip.js';
import { getFrames, createSession, addFrame, setSessionStatus } from './db.js';

const MANIFEST_NAME = 'manifest.json';

function frameFileName(frame) {
  return `frame-${String(frame.frameId).padStart(4, '0')}.jpg`;
}

export async function exportSessionAsZip(session) {
  const frames = await getFrames(session.sessionId);
  const manifest = {
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    frames: frames.map((frame) => ({
      timestamp: frame.timestamp,
      filename: frameFileName(frame)
    }))
  };

  const entries = [
    { name: MANIFEST_NAME, data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) },
    ...(await Promise.all(
      frames.map(async (frame) => ({
        name: frameFileName(frame),
        data: new Uint8Array(await frame.blob.arrayBuffer())
      }))
    ))
  ];

  return createZip(entries);
}

export async function importSessionFromZip(zipBlob) {
  const entries = await readZip(zipBlob);
  const manifestEntry = entries.find((entry) => entry.name === MANIFEST_NAME);
  if (!manifestEntry) throw new Error('Zip file is missing manifest.json');
  const manifest = JSON.parse(new TextDecoder().decode(manifestEntry.data));

  const sessionId = crypto.randomUUID();
  await createSession(sessionId, manifest.startedAt);

  for (const frameInfo of manifest.frames) {
    const entry = entries.find((e) => e.name === frameInfo.filename);
    if (!entry) continue;
    const blob = new Blob([entry.data], { type: 'image/jpeg' });
    await addFrame(sessionId, blob, frameInfo.timestamp);
  }

  await setSessionStatus(sessionId, 'stopped');
  return sessionId;
}
