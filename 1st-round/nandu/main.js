// Global variables

const struct = [
  [{ type: 'empty', out: false }],
  [{ type: 'empty', out: false }],
];
const fileMeta = {
  saved: true,
  name: null,
};
const tableAnimation = {
  running: false,
};

// Utils

const sleep = (time, cancel = new Function()) => {
  return new Promise((r) => {
    const id = setTimeout(r, time);
    cancel(() => clearTimeout(id));
  });
};

// Import

document.querySelector('#importStruct').addEventListener(
  'change',
  (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'text/plain') importStruct(file);
  },
  false
);

document.addEventListener(
  'drop',
  (e) => {
    e.stopPropagation();
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/plain') importStruct(file);
  },
  false
);

const importStruct = async (file) => {
  console.log('importing struct from', file);
  const content = await file.text();
  const [meta, ...lines] = content.split(/\r?\n/);
  const [w, h] = meta.split(/ +/).map((x) => parseInt(x));
  if (!w || !h) throw new Error('incorrect format: bad meta line');
  if (lines.length < h) throw new Error('incorrect format: bad height');

  const tokens = lines.slice(0, h).map((line) => {
    const cells = line.split(/ +/).slice(0, w);
    if (cells.length < w) throw new Error('incorrect format: bad width');
    return cells.map((cell) => {
      if (cell.startsWith('Q')) return 'Q';
      if (cell.startsWith('L')) return 'L';
      if (['X', 'R', 'r', 'B', 'W'].includes(cell)) return cell;
      throw new Error('incorrect format: bad token', cell);
    });
  });

  if (
    !fileMeta.saved &&
    !confirm("You haven't saved the current struct.\nThis will override it.")
  ) {
    console.log('canceled import');
    return;
  }

  fileMeta.saved = true;
  fileMeta.name = file.name.replace(/\.txt$/, '');

  struct.length = w + 4;
  for (let i = 0; i < struct.length; i++)
    struct[i] = Array.from({ length: h }, () => ({
      type: 'empty',
      out: false,
    }));

  tokens.forEach((line, i) => {
    for (let j = 0; j < line.length; j++) {
      const cell = line[j];
      const col = i;
      const row = j + 2;
      switch (cell) {
        case 'Q':
          struct[row][col].input = true;
          break;
        case 'L':
          struct[row][col].output = true;
          break;
        case 'W':
          struct[row][col].type = 'white_top';
          struct[row + 1][col].type = 'white_bot';
          j++;
          break;
        case 'B':
          struct[row][col].type = 'blue_top';
          struct[row + 1][col].type = 'blue_bot';
          j++;
          break;
        case 'R':
          struct[row][col].type = 'red_top_input';
          struct[row + 1][col].type = 'red_bot';
          j++;
          break;
        case 'r':
          struct[row][col].type = 'red_top';
          struct[row + 1][col].type = 'red_bot_input';
          j++;
          break;
      }
    }
  });

  slowUpdate();
  renderAfterResize();
};

// Export

document
  .querySelector('#exportStruct')
  .addEventListener('click', () => exportStruct());

const exportStruct = () => {
  const SP = ' ';
  const NL = '\n';

  let text = struct.length + SP + struct[0].length + NL;
  let inCount = 0;
  let outCount = 0;
  struct[0].forEach((_, col) => {
    struct.forEach((_, row) => {
      if (row < 2 || row >= struct.length - 2) return;
      switch (struct[row][col].type) {
        case 'empty':
          if (struct[row][col].input) text += ('Q' + ++inCount).padEnd(3);
          else if (struct[row][col].output)
            text += ('L' + ++outCount).padEnd(3);
          else text += 'X  ';
          break;
        case 'white_top':
        case 'white_bot':
          text += 'W  ';
          break;
        case 'red_top_input':
        case 'red_bot_input':
          text += 'R  ';
          break;
        case 'red_top':
        case 'red_bot':
          text += 'r  ';
          break;
        case 'blue_top':
        case 'blue_bot':
          text += 'B  ';
          break;
      }
    });
    text += NL;
  });
  saveFile(generateName(), text);
};

// Update

const slowUpdate = () => {
  for (const col of struct[0].keys()) {
    for (const row of struct.keys()) {
      struct[row][col].out = calcBlockOut([row, col]);
    }
  }
};

const fastUpdate = (...changes) => {
  const updatable = ([row, col]) =>
    !['empty', 'red_top', 'red_bot'].includes(struct[row][col].type);
  for (let [row, col] of changes) {
    let out;
    switch (struct[row][col].type) {
      case 'white_bot':
        row--;
      case 'white_top':
        out = calcBlockOut([row, col]);
        if (struct[row][col].out === out) break;
        struct[row][col].out = out;
        struct[row + 1][col].out = out;
        if (updatable([row, col + 1])) changes.push([row, col + 1]);
        if (updatable([row + 1, col + 1])) changes.push([row + 1, col + 1]);
        break;
      case 'red_bot_input':
        row--;
      case 'red_top_input':
        out = calcBlockOut([row, col]);
        struct[row][col].out = out;
        struct[row + 1][col].out = out;
        if (updatable([row, col + 1])) changes.push([row, col + 1]);
        if (updatable([row + 1, col + 1])) changes.push([row + 1, col + 1]);
        break;
      case 'blue_top':
      case 'blue_bot':
        struct[row][col].out = calcBlockOut([row, col]);
      case 'empty':
        if (updatable([row, col + 1])) changes.push([row, col + 1]);
        break;
    }
  }
  return changes;
};

