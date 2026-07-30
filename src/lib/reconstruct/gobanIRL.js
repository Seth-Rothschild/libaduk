import * as utils from './graphicsUtils.js';

export function toSignMap(state) {
  return state.map((row) =>
    row.map((cell) => {
      if (cell === 'black') return 1;
      if (cell === 'white') return -1;
      return 0;
    })
  );
}

export class Board {
  constructor(
    imageData,
    gridCorners,
    { detectionFunction = null, cutoffs = null, offsets = null } = {}
  ) {
    this.boardSubimage = imageData;
    const [topLeft, topRight, bottomLeft] = gridCorners;
    const xstep = (topRight.x - topLeft.x) / 18;
    const ystep = (bottomLeft.y - topLeft.y) / 18;
    const zeroOffsets = utils.range(19).map(() => utils.range(19).map(() => ({ x: 0, y: 0 })));
    this.intersections = Board._computeIntersections(topLeft, xstep, ystep, offsets ?? zeroOffsets);
    this.stoneBoundaries = this.getStoneBoundaries(
      this.boardSubimage,
      this.intersections,
      xstep,
      ystep
    );
    this.state = this.findState(
      this.boardSubimage,
      this.stoneBoundaries,
      detectionFunction,
      cutoffs
    );
  }

  getStoneBoundaries(imageData, intersections, xstep, ystep) {
    const { width, height } = imageData;
    const halfX = xstep / 2;
    const halfY = ystep / 2;
    return intersections.map((row) =>
      row.map((loc) => {
        const xmin = Math.max(0, Math.floor(loc.x - halfX));
        const ymin = Math.max(0, Math.floor(loc.y - halfY));
        const xmax = Math.min(Math.ceil(loc.x + halfX), width);
        const ymax = Math.min(Math.ceil(loc.y + halfY), height);
        return { xmin, xmax, ymin, ymax };
      })
    );
  }

  getValues(fn) {
    return this.stoneBoundaries.map((row) =>
      row.map((boundary) => {
        const subimage = utils.cropImageData(this.boardSubimage, boundary);
        return fn(subimage);
      })
    );
  }

  findState(imageData, boundaries, detectionFunction = null, cutoffs = null) {
    return boundaries.map((row) =>
      row.map((boundary) => {
        const stoneSubimage = utils.cropImageData(imageData, boundary);
        const { positionState } = this.detectStone(stoneSubimage, detectionFunction, cutoffs);
        return positionState;
      })
    );
  }

  detectStone(stoneSubimage, detectionFunction = null, cutoffs = null) {
    if (detectionFunction === null) detectionFunction = utils.checkBw;
    if (cutoffs === null) cutoffs = { black: 70, white: 150 };
    const decidingValue = detectionFunction(stoneSubimage);
    const positionState = Board._findRegion(decidingValue, cutoffs);
    return { positionState, decidingValue };
  }

  calibrate(blackStones, whiteStones, emptySpaces) {
    const boardSubimage = this.boardSubimage;
    const stoneBoundaries = this.stoneBoundaries;

    const blackStoneImages = blackStones.map(([i, j]) =>
      utils.cropImageData(boardSubimage, stoneBoundaries[i][j])
    );
    const whiteStoneImages = whiteStones.map(([i, j]) =>
      utils.cropImageData(boardSubimage, stoneBoundaries[i][j])
    );
    const emptySpaceImages = emptySpaces.map(([i, j]) =>
      utils.cropImageData(boardSubimage, stoneBoundaries[i][j])
    );

    const testFunctions = utils.DETECTION_FUNCTIONS;
    let maxScore = 0;
    let bestFunction = null;
    let bestCutoffs = null;

    for (const measurementFunction of testFunctions) {
      const bMeasurements = blackStoneImages.map((im) => measurementFunction(im));
      const eMeasurements = emptySpaceImages.map((im) => measurementFunction(im));
      const wMeasurements = whiteStoneImages.map((im) => measurementFunction(im));

      const minB = Math.min(...bMeasurements);
      const maxB = Math.max(...bMeasurements);
      const minE = Math.min(...eMeasurements);
      const maxE = Math.max(...eMeasurements);
      const minW = Math.min(...wMeasurements);
      const maxW = Math.max(...wMeasurements);

      const score = maxW - minB > 0 ? (minE - maxB + minW - maxE) / (maxW - minB) : 0;

      if (maxB < minE && maxE < minW && score > maxScore) {
        maxScore = score;
        bestFunction = measurementFunction;
        bestCutoffs = { black: (maxB + minE) / 2, white: (maxE + minW) / 2 };
      }
    }

    if (bestFunction === null) {
      throw new Error('No partitions of the space found.');
    }

    return { detectionFunction: bestFunction, cutoffs: bestCutoffs };
  }

  analyzeDetectionFunctions() {
    return utils.DETECTION_FUNCTIONS.map((fn) => {
      const allValues = this.stoneBoundaries.flat().map((boundary) => {
        const subimage = utils.cropImageData(this.boardSubimage, boundary);
        return fn(subimage);
      });
      const sorted = [...allValues].sort((a, b) => a - b);
      const { black, white } = Board._suggestCutoffs(sorted);
      return { name: fn.name, fn, sorted, blackCutoff: black, whiteCutoff: white };
    });
  }

  compareTo(otherBoard) {
    const boardState = this.state;
    const missingStones = [];
    for (const [[i, j], boardValue] of Board._iterate(boardState)) {
      const otherBoardValue = otherBoard.state[i][j];
      if (boardValue !== otherBoardValue) {
        missingStones.push([i, j, boardValue, otherBoardValue]);
      }
    }
    return missingStones;
  }

  static *_iterate(twoDimArray) {
    for (let i = 0; i < twoDimArray.length; i++) {
      for (let j = 0; j < twoDimArray[i].length; j++) {
        yield [[i, j], twoDimArray[i][j]];
      }
    }
  }

  static _computeIntersections(origin, xstep, ystep, offsets) {
    return utils.range(19).map((row) =>
      utils.range(19).map((col) => ({
        x: Math.round(origin.x + col * xstep + offsets[row][col].x),
        y: Math.round(origin.y + row * ystep + offsets[row][col].y)
      }))
    );
  }

  static _suggestCutoffs(sortedValues) {
    const gaps = sortedValues.slice(1).map((v, i) => ({
      gap: v - sortedValues[i],
      pos: (v + sortedValues[i]) / 2
    }));
    gaps.sort((a, b) => b.gap - a.gap);
    const topTwo = gaps.slice(0, 2).sort((a, b) => a.pos - b.pos);
    return { black: Math.round(topTwo[0].pos), white: Math.round(topTwo[1].pos) };
  }

  static _findRegion(decidingValue, cutoffs) {
    if (decidingValue < cutoffs.black) return 'black';
    if (decidingValue > cutoffs.white) return 'white';
    return 'empty';
  }

  static _humanReadableNumeric(loc) {
    const [row, col] = loc;
    return `${col + 1}-${19 - row}`;
  }

  static _humanReadableAlpha(loc) {
    const [row, col] = loc;
    const alpha = 'ABCDEFGHJKLMNOPQRST';
    return `${alpha[col]}${19 - row}`;
  }
}
