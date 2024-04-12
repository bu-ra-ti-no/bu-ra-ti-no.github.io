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

const createElement = (entry) => {
  const i = entry.uncompressedSize === 0 ? 0 : Math.floor(Math.log(entry.uncompressedSize) / Math.log(1024));
  const size = +((entry.uncompressedSize / Math.pow(1024, i)).toFixed(2)) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
  const fn = document.getElementById('fn');
  fn.textContent = '[' + size + '] ' + entry.filename;
  if (entry.uncompressedSize > 1024 * 1024 * 100) {
    if (!confirm(`The file size (${size}) is too large. Do you really want to view it?`)) {
      const span = document.createElement('span');
      span.textContent = 'Large file';
      return span;
    }
  }
  const mimetype = zip.getMimeType(entry.filename);
  const opt = { password: document.getElementById('pwd').value };
  switch (mimetype.split('/')[0]) {
    case 'image': {
      const image = new Image();
      entry.getData(new zip.BlobWriter(mimetype), opt)
        .then((blob) => {
          image.src = URL.createObjectURL(blob);
          image.addEventListener('load', () => URL.revokeObjectURL(image.src));
        })
        .catch(ex => alert(ex.message));
      return image;
    }

    case 'text': {
      const text = document.createElement('textarea');
      entry.getData(new zip.TextWriter(), opt)
        .then(data => text.textContent = data)
        .catch(ex => alert(ex.message));
      return text;
    }

    default: {
      const span = document.createElement('span');
      span.textContent = mimetype || 'Unknown file type. Maybe assign an extension alias?';
      return span;
    };
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

zip.getMimeType = (filename) => {
  filename = filename.split('/').at(-1);

  let ext;
  if (filename.indexOf('.') < 0) {
    ext = '';
  } else {
    ext = filename.split('.').at(-1).toLowerCase();
  }

  if (ext === document.getElementById('ext1').value) {
    ext = document.getElementById('ext2').value;
  }

  switch(ext) {
    case 'txt':
    case 'ini':
    case 'cs':
    case 'bas':
    case 'cls':
    case 'vb':
    case 'vbs':
    case 'rs':
    case 'php':
    case 'sh':
    case 'bat':
    case 'py': return 'text/plain';
    case 'htm':
    case 'html': return 'text/html';
    case 'css': return 'text/css';
    case 'csv': return 'text/csv';
    case 'js':
    case 'json': return 'text/javascript';
    case 'xml':
    case 'yml': return 'text/xml';
    case 'md': return 'text/markdown';

    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'tif':
    case 'tiff': return 'image/tiff';
    case 'bmp': return 'image/bmp';
    case 'ico': return 'image/vnd.microsoft.icon';
    case 'svg': return 'image/svg+xml';
    default: return '';
  }
};

document.getElementById('tree').addEventListener('click', (e) => {
  if (e.target.tagName === 'BUTTON') {
    e.target.classList.toggle('hide');
    e.target.textContent = e.target.classList.contains('hide') ? '+' : '-';
  } else if (e.target.tagName === 'SPAN') {
    const element = createElement(e.target.entry);
    const view = document.getElementById('view');
    view.innerHTML = '';
    view.appendChild(element);
  }
});