const calcBlockOut = ([row, col]) => {
  switch (struct[row][col].type) {
    case 'white_top':
      return !(struct[row][col - 1].out && struct[row + 1][col - 1].out);
    case 'white_bot':
      return !(struct[row][col - 1].out && struct[row - 1][col - 1].out);
    case 'blue_top':
    case 'blue_bot':
      return struct[row][col - 1].out;
    case 'red_top_input':
    case 'red_bot_input':
      return !struct[row][col - 1].out;
    case 'red_top':
      return !struct[row + 1][col - 1].out;
    case 'red_bot':
      return !struct[row - 1][col - 1].out;
    default:
      return struct[row][col].out;
  }
};

// Render

const render = () => {
  struct.forEach((x, row) => x.forEach((_, col) => updateElement([row, col])));
};

const renderAfterResize = () => {
  const parent = document.querySelector('#struct');
  parent.style.setProperty('--rows', struct.length);
  parent.style.setProperty('--cols', struct[0].length);
  const elms = [];
  struct.forEach((x, row) =>
    x.forEach((block, col) => {
      if (!block.elm) block.elm = createElement();
      updateElement([row, col]);
      elms.push(block.elm);
    })
  );
  parent.replaceChildren(...elms);
};

const createElement = () => {
  const elm = document.createElement('div');
  return elm;
};

const updateElement = ([row, col]) => {
  const { type, elm } = struct[row][col];
  elm.className = '';
  elm.classList.add('block');
  switch (type) {
    case 'empty':
      if (col !== 0 && struct[row][col - 1].out) elm.classList.add('light');
      if (isTorch([row, col])) elm.classList.add('torch');
    case 'white_bot':
    case 'red_bot':
    case 'red_bot_input':
    case 'blue_bot':
      elm.classList.add('empty');
      break;
    case 'white_top':
      elm.classList.add('white');
      break;
    case 'red_top':
      elm.classList.add('flipped');
    case 'red_top_input':
      elm.classList.add('red');
      break;
    case 'blue_top':
      elm.classList.add('blue');
      break;
  }
  switch (type) {
    case 'empty':
      if (elm.classList.contains('torch') && struct[row][col].out)
        elm.classList.add('active');
      break;
    case 'white_top':
    case 'red_top':
    case 'red_top_input':
    case 'blue_top':
      if (struct[row][col - 1].out) elm.classList.add('activeTop');
      if (struct[row + 1][col - 1].out) elm.classList.add('activeBot');
      break;
  }
};

// Edit

const structElm = document.querySelector('#struct');

const handleStructInteraction = async (e) => {
  if (tableAnimation.running) return;
  const elm = e.target;
  if (!elm.classList.contains('block')) return;
  const [row, col] = getBlockPosOfElm(elm);
  const block = struct[row][col];
  switch (e.type) {
    case 'click':
      if (isTorch([row, col])) {
        editStruct('torch', [row, col]);
      }
      // todo temporary
      if (
        block.type === 'empty' &&
        struct.length > row + 1 &&
        struct[row + 1][col].type === 'empty'
      ) {
        if (e.shiftKey) {
          editStruct('insert', [row, col], 'white_top');
        } else if (e.ctrlKey) {
          editStruct('insert', [row, col], 'red_top');
        } else if (e.altKey) {
          editStruct('insert', [row, col], 'blue_top');
        }
      }
      break;
    case 'dblclick':
      if (['red_top', 'red_top_input'].includes(block.type)) {
        editStruct('flip', [row, col]);
      }
      break;
    case 'mousedown':
      if (block.type !== 'empty') {
        await sleep(200, (cancel) => (block.mousedown = cancel));
        delete block.mousedown;
        editStruct('delete', [row, col]);
      }
      break;
    case 'mouseup':
      if (block.mousedown) {
        block.mousedown();
        delete block.mousedown;
      }
      break;
  }
};

structElm.addEventListener('click', handleStructInteraction);
structElm.addEventListener('dblclick', handleStructInteraction);
structElm.addEventListener('mousedown', handleStructInteraction);
structElm.addEventListener('mouseup', handleStructInteraction);

