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

const struct = {
  in: [],
  out: [],
  blocks: new List(),
};

const uploadStruct = async (file) => {
  console.log('importing struct from', file);
  const content = await file.text();
  const [meta, ...lines] = content.split(/\r?\n/);
  const [w, h] = meta.split(/ +/).map((x) => parseInt(x));
  if (!w || !h) throw new Error('incorrect format: bad meta line');
  lines.splice(h);
  if (lines.length < h) throw new Error('incorrect format: bad height');

  struct.in = [];
  struct.out = [];
  struct.blocks = new List();
  for (let i = 0; i < h; i++) {
    const cells = lines[i].split(/ +/).slice(0, w);
    if (cells.length < w) throw new Error('incorrect format: bad width');
    for (let j = 0; j < w; j++) {
      const cell = cells[j];
      if (cell === 'X') continue;
      if (i === 0) {
        if (cell.startsWith('Q')) struct.in.push(j);
        continue;
      }
      if (i === h - 1) {
        if (cell.startsWith('L')) struct.out.push(j);
        continue;
      }

      let block;
      if (cell === 'W') {
        block = { type: 'white', pos: [i, j], out: true };
      } else if (cell === 'B') {
        block = { type: 'blue', pos: [i, j], outTop: false, outBot: false };
      } else if (cell === 'R') {
        block = { type: 'red', pos: [i, j], flipped: false, out: true };
      } else if (cell === 'r') {
        block = { type: 'red', pos: [i, j], flipped: true, out: true };
      } else {
        throw new Error('incorrect format: bad symbol');
      }
      j++;

      const remove = struct.blocks.add(block);
    }

    rerenderStruct();
  }
};

const rerenderStruct = () => {
  const structElm = document.querySelector('#struct');
  const blockElms = [];
  for (const block of struct.blocks) {
    const elm = document.createElement('div');
    elm.classList.add('block', block.type);
    if (block.type === 'red' && block.flipped) elm.classList.add('flipped');
    elm.style = `--x: ${block.pos[0]}; --y: ${block.pos[1]}`;
    blockElms.push(elm);
  }
  structElm.replaceChildren(...blockElms);
};
