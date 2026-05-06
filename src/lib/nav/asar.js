function readHeader(buffer) {
  const view = new DataView(buffer);
  const headerPickleSize = view.getUint32(4, true);
  const jsonLength = view.getUint32(12, true);
  const jsonBytes = new Uint8Array(buffer, 16, jsonLength);
  const header = JSON.parse(new TextDecoder().decode(jsonBytes));
  const dataStart = 8 + headerPickleSize;
  return { header, dataStart };
}

function collectFiles(node, prefix, dataStart, buffer, result) {
  for (const [name, entry] of Object.entries(node.files ?? {})) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (entry.files) {
      collectFiles(entry, path, dataStart, buffer, result);
    } else {
      const start = dataStart + Number(entry.offset);
      result[path] = buffer.slice(start, start + entry.size);
    }
  }
}

const MIME_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  json: 'application/json',
  css: 'text/css'
};

function blobType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return MIME_TYPES[ext] ?? '';
}

export function extractAsar(buffer) {
  const { header, dataStart } = readHeader(buffer);
  const result = {};
  collectFiles(header, '', dataStart, buffer, result);
  const blobs = {};
  for (const [path, buf] of Object.entries(result)) {
    const filename = path.split('/').pop();
    blobs[path] = new Blob([buf], { type: blobType(filename) });
  }
  return blobs;
}
