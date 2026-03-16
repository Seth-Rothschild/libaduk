const ALPHA = 'abcdefghijklmnopqrs';

function vertexToSgf(vertex) {
  return ALPHA[vertex[0]] + ALPHA[vertex[1]];
}

function sgfToVertex(str) {
  return [ALPHA.indexOf(str[0]), ALPHA.indexOf(str[1])];
}

function escapeSgf(str) {
  return str.replace(/\\/g, '\\\\').replace(/]/g, '\\]');
}

function markerProps(markerMap, size) {
  const props = { MA: [], CR: [], SQ: [], TR: [], LB: [] };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const m = markerMap[y][x];
      if (!m) continue;
      const coord = vertexToSgf([x, y]);
      if (m === 'cross') props.MA.push(coord);
      else if (m === 'circle') props.CR.push(coord);
      else if (m === 'square') props.SQ.push(coord);
      else if (m === 'triangle') props.TR.push(coord);
      else if (m.type === 'label' || m.type === 'number') {
        props.LB.push(coord + ':' + escapeSgf(m.label));
      }
    }
  }
  return props;
}

function stringifyNode(node, size, isRoot, options) {
  let parts = [];

  if (isRoot) {
    parts.push(';');
    parts.push('GM[1]');
    parts.push('FF[4]');
    parts.push('SZ[' + size + ']');
    parts.push('KM[6.5]');
    if (options.playerBlack) parts.push('PB[' + escapeSgf(options.playerBlack) + ']');
    if (options.playerWhite) parts.push('PW[' + escapeSgf(options.playerWhite) + ']');
  } else if (node.lastMove) {
    const color = node.signToPlay === 1 ? 'W' : 'B';
    parts.push(';');
    parts.push(color + '[' + vertexToSgf(node.lastMove) + ']');
  } else {
    parts.push(';');
  }

  const mp = markerProps(node.markerMap, size);
  for (const key of ['MA', 'CR', 'SQ', 'TR', 'LB']) {
    if (mp[key].length > 0) {
      parts.push(key + mp[key].map((v) => '[' + v + ']').join(''));
    }
  }

  return parts.join('');
}

function stringifyTree(node, size, isRoot, options) {
  let result = stringifyNode(node, size, isRoot, options);

  if (node.children.length === 1) {
    result += '\n' + stringifyTree(node.children[0], size, false, options);
  } else if (node.children.length > 1) {
    for (const child of node.children) {
      result += '\n(' + stringifyTree(child, size, false, options) + ')';
    }
  }

  return result;
}

export function exportSgf(root, size, options = {}) {
  return '(' + stringifyTree(root, size, true, options) + ')\n';
}

function tokenize(sgf) {
  const tokens = [];
  let i = 0;
  while (i < sgf.length) {
    const ch = sgf[i];
    if (ch === '(' || ch === ')' || ch === ';') {
      tokens.push({ type: ch });
      i++;
    } else if (ch === '[') {
      let value = '';
      i++;
      while (i < sgf.length && sgf[i] !== ']') {
        if (sgf[i] === '\\' && i + 1 < sgf.length) {
          i++;
          value += sgf[i];
        } else {
          value += sgf[i];
        }
        i++;
      }
      i++;
      tokens.push({ type: 'value', value });
    } else if (/[A-Z]/.test(ch)) {
      let prop = '';
      while (i < sgf.length && /[A-Z]/.test(sgf[i])) {
        prop += sgf[i];
        i++;
      }
      tokens.push({ type: 'prop', prop });
    } else {
      i++;
    }
  }
  return tokens;
}