const editStruct = (operation, [row, col], type = null) => {
  const block = struct[row][col];
  const blockBot = struct[row + 1][col];
  switch (operation) {
    case 'torch':
      block.out = !block.out;
      break;
    case 'flip':
      if (block.type === 'red_top') {
        block.type = 'red_top_input';
        blockBot.type = 'red_bot';
      } else {
        block.type = 'red_top';
        blockBot.type = 'red_bot_input';
      }
      break;
    case 'delete':
      block.type = 'empty';
      block.out = false;
      blockBot.type = 'empty';
      blockBot.out = false;
      delete struct[row][col + 1]?.output;
      delete struct[row + 1][col + 1]?.output;
      delete struct[row][col - 1]?.input;
      delete struct[row + 1][col - 1]?.input;
      // todo check for resize
      break;
    case 'insert':
      delete block.input;
      delete block.output;
      delete blockBot.input;
      delete blockBot.output;
      block.type = type;
      switch (type) {
        case 'white_top':
          blockBot.type = 'white_bot';
          break;
        case 'red_top':
          blockBot.type = 'red_bot_input';
          break;
        case 'red_top_input':
          blockBot.type = 'red_bot';
          break;
        case 'blue_top':
          blockBot.type = 'blue_bot';
          break;
      }
      // todo check for resize
      break;
  }
  if (operation === 'torch') {
    fastUpdate([row, col]);
  } else {
    fileMeta.saved = false;
    fastUpdate([row, col], [row + 1, col]);
  }
  render();
};

// Edit utils

const getBlockPosOfElm = (elm) => {
  let pos = 0;
  let pointer = elm;
  while ((pointer = pointer.previousElementSibling)) pos++;
  const col = pos % struct[0].length;
  const row = (pos - col) / struct[0].length;
  return [row, col];
};

const isTorch = ([row, col]) =>
  col === 0 &&
  struct[row][0].type === 'empty' &&
  struct[0].length > 1 &&
  struct[row][1].type !== 'empty';

// Generate table

document
  .querySelector('#generateTable')
  .addEventListener('click', () => generateTable());

const generateTable = async () => {
  const ON = '#';
  const OFF = '.';
  const SP = ' ';
  const SEP = ' | ';
  const NL = '\n';
  const FPS = 8;

  if (tableAnimation.running) return;
  const animate = document.querySelector('#animateTable').checked;

  const lines = [];
  let inWidth, outWidth;
  let inSize, outSize;
  if (animate) tableAnimation.running = true;
  for (const [i, inputs, outputs] of inputIterator()) {
    if (!inSize) inSize = inputs.length;
    if (!outSize) outSize = outputs.length;
    if (!inWidth) inWidth = Math.floor(Math.log10(inSize)) + 2;
    if (!outWidth) outWidth = Math.floor(Math.log10(outSize)) + 2;
    const inText = inputs
      .map((inp) => (inp ? ON : OFF).padEnd(inWidth))
      .join(SP);
    const outText = outputs
      .map((inp) => (inp ? ON : OFF).padEnd(outWidth))
      .join(SP);
    lines[i] = inText + SEP + outText;
    if (animate) {
      render();
      await sleep(1000 / FPS);
    }
  }
  if (animate) tableAnimation.running = false;
  const inHeader = new Array(inSize)
    .fill(null)
    .map((_, i) => ('Q' + (i + 1)).padEnd(inWidth))
    .join(SP);
  const outHeader = new Array(outSize)
    .fill(null)
    .map((_, i) => ('L' + (i + 1)).padEnd(outWidth))
    .join(SP);
  const table = inHeader + SEP + outHeader + NL + lines.join(NL) + NL;
  saveFile(generateName() + '_table', table);
};

const inputIterator = function* () {
  const inputs = [];
  const outputs = [];
  struct.forEach((x, row) =>
    x.forEach((block, col) => {
      if (block.input) inputs.push([row, col]);
      if (block.output) outputs.push([row, col]);
    })
  );
  for (const i of binaryIterator(inputs.length)) {
    const [row, col] = inputs[i];
    struct[row][col].out = !struct[row][col].out;
    fastUpdate([row, col]);
    const ins = inputs.map(([row, col]) => struct[row][col].out);
    const outs = outputs.map(([row, col]) => struct[row][col - 1].out);
    const idx = ins.reduce((p, c, i) => p | (c << (ins.length - 1 - i)), 0);
    yield [idx, ins, outs];
  }
};

const binaryIterator = function* (exponent, reversed = false, top = true) {
  if (exponent < 1) return;
  yield* binaryIterator(exponent - 1, reversed, false);
  yield exponent - 1;
  yield* binaryIterator(exponent - 1, !reversed, false);
  if (top) yield exponent - 1;
};

// Handle files

const saveFile = (name, content) => {
  if (!name.includes('.')) name += '.txt';
  const file = new File([content], name, { type: 'text/plain' });
  console.log('downloading', file);
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
};

const generateName = () => {
  if (!fileMeta.name) return 'nandu';
  if (fileMeta.saved) return fileMeta.name;
  return fileMeta.name + '(modified)';
};

// Load inital page

renderAfterResize();
