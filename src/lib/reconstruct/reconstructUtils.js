export function decodeFrameImageData(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

export function classifyVertices(signMap) {
  const black = [];
  const white = [];
  const empty = [];
  for (let row = 0; row < signMap.length; row++) {
    for (let col = 0; col < signMap[row].length; col++) {
      const sign = signMap[row][col];
      if (sign === 1) black.push([row, col]);
      else if (sign === -1) white.push([row, col]);
      else empty.push([row, col]);
    }
  }
  return { black, white, empty };
}

export function diffVertices(signMapA, signMapB) {
  const diffs = [];
  for (let y = 0; y < signMapA.length; y++) {
    for (let x = 0; x < signMapA[y].length; x++) {
      if (signMapA[y][x] !== signMapB[y][x]) diffs.push({ x, y, sign: signMapB[y][x] });
    }
  }
  return diffs;
}

export function stonesFromSignMap(signMap) {
  const stones = [];
  for (let y = 0; y < signMap.length; y++) {
    for (let x = 0; x < signMap[y].length; x++) {
      if (signMap[y][x] !== 0) stones.push({ x, y, sign: signMap[y][x] });
    }
  }
  return stones;
}

export function calibrateFromSignMap(board, signMap) {
  const { black, white, empty } = classifyVertices(signMap);
  return board.calibrate(black, white, empty);
}

export function classifyRawValues(
  rawValues,
  cutoffs,
  markedEmptyKeys = new Set(),
  marginFactor = 1.5
) {
  const emptyCenter = (cutoffs.black + cutoffs.white) / 2;
  const halfSpan = (cutoffs.white - cutoffs.black) / 2;
  const widenedBlack = emptyCenter - halfSpan * marginFactor;
  const widenedWhite = emptyCenter + halfSpan * marginFactor;
  return rawValues.map((row, y) =>
    row.map((value, x) => {
      const marked = markedEmptyKeys.has(`${y},${x}`);
      const blackCutoff = marked ? widenedBlack : cutoffs.black;
      const whiteCutoff = marked ? widenedWhite : cutoffs.white;
      if (value < blackCutoff) return 1;
      if (value > whiteCutoff) return -1;
      return 0;
    })
  );
}
