// Utils

const generateName = () => {
  if (!fileMeta.name) return 'nandu';
  if (fileMeta.saved) return fileMeta.name;
  return fileMeta.name + '(modified)';
};

// Global variables

const struct = [
  [{ type: 'empty', out: false }],
  [{ type: 'empty', out: false }],
];
const fileMeta = {
  saved: true,
  name: null,
};

// Import

document.querySelector('#importFile').addEventListener(
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
      elm: createElement(),
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
  render();
  parent.replaceChildren(...struct.flatMap((x) => x.map((block) => block.elm)));
};

const updateElement = ([row, col]) => {
  const { type, elm } = struct[row][col];
  elm.className = '';
  elm.classList.add('block');
  switch (type) {
    case 'empty':
      if (col !== 0 && struct[row][col - 1].out) elm.classList.add('light');
      if (col === 0 && struct[row][1].type !== 'empty')
        elm.classList.add('torch');
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

const createElement = () => {
  const elm = document.createElement('div');
  return elm;
};

// Handle Interaction

document.querySelector('#struct').addEventListener('click', (e) => {
  const elm = e.target;
  if (!elm.classList.contains('block')) return;
  let pos = 0;
  let pointer = elm;
  while ((pointer = pointer.previousElementSibling)) pos++;
  const col = pos % struct[0].length;
  const row = (pos - col) / struct[0].length;
  const block = struct[row][col];
  switch (block.type) {
    case 'empty':
      if (col === 0 && struct[row][1].type !== 'empty') block.out = !block.out;
      fastUpdate([row, col]);
      render();
      break;
  }
});

// Generate table

document
  .querySelector('#generateTable')
  .addEventListener('click', () => generateTable(), false);

const generateTable = () => {
  const inputs = [];
  const outputs = [];
  for (const block of struct) {
    if (!block.count) continue;
    if (block.type === 'torch') inputs.push(block);
    if (block.type === 'light') outputs.push(block);
  }

  const oldInputs = inputs.map((block) => block.out);

  const lines = [];
  for (let i = 0; i < 2 ** inputs.length; i++) {
    const updates = [];
    for (let j = 0; j < inputs.length; j++) {
      const oldOut = inputs[j].out;
      inputs[j].out = (i >> j) & 0x1;
      if (oldOut !== inputs[j].out) updates.push(inputs[j]);
    }
    updateSilently(...updates);
    lines.push(blocksToBin(inputs) + ' ' + blocksToBin(outputs));
  }

  oldInputs.forEach((input, i) => (inputs[i].out = input));
  updateSilently(...inputs);

  saveFile(`${generateName()}_table.txt`, lines.join('\n'));
};

const saveFile = (name, content) => {
  console.log('save to', name);
  console.log(content);
};
