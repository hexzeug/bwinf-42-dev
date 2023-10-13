// Global variables

const struct = [];
const fileMeta = {
  saved: true,
  name: null,
};
const editor = {
  blocked: false,
  ioSelection: false,
};
const drag = {
  type: null,
  origin: null,
  target: null,
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
  if (editor.blocked) return;

  console.log('importing struct from', file);
  const content = await file.text();
  const [meta, ...lines] = content.split(/\r?\n/);
  const [w, h] = meta.split(/ +/).map((x) => parseInt(x));
  if (!w || !h) throw new Error('incorrect format: bad meta line');
  if (lines.length < h) throw new Error('incorrect format: bad height');

  const tokens = lines.slice(0, h).map((line, lineIdx) => {
    const cells = line.split(/ +/).slice(0, w);
    if (cells.length < w) throw new Error('incorrect format: bad width');
    return cells.map((cell) => {
      if (cell.startsWith('Q')) {
        if (lineIdx !== 0)
          throw new Error('incorrect format: bad input position');
        return 'Q';
      }
      if (cell.startsWith('L')) {
        if (lineIdx !== h - 1)
          throw new Error('incorrect format: bad output position');
        return 'L';
      }
      if (['X', 'R', 'r', 'B', 'W'].includes(cell)) return cell;
      throw new Error('incorrect format: bad token', cell);
    });
  });

  if (!clearStruct(w + 4, h, file.name.replace(/\.txt$/, ''))) {
    console.log('canceled import');
    return;
  }

  tokens.forEach((line, i) => {
    for (let j = 0; j < line.length; j++) {
      const cell = line[j];
      const col = i;
      const row = j + 2;
      switch (cell) {
        case 'Q':
          struct.inputs[row] = true;
          break;
        case 'L':
          struct.outputs[row] = true;
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
          if (col === 0 && struct.inputs[row]) {
            text += ('Q' + ++inCount).padEnd(3);
          } else if (col === struct[0].length - 1 && struct.outputs[row]) {
            text += ('L' + ++outCount).padEnd(3);
          } else text += 'X  ';
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
  saveFile(fileMetaName(), text);
  fileMetaExport();
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
        if (hasSensor([row, col + 1])) changes.push([row, col + 1]);
        if (hasSensor([row + 1, col + 1])) changes.push([row + 1, col + 1]);
        break;
      case 'red_bot_input':
        row--;
      case 'red_top_input':
        out = calcBlockOut([row, col]);
        struct[row][col].out = out;
        struct[row + 1][col].out = out;
        if (hasSensor([row, col + 1])) changes.push([row, col + 1]);
        if (hasSensor([row + 1, col + 1])) changes.push([row + 1, col + 1]);
        break;
      case 'blue_top':
      case 'blue_bot':
        struct[row][col].out = calcBlockOut([row, col]);
      case 'empty':
        if (hasSensor([row, col + 1])) changes.push([row, col + 1]);
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
      if (!block.elm) block.elm = document.createElement('div');
      updateElement([row, col]);
      elms.push(block.elm);
    })
  );
  parent.replaceChildren(...elms);
};

const updateElement = ([row, col]) => {
  const { type, elm } = struct[row][col];
  elm.className = '';
  elm.classList.add('block');
  setBlockTypeOnElement(elm, type);
  switch (type) {
    case 'empty':
      if (col !== 0 && struct[row][col - 1].out) elm.classList.add('light');
      if (isTorch([row, col])) {
        elm.classList.add('torch');
        if (struct[row][col].out) elm.classList.add('active');
      }
      if (editor.ioSelection) {
        if (col === struct[0].length - 1 && struct.outputs[row]) {
          elm.classList.add('output');
        } else if (col === 0 && struct.inputs[row]) {
          elm.classList.add('input');
        }
      }
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

const setBlockTypeOnElement = (elm, type) => {
  switch (type) {
    case 'empty':
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
};

// Edit

const handleStructInteraction = async (e) => {
  const elm = e.target;
  if (!elm.classList.contains('block')) return;
  const [row, col] = getBlockPosOfElm(elm);
  const block = struct[row][col];

  switch (e.type) {
    case 'click':
      if (isTorch([row, col])) {
        editStruct('torch', [row, col]);
      }
      if (e.shiftKey && ['red_top', 'red_top_input'].includes(block.type)) {
        editStruct('flip', [row, col]);
      }
      if (editor.ioSelection) {
        editStruct('toggleIO', [row, col]);
      }
      break;
    case 'mousedown':
      if (block.type !== 'empty') {
        await sleep(200, (cancel) => (drag.mousedown = cancel));
        delete drag.mousedown;

        startDrag([row, col], e);
      }
      break;
    case 'mouseout':
      if (drag.mousedown) {
        startDrag([row, col], e);
      }
    case 'mouseup':
      if (drag.mousedown) {
        drag.mousedown();
        delete drag.mousedown;
      }
      break;
  }
};
document
  .querySelector('#struct')
  .addEventListener('click', handleStructInteraction);
document
  .querySelector('#struct')
  .addEventListener('mousedown', handleStructInteraction);
document
  .querySelector('#struct')
  .addEventListener('mouseup', handleStructInteraction);
document
  .querySelector('#struct')
  .addEventListener('mouseout', handleStructInteraction);

const handleDragInteraction = (e) => {
  if (!drag.type) return;
  switch (e.type) {
    case 'mousemove':
      moveDrag(e);
      break;
    case 'mouseup':
      stopDrag(e);
      break;
  }
};
document.addEventListener('mousemove', handleDragInteraction);
document.addEventListener('mouseup', handleDragInteraction);

document.addEventListener('dragstart', (e) => e.preventDefault());

document
  .querySelector('#whiteEditor')
  .addEventListener('mousedown', (e) => startDrag('white_top', e));
document
  .querySelector('#redEditor')
  .addEventListener('mousedown', (e) => startDrag('red_top_input', e));
document
  .querySelector('#blueEditor')
  .addEventListener('mousedown', (e) => startDrag('blue_top', e));

const handleKeybord = (e) => {
  switch (e.key) {
    case 'Escape':
      if (e.type === 'keyup') {
        if (editor.ioSelection) toggleIOSelection();
        if (drag.type) {
          drag.target = null;
          stopDrag({ shiftKey: false });
        }
      }
      break;
    case 'Shift':
      if (drag.type === 'red_top_input') {
        drag.elm.classList.toggle('flipped', e.type === 'keydown');
      } else if (drag.type === 'red_top') {
        drag.elm.classList.toggle('flipped', e.type === 'keyup');
      }
      break;
  }
};
document.addEventListener('keydown', handleKeybord);
document.addEventListener('keyup', handleKeybord);

const startDrag = (from, { x, y }) => {
  if (editor.blocked) return;
  if (drag.type) return;
  if (Array.isArray(from)) {
    const [row, col] = from;
    drag.type = struct[row][col].type;
    drag.origin = from;
    drag.target = from;
    editStruct('delete', from);
  } else {
    drag.type = from;
    drag.origin = null;
    drag.target = null;
  }
  drag.elm = document.createElement('div');
  drag.elm.classList.add('block', 'hover');
  setBlockTypeOnElement(drag.elm, drag.type);
  document.querySelector('#drag').replaceChildren(drag.elm);
  document.querySelector('#struct').classList.add('grid');
  moveDrag({ x, y });
};

const moveDrag = ({ x, y }) => {
  const SIZE = drag.elm.clientWidth;
  const MAX_DIST = 10 * SIZE;

  const elm = document.elementFromPoint(x, y - SIZE / 2);
  if (elm.parentElement.id === 'struct' && elm.classList.contains('block')) {
    const [row, col] = getBlockPosOfElm(elm);
    if (
      row + 1 < struct.length &&
      struct[row][col].type === 'empty' &&
      struct[row + 1][col].type === 'empty'
    ) {
      drag.target = [row, col];
    } else {
      drag.target = null;
    }
  } else if (elm.id === 'struct' || elm.parentElement.id === 'struct') {
    let min = Infinity;
    let blockPos;
    struct
      .flatMap((x, row) => {
        if (row + 1 === struct.length) {
          return [];
        } else if (row === 0 || row + 2 === struct.length) {
          return x.map((_, col) => [row, col]);
        } else {
          return [
            [row, 0],
            [row, x.length - 1],
          ];
        }
      })
      .forEach(([row, col]) => {
        const { x: blockX, y: blockY } =
          struct[row][col].elm.getBoundingClientRect();
        const dist =
          (x - blockX - SIZE / 2) ** 2 + (y - blockY - SIZE / 2) ** 2;
        if (dist < min) {
          min = dist;
          blockPos = [row, col];
        }
      });
    drag.target = min < MAX_DIST ** 2 ? blockPos : null;
  } else {
    drag.target = null;
  }
  if (drag.target) {
    const [row, col] = drag.target;
    const { x, y } = struct[row][col].elm.getBoundingClientRect();
    drag.elm.style.left = x + 'px';
    drag.elm.style.top = y + 'px';
    document.body.style.cursor = 'grab';
  } else {
    drag.elm.style.left = x - SIZE / 2 + 'px';
    drag.elm.style.top = y - SIZE + 'px';
    document.body.style.cursor = 'grabbing';
  }
};

const stopDrag = ({ shiftKey }) => {
  if (drag.target) {
    if (shiftKey) {
      if (drag.type === 'red_top_input') {
        drag.type = 'red_top';
      } else if (drag.type === 'red_top') {
        drag.type = 'red_top_input';
      }
    }
    editStruct('insert_shrink', drag.target, drag.type);
  } else if (drag.origin) {
    editStruct('shrink');
  }
  drag.type = null;
  drag.origin = null;
  drag.target = null;
  delete drag.elm;
  document.querySelector('#drag').replaceChildren();
  document.querySelector('#struct').classList.remove('grid');
  document.body.style.cursor = '';
};

const editStruct = (operation, [row, col] = [0, 0], type = null) => {
  if (operation === 'toggleIO') {
    if (col === struct[0].length - 1) {
      struct.outputs[row] = !struct.outputs[row];
    } else if (col === 0) {
      struct.inputs[row] = !struct.inputs[row];
    } else {
      return;
    }
    fileMetaEdit();
    render();
    return;
  }

  if (editor.blocked) return;

  const block = struct[row][col];
  const blockBot = struct[row + 1][col];
  let resized = false;
  switch (operation) {
    case 'torch':
      block.out = !block.out;
      fastUpdate([row, col]);
      render();
      return;
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
      break;
    case 'insert':
    case 'insert_shrink':
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
      if (operation === 'insert') {
        const top = Math.max(0, 2 - row);
        const bottom = Math.max(0, 4 + row - struct.length);
        const left = Math.max(0, 1 - col);
        const right = Math.max(0, 2 + col - struct[0].length);
        row += top;
        col += left;
        resized = top + bottom + left + right > 0;
        if (resized) resizeStruct(top, bottom, left, right);
        break;
      }
    case 'shrink':
      {
        const empty = struct.every((x) =>
          x.every((block) => block.type === 'empty')
        );
        const top = empty
          ? 0
          : 2 -
            struct.findIndex((x) => x.some((block) => block.type !== 'empty'));
        const bottom =
          3 +
          struct.findLastIndex((x) =>
            x.some((block) => block.type !== 'empty')
          ) -
          struct.length;
        const left = empty
          ? 0
          : 1 -
            struct[0].findIndex((_, col) =>
              struct.some((x) => x[col].type !== 'empty')
            );
        const right =
          2 +
          struct[0].findLastIndex((_, col) =>
            struct.some((x) => x[col].type !== 'empty')
          ) -
          struct[0].length;
        row += top;
        col += left;
        resized = (top | bottom | left | right) !== 0;
        if (resized) resizeStruct(top, bottom, left, right);
      }
      break;
  }
  fileMetaEdit();
  if (operation !== 'shrink') fastUpdate([row, col], [row + 1, col]);
  if (resized) {
    renderAfterResize();
  } else {
    render();
  }
};

document.querySelector('#clear').addEventListener('click', () => {
  if (clearStruct(2, 1)) renderAfterResize();
});

const clearStruct = (rows, cols, name = 'nandu') => {
  if (editor.blocked) return;

  if (
    !fileMeta.saved &&
    !confirm("You haven't saved the current struct.\nThis will delete it.")
  ) {
    return false;
  }

  fileMetaLoad(name);

  struct.length = rows;
  for (let i = 0; i < rows; i++) {
    struct[i] = new Array(cols).fill(null).map(createBlock);
  }

  struct.inputs = new Array(rows).fill(false);
  struct.outputs = new Array(rows).fill(false);

  return true;
};

const resizeStruct = (top, bottom, left, right) => {
  struct.forEach((x) => {
    x.splice(
      0,
      -left,
      ...new Array(Math.max(0, left)).fill(null).map(createBlock)
    );
    x.splice(
      x.length + right,
      Infinity,
      ...new Array(Math.max(0, right)).fill(null).map(createBlock)
    );
  });
  const cols = struct[0].length;
  struct.splice(
    0,
    -top,
    ...new Array(Math.max(0, top))
      .fill(null)
      .map(() => new Array(cols).fill(null).map(createBlock))
  );
  struct.inputs.splice(0, -top, ...new Array(Math.max(0, top)).fill(false));
  struct.outputs.splice(0, -top, ...new Array(Math.max(0, top)).fill(false));
  struct.splice(
    struct.length + bottom,
    Infinity,
    ...new Array(Math.max(0, bottom))
      .fill(null)
      .map(() => new Array(cols).fill(null).map(createBlock))
  );
  struct.inputs.splice(
    struct.length + bottom,
    Infinity,
    ...new Array(Math.max(0, bottom)).fill(false)
  );
  struct.outputs.splice(
    struct.length + bottom,
    Infinity,
    ...new Array(Math.max(0, bottom)).fill(false)
  );
};

// Edit utils

const blockEditor = (block) => {
  if (block === editor.blocked) return;
  editor.blocked = block;
  document
    .querySelectorAll('.editorButton')
    .forEach((elm) => (elm.disabled = block));
};

const getBlockPosOfElm = (elm) => {
  let pos = 0;
  let pointer = elm;
  while ((pointer = pointer.previousElementSibling)) pos++;
  const col = pos % struct[0].length;
  const row = (pos - col) / struct[0].length;
  return [row, col];
};

const hasSensor = ([row, col]) =>
  !['empty', 'red_top', 'red_bot'].includes(struct[row][col].type);

const isTorch = ([row, col]) =>
  col === 0 &&
  struct[0].length > 1 &&
  (struct.inputs[row] || hasSensor([row, 1]));

const createBlock = () => ({ type: 'empty', out: false });

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

  if (editor.blocked) return;

  if (!struct.inputs.includes(true) || !struct.outputs.includes(true)) {
    alert("You have to select at least one input and one output.");
    return;
  }

  const animate = document.querySelector('#animateTable').checked;

  const lines = [];
  let inWidth, outWidth;
  let inSize, outSize;
  if (animate) blockEditor(true);
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
  if (animate) blockEditor(false);
  const inHeader = new Array(inSize)
    .fill(null)
    .map((_, i) => ('Q' + (i + 1)).padEnd(inWidth))
    .join(SP);
  const outHeader = new Array(outSize)
    .fill(null)
    .map((_, i) => ('L' + (i + 1)).padEnd(outWidth))
    .join(SP);
  const table = inHeader + SEP + outHeader + NL + lines.join(NL) + NL;
  saveFile(`${fileMetaName()}_table`, table);
};

const inputIterator = function* () {
  const inputs = struct.inputs
    .map((x, row) => (x ? row : null))
    .filter(Boolean);
  const outputs = struct.outputs
    .map((x, row) => (x ? row : null))
    .filter(Boolean);
  for (const i of binaryIterator(inputs.length)) {
    const row = inputs[i];
    struct[row][0].out = !struct[row][0].out;
    fastUpdate([row, 0]);
    const ins = inputs.map((row) => struct[row][0].out);
    const outs = outputs.map((row) => struct[row][struct[0].length - 2].out);
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

// Select IO

const toggleIOSelection = () => {
  if (editor.ioSelection) {
    blockEditor(false);
    editor.ioSelection = false;
  } else {
    if (editor.blocked) return;
    blockEditor(true);
    editor.ioSelection = true;
  }
  document
    .querySelector('#selectIO')
    .classList.toggle('active', editor.ioSelection);
  render();
};
document
  .querySelector('#selectIO')
  .addEventListener('click', toggleIOSelection);

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

const fileMetaEdit = () => {
  fileMeta.saved = false;
};

const fileMetaLoad = (name) => {
  fileMeta.saved = true;
  fileMeta.name = name;
  document.querySelector('#name').value = name;
};

document.querySelector('#name').addEventListener('change', (e) => {
  fileMeta.name = e.target.value;
});

const fileMetaName = () => (fileMeta.name.length > 0 ? fileMeta.name : 'nandu');

const fileMetaExport = () => {
  fileMeta.saved = true;
};

// Load inital page

clearStruct(2, 1);
renderAfterResize();