function parseTokens(tokens) {
  let pos = 0;

  function parseTree() {
    if (tokens[pos]?.type !== '(') return null;
    pos++;
    const nodes = parseSequence();
    if (tokens[pos]?.type === ')') pos++;
    return nodes;
  }

  function parseSequence() {
    const nodes = [];
    while (pos < tokens.length) {
      if (tokens[pos].type === ';') {
        pos++;
        const node = { props: {}, children: [] };
        while (pos < tokens.length && tokens[pos].type === 'prop') {
          const propName = tokens[pos].prop;
          pos++;
          const values = [];
          while (pos < tokens.length && tokens[pos].type === 'value') {
            values.push(tokens[pos].value);
            pos++;
          }
          node.props[propName] = values;
        }
        nodes.push(node);
      } else if (tokens[pos].type === '(') {
        const lastNode = nodes[nodes.length - 1];
        if (lastNode) {
          const subtree = parseTree();
          if (subtree && subtree.length > 0) {
            lastNode.children.push(subtree);
          }
        }
      } else if (tokens[pos].type === ')') {
        break;
      } else {
        pos++;
      }
    }

    for (let i = 0; i < nodes.length - 1; i++) {
      nodes[i].children.push([nodes[i + 1]]);
    }

    return nodes.length > 0 ? [nodes[0]] : [];
  }

  const result = parseTree();
  return result && result.length > 0 ? result[0] : null;
}

function flattenSgfNode(sgfNode) {
  const result = { props: sgfNode.props, children: [] };
  for (const branch of sgfNode.children) {
    if (branch.length > 0) {
      result.children.push(flattenSgfNode(branch[0]));
    }
  }
  return result;
}

export function parseSgf(sgfText) {
  const tokens = tokenize(sgfText);
  const rootSgf = parseTokens(tokens);
  if (!rootSgf) return null;

  const root = flattenSgfNode(rootSgf);
  const sizeVal = root.props.SZ ? parseInt(root.props.SZ[0]) : 19;
  const size = [9, 13, 19].includes(sizeVal) ? sizeVal : 19;

  const playerBlack = root.props.PB ? root.props.PB[0] : null;
  const playerWhite = root.props.PW ? root.props.PW[0] : null;

  return { root, size, playerBlack, playerWhite };
}

export function sgfNodeToMove(sgfNode) {
  if (sgfNode.props.B) {
    const coord = sgfNode.props.B[0];
    if (!coord || coord.length < 2) return { type: 'pass', sign: 1 };
    const vertex = sgfToVertex(coord);
    return { type: 'move', sign: 1, x: vertex[0], y: vertex[1] };
  }
  if (sgfNode.props.W) {
    const coord = sgfNode.props.W[0];
    if (!coord || coord.length < 2) return { type: 'pass', sign: -1 };
    const vertex = sgfToVertex(coord);
    return { type: 'move', sign: -1, x: vertex[0], y: vertex[1] };
  }
  return null;
}

export function sgfNodeMarkers(sgfNode, size) {
  const map = Array.from({ length: size }, () => new Array(size).fill(null));

  for (const coord of sgfNode.props.MA || []) {
    const [x, y] = sgfToVertex(coord);
    if (x >= 0 && x < size && y >= 0 && y < size) map[y][x] = 'cross';
  }
  for (const coord of sgfNode.props.CR || []) {
    const [x, y] = sgfToVertex(coord);
    if (x >= 0 && x < size && y >= 0 && y < size) map[y][x] = 'circle';
  }
  for (const coord of sgfNode.props.SQ || []) {
    const [x, y] = sgfToVertex(coord);
    if (x >= 0 && x < size && y >= 0 && y < size) map[y][x] = 'square';
  }
  for (const coord of sgfNode.props.TR || []) {
    const [x, y] = sgfToVertex(coord);
    if (x >= 0 && x < size && y >= 0 && y < size) map[y][x] = 'triangle';
  }
  for (const entry of sgfNode.props.LB || []) {
    const colonIdx = entry.indexOf(':');
    if (colonIdx < 2) continue;
    const coord = entry.slice(0, colonIdx);
    const label = entry.slice(colonIdx + 1);
    const [x, y] = sgfToVertex(coord);
    if (x >= 0 && x < size && y >= 0 && y < size) {
      const isNum = /^\d+$/.test(label);
      map[y][x] = { type: isNum ? 'number' : 'label', label };
    }
  }

  return map;
}
