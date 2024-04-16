setTimeout(() => {
  if (document.getElementById('enc').value === '') {
    let enc;
    const lang = navigator.languages
        ? navigator.languages[0]
        : (navigator.language || navigator.userLanguage);
    switch (lang.slice(0, 2)) {
      case 'ru':
      case 'ua':
      case 'be': enc = 'cp866'; break;
      case 'iw': enc = 'cp856'; break;
      case 'ar': enc = 'cp864'; break;
      case 'zh': enc = 'cp936'; break;
      default: enc = 'cp437';
    }
    document.getElementById('enc').value = enc;
  }
}, 999);
zip.filenameEncoding = () => document.getElementById('enc').value;

const createElement = async (entry) => {
  const i = entry.uncompressedSize === 0 ? 0 : Math.floor(Math.log(entry.uncompressedSize) / Math.log(1024));
  const size = +((entry.uncompressedSize / Math.pow(1024, i)).toFixed(2)) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
  const fn = document.getElementById('fn');
  fn.textContent = `[${size}] ${entry.filename}`;
  if (entry.uncompressedSize > 1024 * 1024 * 100) {
    if (!confirm(`The file size (${size}) is too large. Do you really want to view it?`)) {
      const span = document.createElement('span');
      span.textContent = 'Large file';
      return span;
    }
  }
  const opt = { password: document.getElementById('pwd').value };

  let blob = await entry.getData(new zip.BlobWriter(), opt);
  let buf = await blob.arrayBuffer();
  const mimetype = zip.getMimeType(buf);
  switch (mimetype.split('/')[0]) {
    case 'text': {
      const text = document.createElement('textarea');
      text.textContent = new TextDecoder().decode(new Uint8Array(buf));
      return text;
    }
    case 'image': {
      const image = new Image();
      try {
        blob = blob.slice(0, blob.size, mimetype);
      } catch (ex) {
        blob = new Blob([buf], { type: mimetype });
      }
      image.src = URL.createObjectURL(blob);
      image.addEventListener('load', () => URL.revokeObjectURL(image.src));
      return image;
    }
  }
};

const toTree = async (zipReader) => {
  const entries = await zipReader.getEntries();

  const table = {};
  entries.forEach(e => table[e.filename] = e);
  entries.forEach((e) => {
    if (e.filename.endsWith('/')) return;
    let fn = e.filename;
    while (fn.indexOf('/') > 0) {
      const i = fn.lastIndexOf('/');
      const key = fn.slice(0, i + 1);
      if (!table.hasOwnProperty(key)) {
        const entry = { filename: key, entries: [] };
        table[key] = entry;
        entries.push(entry);
      }
      fn = key.slice(0, -1);
    }
  });

  const root = [];
  entries.forEach((e) => {
    const path = e.filename.split('/');
    if (path.at(-1).length === 0) {
      if (path.length === 2) {
        root.push(e);
      } else {
        const i = e.filename.lastIndexOf('/', e.filename.length - 2);
        const parent = table[e.filename.slice(0, i + 1)];
        e.parent = parent;
        parent.entries.push(e);
      }
      e.entries = e.entries || [];
    } else {
      if (path.length === 1) {
        root.push(e);
      } else {
        const i = e.filename.lastIndexOf('/');
        const parent = table[e.filename.slice(0, i + 1)];
        e.parent = parent;
        parent.entries.push(e);
      }
    }
  });
  return root;
};

document.getElementById('src').onchange = async (e) => {
  if (e.target.files.length === 0) return;
  document.getElementById('view').innerHTML = '';
  document.getElementById('fn').innerHTML = '';

  const ul = document.getElementById('tree');
  ul.innerHTML = '';

  let tree;
  try {
    const blobReader = new zip.BlobReader(e.target.files[0]);
    const zipReader = new zip.ZipReader(blobReader, { filenameEncoding: zip.filenameEncoding() });
    tree = await toTree(zipReader);
  } catch (ex) {
    return alert(ex.message);
  }

  const populate = (ul1, entry) => {
    const li = document.createElement('li');
    const text = document.createElement('span');
    let caption = entry.filename.slice(entry.filename.lastIndexOf('/', entry.filename.length - 2) + 1);
    text.textContent = entry.entries ? caption.slice(0, -1) : caption;
    text.entry = entry;
    if (entry.entries) {
      const button = document.createElement('button');
      button.classList.add('hide');
      li.appendChild(button).textContent = '+';
    }
    li.appendChild(text);

    if (entry.entries) {
      const ul2 = document.createElement('ul');
      entry.entries.forEach(e2 => populate(ul2, e2));
      li.appendChild(ul2);
    }

    return ul1.appendChild(li);
  };
  ul.innerHTML = '';
  tree.forEach(entry => populate(ul, entry));
};

