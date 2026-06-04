export function sortCorners(corners) {
  const sums = corners.map((c) => c.x + c.y);
  const topLeftIndex = sums.indexOf(Math.min(...sums));
  const topLeft = corners[topLeftIndex];
  const bottomRightIndex = sums.indexOf(Math.max(...sums));
  const bottomRight = corners[bottomRightIndex];
  const remainingCorners = corners.filter((c) => c !== topLeft && c !== bottomRight);
  let topRight, bottomLeft;
  if (remainingCorners[0].x > remainingCorners[1].x) {
    [topRight, bottomLeft] = remainingCorners;
  } else {
    [bottomLeft, topRight] = remainingCorners;
  }
  const sortedCorners = [topLeft, topRight, bottomLeft, bottomRight];
  return sortedCorners;
}

export function range(n) {
  return Array.from({ length: n }, (_, i) => i);
}

function gaussElim(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
    x[i] /= M[i][i];
  }
  return x;
}

function buildH(src, dst) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i];
    const { x: dx, y: dy } = dst[i];
    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }
  const h = gaussElim(A, b);
  return [...h, 1];
}

function applyH(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
}

export function computeH(corners) {
  const [topLeft, topRight, bottomLeft, bottomRight] = corners;
  const src = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 }
  ];
  return buildH(src, [topLeft, topRight, bottomLeft, bottomRight]);
}

export function intersectionPoint(H, row, col) {
  return applyH(H, col / 18, row / 18);
}

export function cellRadius(H) {
  const centre = applyH(H, 0.5, 0.5);
  const right = applyH(H, 0.5 + 1 / 18, 0.5);
  return Math.hypot(right.x - centre.x, right.y - centre.y) * 0.5;
}

export function warpPerspective(imageData, corners) {
  const { imageData: fullImage, corners: outputCorners } = transformFull(imageData, corners);
  const [topLeft, , , bottomRight] = outputCorners;
  return cropImageData(fullImage, {
    xmin: Math.round(topLeft.x),
    xmax: Math.round(bottomRight.x),
    ymin: Math.round(topLeft.y),
    ymax: Math.round(bottomRight.y)
  });
}

export function transformFull(imageData, corners) {
  const japanBoardRatio = 454.5 / 424.2;
  const margin = 0.15;
  const [topLeft, topRight, bottomLeft, bottomRight] = sortCorners(corners);
  const boardWidth = Math.round(
    Math.hypot(bottomRight.x - bottomLeft.x, bottomRight.y - bottomLeft.y)
  );
  const boardHeight = Math.round(japanBoardRatio * boardWidth);

  const unitSquare = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 }
  ];
  const H = buildH(unitSquare, [topLeft, topRight, bottomLeft, bottomRight]);

  const uMin = -margin,
    uMax = 1 + margin;
  const vMin = -margin,
    vMax = 1 + margin;

  const totalWidth = Math.round((uMax - uMin) * boardWidth);
  const totalHeight = Math.round((vMax - vMin) * boardHeight);
  const out = new ImageData(totalWidth, totalHeight);

  for (let outY = 0; outY < totalHeight; outY++) {
    for (let outX = 0; outX < totalWidth; outX++) {
      const u = uMin + (outX / (totalWidth - 1)) * (uMax - uMin);
      const v = vMin + (outY / (totalHeight - 1)) * (vMax - vMin);
      const sourcePoint = applyH(H, u, v);
      const inX = Math.round(sourcePoint.x);
      const inY = Math.round(sourcePoint.y);
      if (inX < 0 || inY < 0 || inX >= imageData.width || inY >= imageData.height) continue;
      const sourceOffset = (inY * imageData.width + inX) * 4;
      const destOffset = (outY * totalWidth + outX) * 4;
      out.data[destOffset] = imageData.data[sourceOffset];
      out.data[destOffset + 1] = imageData.data[sourceOffset + 1];
      out.data[destOffset + 2] = imageData.data[sourceOffset + 2];
      out.data[destOffset + 3] = 255;
    }
  }

  const toOutputCoords = (u, v) => ({
    x: ((u - uMin) / (uMax - uMin)) * (totalWidth - 1),
    y: ((v - vMin) / (vMax - vMin)) * (totalHeight - 1)
  });

  return {
    imageData: out,
    corners: [
      toOutputCoords(0, 0),
      toOutputCoords(1, 0),
      toOutputCoords(0, 1),
      toOutputCoords(1, 1)
    ]
  };
}

export function cropImageData(imageData, { xmin, xmax, ymin, ymax }) {
  const width = xmax - xmin;
  const height = ymax - ymin;
  const out = new ImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sourceOffset = ((ymin + y) * imageData.width + (xmin + x)) * 4;
      const destinationOffset = (y * width + x) * 4;
      out.data[destinationOffset] = imageData.data[sourceOffset];
      out.data[destinationOffset + 1] = imageData.data[sourceOffset + 1];
      out.data[destinationOffset + 2] = imageData.data[sourceOffset + 2];
      out.data[destinationOffset + 3] = imageData.data[sourceOffset + 3];
    }
  }
  return out;
}

export function checkBw(stoneSubimage) {
  const pixelCount = stoneSubimage.width * stoneSubimage.height;
  let total = 0;
  for (let i = 0; i < stoneSubimage.data.length; i += 4) {
    total +=
      0.299 * stoneSubimage.data[i] +
      0.587 * stoneSubimage.data[i + 1] +
      0.114 * stoneSubimage.data[i + 2];
  }
  return pixelCount > 0 ? total / pixelCount : 128;
}

export function checkCenterBrightness(stoneSubimage) {
  const { width, height } = stoneSubimage;
  const x0 = Math.floor(width / 3);
  const x1 = Math.ceil((2 * width) / 3);
  const y0 = Math.floor(height / 3);
  const y1 = Math.ceil((2 * height) / 3);
  let total = 0;
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      total +=
        0.299 * stoneSubimage.data[i] +
        0.587 * stoneSubimage.data[i + 1] +
        0.114 * stoneSubimage.data[i + 2];
      count++;
    }
  }
  return count > 0 ? total / count : 128;
}

export function checkCoolBrightness(stoneSubimage) {
  const pixelCount = stoneSubimage.width * stoneSubimage.height;
  let total = 0;
  for (let i = 0; i < stoneSubimage.data.length; i += 4) {
    const r = stoneSubimage.data[i];
    const g = stoneSubimage.data[i + 1];
    const b = stoneSubimage.data[i + 2];
    total += 0.1 * r + 0.4 * g + 0.5 * b;
  }
  return pixelCount > 0 ? total / pixelCount : 128;
}

export function checkCoreBrightness(stoneSubimage) {
  const { width, height } = stoneSubimage;
  const x0 = Math.floor((width * 5) / 12);
  const x1 = Math.ceil((width * 7) / 12);
  const y0 = Math.floor((height * 5) / 12);
  const y1 = Math.ceil((height * 7) / 12);
  let total = 0;
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      total +=
        0.299 * stoneSubimage.data[i] +
        0.587 * stoneSubimage.data[i + 1] +
        0.114 * stoneSubimage.data[i + 2];
      count++;
    }
  }
  return count > 0 ? total / count : 128;
}

export function checkCoreAndCool(stoneSubimage) {
  return (checkCoreBrightness(stoneSubimage) + checkCoolBrightness(stoneSubimage)) / 2;
}

export const DETECTION_FUNCTIONS = [
  checkBw,
  checkCenterBrightness,
  checkCoolBrightness,
  checkCoreBrightness,
  checkCoreAndCool
];
