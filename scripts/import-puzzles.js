import { readFileSync, readdirSync } from 'fs';
import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL ?? 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGO_DB ?? 'libaduk';
const PUZZLE_DIR = 'data/puzzles';
const LIMIT = parseInt(process.argv[2] || '1000', 10);

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
          const existing = node.props[propName];
          node.props[propName] = existing ? existing.concat(values) : values;
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

function flattenFirstBranch(sgfNode) {
  const result = { props: { ...sgfNode.props }, children: [] };
  if (sgfNode.children.length > 0) {
    const firstBranch = sgfNode.children[0];
    if (firstBranch.length > 0) {
      result.children.push(flattenFirstBranch(firstBranch[0]));
    }
  }
  return result;
}

function detectFirstMoveColor(node) {
  let current = node;
  while (current.children.length > 0) {
    const child = current.children[0];
    if (child.props.B) return 'B';
    if (child.props.W) return 'W';
    current = child;
  }
  return null;
}

function swapColors(node) {
  const swapped = { props: {}, children: [] };

  for (const [key, value] of Object.entries(node.props)) {
    if (key === 'AB') {
      swapped.props['AW'] = value;
    } else if (key === 'AW') {
      swapped.props['AB'] = value;
    } else if (key === 'B') {
      swapped.props['W'] = value;
    } else if (key === 'W') {
      swapped.props['B'] = value;
    } else if (key === 'PL') {
      const plValue = value[0] === 'B' ? 'W' : 'B';
      swapped.props['PL'] = [plValue];
    } else {
      swapped.props[key] = value;
    }
  }

  for (const child of node.children) {
    swapped.children.push(swapColors(child));
  }

  return swapped;
}

function nodeToSgf(node) {
  let parts = [';'];
  for (const [key, values] of Object.entries(node.props)) {
    parts.push(key + values.map((v) => '[' + v + ']').join(''));
  }
  let result = parts.join('');
  if (node.children.length === 1) {
    result += '\n' + nodeToSgf(node.children[0]);
  } else if (node.children.length > 1) {
    for (const child of node.children) {
      result += '\n(' + nodeToSgf(child) + ')';
    }
  }
  return result;
}

function processSgf(rawSgf) {
  const tokens = tokenize(rawSgf);
  const rootSgf = parseTokens(tokens);
  if (!rootSgf) return null;

  let trimmed = flattenFirstBranch(rootSgf);

  const sizeVal = trimmed.props.SZ ? parseInt(trimmed.props.SZ[0]) : 19;
  const size = [9, 13, 19].includes(sizeVal) ? sizeVal : 19;

  const firstMoveColor = detectFirstMoveColor(trimmed);
  if (firstMoveColor === 'W') {
    trimmed = swapColors(trimmed);
  }

  const sgf = '(' + nodeToSgf(trimmed) + ')';
  return { sgf, size };
}

async function main() {
  const files = readdirSync(PUZZLE_DIR).filter((f) => f.endsWith('.sgf'));
  console.log(`Found ${files.length} SGF files, importing first ${LIMIT}`);

  const selected = files.slice(0, LIMIT);
  const puzzles = [];

  for (let i = 0; i < selected.length; i++) {
    const filename = selected[i];
    const fileId = filename.replace('.sgf', '');
    const rawSgf = readFileSync(`${PUZZLE_DIR}/${filename}`, 'utf-8');

    const result = processSgf(rawSgf);
    if (!result) {
      console.warn(`  skipping ${filename}: failed to parse`);
      continue;
    }

    puzzles.push({
      _id: `walruswq-${fileId}`,
      sgf: result.sgf,
      size: result.size,
      index: puzzles.length,
      rating: '???',
      plays: 0,
      source: 'walruswq'
    });
  }

  console.log(`Parsed ${puzzles.length} puzzles successfully`);

  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  const collection = db.collection('puzzles');
  await collection.createIndex({ index: 1 }, { unique: true });

  const existing = await collection.countDocuments();
  if (existing > 0) {
    console.log(`Puzzles collection already has ${existing} docs. Drop first? (use --drop)`);
    if (process.argv.includes('--drop')) {
      await collection.drop();
      console.log('Dropped existing puzzles collection');
      await collection.createIndex({ index: 1 }, { unique: true });
    } else {
      await client.close();
      return;
    }
  }

  await collection.insertMany(puzzles);
  console.log(`Inserted ${puzzles.length} puzzles`);

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
