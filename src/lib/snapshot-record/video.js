const CAPTURE_FPS = 10;

function pickMimeType() {
  const candidates = ['video/webm', 'video/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

export async function buildVideoFromFrames(frames, { frameDurationMs = 300 } = {}) {
  if (frames.length === 0) throw new Error('No frames to build a video from');

  const firstBitmap = await createImageBitmap(frames[0].blob);
  const canvas = document.createElement('canvas');
  canvas.width = firstBitmap.width;
  canvas.height = firstBitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(firstBitmap, 0, 0);

  const stream = canvas.captureStream(CAPTURE_FPS);
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const recordingStopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });

  recorder.start();
  await new Promise((resolve) => setTimeout(resolve, frameDurationMs));

  for (const frame of frames.slice(1)) {
    const bitmap = await createImageBitmap(frame.blob);
    ctx.drawImage(bitmap, 0, 0);
    await new Promise((resolve) => setTimeout(resolve, frameDurationMs));
  }

  recorder.stop();
  await recordingStopped;

  return new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
