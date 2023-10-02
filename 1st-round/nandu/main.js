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
  lines.splice(h);
  if (lines.length < h) throw new Error('incorrect format: bad height');

  struct.clear();
  let colBuf = new Array(w);
  let firstCol;

  for (let i = 0; i < h; i++) {
    const cells = lines[i].split(/ +/).slice(0, w);
    if (cells.length < w) throw new Error('incorrect format: bad width');

    const column = new Array(w);
    for (let j = 0; j < w; j++) {
      const cell = cells[j];
      let block;

      if (cell === 'X') {
        continue;
      } else if (cell.startsWith('Q')) {
        block = {
          type: 'torch',
          count: true,
          out: false,
        };
      } else if (cell.startsWith('L')) {
        block = {
          type: 'light',
          count: true,
          out: false,
          prev: colBuf[j],
        };
        if (colBuf[j].pos[1] === j) colBuf[j].nextTop = block;
        else colBuf[j].nextBot = block;
      } else if (cell === 'W') {
        block = { type: 'white', out: true };
      } else if (cell === 'B') {
        block = { type: 'blue', outTop: false, outBot: false };
      } else if (cell === 'R') {
        block = { type: 'red', flipped: false, out: true };
      } else if (cell === 'r') {
        block = { type: 'red', flipped: true, out: true };
      } else {
        throw new Error('incorrect format: bad symbol');
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

  updateSilently(...firstCol);
  rerenderStruct();
};

const updateSilently = (...queue) => {
  console.log('updating (silently) struct from', queue);

  const extractOut = (block, at) =>
    block.type !== 'blue'
      ? block.out
      : block.pos[1] === at
      ? block.outTop
      : block.outBot;
  for (const block of queue) {
    switch (block.type) {
      case 'light':
        block.out = extractOut(block.prev, block.pos[1]);
        break;
      case 'white':
        block.out = !(
          extractOut(block.prevTop, block.pos[1]) &&
          extractOut(block.prevBot, block.pos[1] + 1)
        );
        break;
      case 'red':
        block.out = !(!block.flipped
          ? extractOut(block.prev, block.pos[1])
          : extractOut(block.prev, block.pos[1] + 1));
        break;
      case 'blue':
        block.outTop = extractOut(block.prevTop, block.pos[1]);
        block.outBot = extractOut(block.prevBot, block.pos[1] + 1);
    }
    if (block.next && !block.next.updated) {
      block.next.updated = true;
      queue.push(block.next);
    }
    if (block.nextTop && !block.nextTop.updated) {
      block.nextTop.updated = true;
      queue.push(block.nextTop);
    }
    if (block.nextBot && !block.nextBot.updated) {
      block.nextBot.updated = true;
      queue.push(block.nextBot);
    }
  }
  for (const block of queue) delete block.updated;
  return queue;
};

const rerenderStruct = () => {
  const structElm = document.querySelector('#struct');
  const blockElms = [];
  for (const block of struct) {
    const elm = document.createElement('div');
    elm.classList.add('block', block.type);
    if (block.type === 'red' && block.flipped) elm.classList.add('flipped');
    if (isIO(block)) elm.classList.add('io');
    elm.style = `--x: ${block.pos[0]}; --y: ${block.pos[1]}`;
    if (isIO(block)) elm.setAttribute('data-debug', block.count);
    block.elm = elm;
    blockElms.push(elm);
  }
  structElm.replaceChildren(...blockElms);
};
