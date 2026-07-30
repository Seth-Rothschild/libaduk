const LOCAL_FILE_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const DEFLATE_METHOD = 8;
const VERSION_NEEDED = 20;

const CRC32_TABLE = buildCrc32Table();

function buildCrc32Table() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const dosTime =
    (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f);
  const dosDate =
    ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

async function deflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function createZip(entries) {
  const encoder = new TextEncoder();
  const { dosTime, dosDate } = dosDateTime(new Date());
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = encoder.encode(name);
    const compressed = await deflateRaw(data);
    const checksum = crc32(data);

    const localHeader = new DataView(new ArrayBuffer(30));
    localHeader.setUint32(0, LOCAL_FILE_SIGNATURE, true);
    localHeader.setUint16(4, VERSION_NEEDED, true);
    localHeader.setUint16(6, 0, true);
    localHeader.setUint16(8, DEFLATE_METHOD, true);
    localHeader.setUint16(10, dosTime, true);
    localHeader.setUint16(12, dosDate, true);
    localHeader.setUint32(14, checksum, true);
    localHeader.setUint32(18, compressed.length, true);
    localHeader.setUint32(22, data.length, true);
    localHeader.setUint16(26, nameBytes.length, true);
    localHeader.setUint16(28, 0, true);

    localParts.push(new Uint8Array(localHeader.buffer), nameBytes, compressed);

    const centralHeader = new DataView(new ArrayBuffer(46));
    centralHeader.setUint32(0, CENTRAL_DIRECTORY_SIGNATURE, true);
    centralHeader.setUint16(4, VERSION_NEEDED, true);
    centralHeader.setUint16(6, VERSION_NEEDED, true);
    centralHeader.setUint16(8, 0, true);
    centralHeader.setUint16(10, DEFLATE_METHOD, true);
    centralHeader.setUint16(12, dosTime, true);
    centralHeader.setUint16(14, dosDate, true);
    centralHeader.setUint32(16, checksum, true);
    centralHeader.setUint32(20, compressed.length, true);
    centralHeader.setUint32(24, data.length, true);
    centralHeader.setUint16(28, nameBytes.length, true);
    centralHeader.setUint16(30, 0, true);
    centralHeader.setUint16(32, 0, true);
    centralHeader.setUint16(34, 0, true);
    centralHeader.setUint16(36, 0, true);
    centralHeader.setUint32(38, 0, true);
    centralHeader.setUint32(42, offset, true);

    centralParts.push(new Uint8Array(centralHeader.buffer), nameBytes);

    offset += localHeader.byteLength + nameBytes.length + compressed.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectorySize = centralParts.reduce((sum, part) => sum + part.length, 0);

  const endRecord = new DataView(new ArrayBuffer(22));
  endRecord.setUint32(0, END_OF_CENTRAL_DIRECTORY_SIGNATURE, true);
  endRecord.setUint16(4, 0, true);
  endRecord.setUint16(6, 0, true);
  endRecord.setUint16(8, entries.length, true);
  endRecord.setUint16(10, entries.length, true);
  endRecord.setUint32(12, centralDirectorySize, true);
  endRecord.setUint32(16, centralDirectoryOffset, true);
  endRecord.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, new Uint8Array(endRecord.buffer)], {
    type: 'application/zip'
  });
}

export async function readZip(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const decoder = new TextDecoder();

  let endOffset = bytes.length - 22;
  while (endOffset >= 0 && view.getUint32(endOffset, true) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
    endOffset--;
  }
  if (endOffset < 0) throw new Error('Not a valid zip file');

  const entryCount = view.getUint16(endOffset + 10, true);
  let centralOffset = view.getUint32(endOffset + 16, true);

  const entries = [];
  for (let i = 0; i < entryCount; i++) {
    const compressedSize = view.getUint32(centralOffset + 20, true);
    const nameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const localHeaderOffset = view.getUint32(centralOffset + 42, true);
    const name = decoder.decode(
      bytes.subarray(centralOffset + 46, centralOffset + 46 + nameLength)
    );

    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    entries.push({ name, data: await inflateRaw(compressed) });

    centralOffset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}