zip.getMimeType = (buf) => {
  let a = new Uint8Array(buf, 0, 12);
  if (a[0] === 0xFF && a[1] === 0xD8 && a[2] === 0xFF) return 'image/jpeg';
  if (a[0] === 0x89 && a[1] === 0x50 && a[2] === 0x4E && a[3] === 0x47 && a[4] === 0x0D
    && a[5] === 0x0A && a[6] === 0x1A && a[7] === 0x0A) return 'image/png';
  if (a[0] === 0xFF && a[1] === 0x4F && a[2] === 0xFF && a[3] === 0x51
    || a[0] === 0x00 && a[1] === 0x00 && a[2] === 0x00 && a[3] === 0x0C
    && a[4] === 0x6A && a[5] === 0x50 && a[6] === 0x20 && a[7] === 0x20
    && a[8] === 0x0D && a[9] === 0x0A && a[10] === 0x87 && a[11] === 0x0A) return 'image/jp2';
  if (a[0] === 0x49 && a[1] === 0x49 && a[2] === 0x2A && a[3] === 0x00
    || a[0] === 0x4D && a[1] === 0x4D && a[2] === 0x00 && a[3] === 0x2A) return 'image/tiff';
  if (a[0] === 0x47 && a[1] === 0x49 && a[2] === 0x46 && a[3] === 0x38 && a[4] === 0x37 && a[5] === 0x61
    || a[0] === 0x47 && a[1] === 0x49 && a[2] === 0x46 && a[3] === 0x38 && a[4] === 0x39 && a[5] === 0x61) return 'image/gif';
  if (a[0] === 0x00 && a[1] === 0x00 && a[2] === 0x01 && a[3] === 0x00) return 'image/vnd.microsoft.icon';
  if (a[0] === 0x42 && a[1] === 0x4D) return 'image/bmp';
  if (a[0] === 0x52 && a[1] === 0x49 && a[2] === 0x46 && a[3] === 0x46
    && a[8] === 0x57 && a[9] === 0x45 && a[10] === 0x42 && a[11] === 0x50) return 'image/webp';
  if (a[0] === 0x8A && a[1] === 0x4D && a[2] === 0x4E && a[3] === 0x47
    && a[4] === 0x0D && a[5] === 0x0A && a[6] === 0x1A && a[7] === 0x0A) return 'image/x-mng';
  if ((a[0] === 0x3C || a[1] === 0x3C || a[2] === 0x3C) && buf.byteLength > 30) {
    a = new Uint8Array(buf, buf.byteLength - 16, 16);
    for (let i = a.length - 1; i > 5; i--) {
      if (a[i] === 0x3E & a[i - 1] === 0x67 && a[i - 2] === 0x76
        && a[i - 3] === 0x73 && a[i - 4] === 0x2F && a[i - 5] === 0x3C) return 'image/svg+xml';
    }
  }
  return 'text/plain';
};

document.getElementById('tree').addEventListener('click', async (e) => {
  if (e.target.tagName === 'BUTTON') {
    e.target.classList.toggle('hide');
    e.target.textContent = e.target.classList.contains('hide') ? '+' : '-';
  } else if (e.target.tagName === 'SPAN') {
    let element;
    try {
      element = await createElement(e.target.entry);
    } catch (err) {
      element = document.createElement('span');
      element.textContent = err.message;
      element.classList.add('err');
    }
    const view = document.getElementById('view');
    view.innerHTML = '';
    view.appendChild(element);
  }
});
