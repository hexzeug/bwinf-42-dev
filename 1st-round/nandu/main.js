class List {
  constructor() {
    this.head = null;
  }

  add(value) {
    const node = {
      value,
      next: this.head,
      prev: null,
      list: this,
    };
    if (this.head) this.head.prev = node;
    this.head = node;
    return () => {
      if (!node.list) return;
      if (node.next) node.next.prev = node.prev;
      if (node.prev) node.prev.next = node.next;
      else node.list.head = node.next;
      node.list = null;
    };
  }

  *[Symbol.iterator]() {
    let node = this.head;
    while (node) {
      yield node.value;
      node = node.next;
    }
  }

  clear() {
    let node = this.head;
    while (node) {
      node.list = null;
      node = node.next;
    }
    this.head = null;
  }
}

document.querySelector('#importFile').addEventListener(
  'change',
  (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'text/plain') uploadStruct(file);
  },
  false
);

document.addEventListener(
  'drop',
  (e) => {
    e.stopPropagation();
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/plain') uploadStruct(file);
  },
  false
);

const struct = new List();

const isIO = (block) => ['torch', 'light'].includes(block.type);

const uploadStruct = async (file) => {
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

  struct.clear();
  document.getElementById('struct').replaceChildren();

  let colBuf = new Array(w);
  let firstCol;

  for (let i = 0; i < h; i++) {
    const cells = tokens[i];

    const column = new Array(w);
    for (let j = 0; j < w; j++) {
      const cell = cells[j];
      let block;

      switch (cell) {
        case 'X':
          continue;
        case 'Q':
          block = {
            type: 'torch',
            count: true,
            out: false,
          };
          break;
        case 'L':
          block = {
            type: 'light',
            count: true,
            out: false,
            prev: colBuf[j],
          };
          if (colBuf[j].pos[1] === j) colBuf[j].nextTop = block;
          else colBuf[j].nextBot = block;
          break;
        case 'W':
          block = { type: 'white', out: true };
          break;
        case 'B':
          block = { type: 'blue', outTop: false, outBot: false };
          break;
        case 'R':
          block = { type: 'red', flipped: false, out: true };
          break;
        case 'r':
          block = { type: 'red', flipped: true, out: true };
          break;
      }

      block.pos = [i, j];
      if (block.type != 'light') column[j] = block;
      if (!isIO(block)) {
        column[j + 1] = block;
        if (block.type === 'red') {
          block.prev = colBuf[j + block.flipped];
        } else {
          block.prevTop = colBuf[j];
          block.prevBot = colBuf[j + 1];
        }

        for (let k = 0; k < 2; k++) {
          if (!colBuf[j]) {
            if (i === 1) {
              const torch = {
                type: 'torch',
                pos: [i - 1, j],
                count: false,
                out: false,
              };
              if (block.type !== 'red' || (k === 0) !== block.flipped)
                torch.next = block;
              torch.remover = struct.add(torch);
            }
          } else if (isIO(colBuf[j])) {
            colBuf[j].next = block;
          } else if (colBuf[j].pos[1] === j) {
            colBuf[j].nextTop = block;
          } else {
            colBuf[j].nextBot = block;
          }
          j++;
        }
        j--;
      }

      block.remover = struct.add(block);
    }
    for (const block of colBuf) {
      if (!block || isIO(block)) continue;
      if (!block.nextTop && !column[block.pos[1]]) {
        const light = {
          type: 'light',
          pos: [i, block.pos[1]],
          count: false,
          out: false,
          prev: block,
        };
        light.remover = struct.add(light);
        block.nextTop = light;
      }
      if (!block.nextBot && !column[block.pos[1] + 1]) {
        const light = {
          type: 'light',
          pos: [i, block.pos[1] + 1],
          count: false,
          out: false,
          prev: block,
        };
        light.remover = struct.add(light);
        block.nextBot = light;
      }
    }

    if (i === 1) firstCol = colBuf.filter((x) => x !== undefined);
    colBuf = column;
  }

  update(...firstCol);
};

const readOut = (block, at) =>
  block.type !== 'blue'
    ? block.out
    : block.pos[1] === at
    ? block.outTop
    : block.outBot;

const update = (...startBlocks) => {
  updateSilently(...startBlocks).forEach(updateElement);
};

const updateSilently = (...startBlocks) => {
  for (const block of startBlocks) {
    switch (block.type) {
      case 'light':
        block.out = readOut(block.prev, block.pos[1]);
        break;
      case 'white':
        block.out = !(
          readOut(block.prevTop, block.pos[1]) &&
          readOut(block.prevBot, block.pos[1] + 1)
        );
        break;
      case 'red':
        block.out = !readOut(block.prev, block.pos[1] + block.flipped);
        break;
      case 'blue':
        block.outTop = readOut(block.prevTop, block.pos[1]);
        block.outBot = readOut(block.prevBot, block.pos[1] + 1);
    }
    if (block.next && !block.next.updated) {
      block.next.updated = true;
      startBlocks.push(block.next);
    }
    if (block.nextTop && !block.nextTop.updated) {
      block.nextTop.updated = true;
      startBlocks.push(block.nextTop);
    }
    if (block.nextBot && !block.nextBot.updated) {
      block.nextBot.updated = true;
      startBlocks.push(block.nextBot);
    }
  }
  for (const block of startBlocks) delete block.updated;
  return startBlocks;
};

const updateElement = (block) => {
  const elm = block.elm ? block.elm : document.createElement('div');

  if (!block.elm) {
    block.elm = elm;
    elm.classList.add('block', block.type);
    elm.style = `--x: ${block.pos[0]}; --y: ${block.pos[1]}`;

    switch (block.type) {
      case 'torch':
        elm.addEventListener('click', () => toggleTorch(block));
        break;
      case 'red':
        if (block.flipped) elm.classList.add('flipped');
    }

    document.getElementById('struct').appendChild(elm);
  }

  switch (block.type) {
    case 'torch':
    case 'light':
      if (block.out) elm.classList.add('active');
      else elm.classList.remove('active');
      break;
    case 'white':
    case 'blue':
      if (readOut(block.prevTop, block.pos[1])) elm.classList.add('activeTop');
      else elm.classList.remove('activeTop');
      if (readOut(block.prevBot, block.pos[1] + 1))
        elm.classList.add('activeBot');
      else elm.classList.remove('activeBot');
      break;
    case 'red':
      if (!block.out) elm.classList.add('active');
      else elm.classList.remove('active');
      break;
  }
};

const toggleTorch = (block) => {
  block.out = !block.out;
  update(block);
};
