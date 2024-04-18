setTimeout(() => {
  if (document.getElementById('dosenc').value === '') {
    let dosenc, winenc;
    const lang = navigator.languages
        ? navigator.languages[0]
        : (navigator.language || navigator.userLanguage);
    switch (lang.slice(0, 2)) {
      case 'ru':
      case 'ua':
      case 'be': dosenc = 'cp866'; winenc = 'cp1251'; break;
      case 'iw': dosenc = 'cp862'; winenc = 'cp1255'; break; // cp856, cp424
      case 'ar': dosenc = 'cp864'; winenc = 'cp1256'; break; // cp420
      case 'zh': dosenc = 'cp950'; winenc = 'CP1386'; break; // cp936
      case 'tr': dosenc = 'cp857'; winenc = 'cp1254'; break;
      case 'ja': dosenc = 'cp932'; winenc = 'cp932'; break;
      case 'kr': dosenc = 'cp949'; winenc = 'cp949'; break;
      case 'th': dosenc = 'cp874'; winenc = 'cp1252'; break;
      case 'el': dosenc = 'cp875'; winenc = 'cp1253'; break;
      case 'vn': dosenc = 'cp1258'; winenc = 'cp1258'; break;
      default: dosenc = 'cp437'; winenc = 'cp1250';
    }
    document.getElementById('dosenc').value = dosenc;
    zip.hexEncoding = winenc;
  }
}, 999);
zip.filenameEncoding = () => document.getElementById('dosenc').value || undefined;
zip.textEncoding = () => document.getElementById('winenc').value || undefined;

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
      text.spellcheck = false; text.readOnly = true;
      text.textContent = new TextDecoder(zip.textEncoding()).decode(new Uint8Array(buf));
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
    case 'audio': {
      const audio = new Audio();
      try {
        blob = blob.slice(0, blob.size, mimetype);
      } catch (ex) {
        blob = new Blob([buf], { type: mimetype });
      }
      audio.src = URL.createObjectURL(blob);
      audio.addEventListener('load', () => URL.revokeObjectURL(audio.src));
      audio.setAttribute('controls', '');
      return audio;
    }
    case 'video': {
      const video = document.createElement('video');
      try {
        blob = blob.slice(0, blob.size, mimetype);
      } catch (ex) {
        blob = new Blob([buf], { type: mimetype });
      }
      video.src = URL.createObjectURL(blob);
      video.addEventListener('load', () => URL.revokeObjectURL(video.src));
      video.setAttribute('controls', '');
      return video;
    }
    default: { // Hex view
      const text = document.createElement('textarea');
      text.spellcheck = false; text.readOnly = true;
      const total = buf.byteLength;
      if (total > 0) {
        const lineLimit = 12;
        const hex = num => num.toString(16).toUpperCase().padStart(2, '0');
        const arrLength = Math.min(total, lineLimit * 16);
        const arr = new Uint8Array(buf, 0, arrLength);
        const lines = [];
        const decoder = new TextDecoder(zip.hexEncoding);
        let s1, s2, i = -1;
        for (let l = 0; l < lineLimit; l++) {
          s1 = ''; s2 = '';
          for (let j = 0; j < 16; j++) {
            if (++i === arrLength) break;
            s1 += (j === 0 ? '' : ' ') + hex(arr[i]);
            s2 += arr[i] < 0x21 ? '.' : decoder.decode(arr.slice(i, i + 1));
          }
          lines.push(s1.padEnd(49) + s2);
          if (i === arrLength) break;
        }
        if (i < total) lines.push(''.padEnd(65, '.  '));
        text.textContent = lines.join('\n');
      }
      return text;
    }
  }
};

const toTree = async (zipReader) => {
  const entries = await zipReader.getEntries();

  const table = {};
  entries.forEach(e => table[e.filename] = e);
  entries.forEach((e) => {
    if (e.filename.endsWith('/')) {
      e.entries = [];
      return;
    };
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
  if (buf.byteLength < 12) return 'text/plain';
  let a = new Uint8Array(buf, 0, 12);
  if (a[0] === 0x4D && a[1] === 0x5A) return ''; // PE
  if (a[0] === 0x50 && a[1] === 0x4B && a[2] === 0x03 && a[3] === 0x04) return ''; // zipped
  if (a[0] === 0x1F && a[1] === 0x8B) return ''; // gz
  if (a[0] === 0x37 && a[1] === 0x7A && a[2] === 0xBC && a[3] === 0xAF
    && a[4] === 0x27 && a[5] === 0x1C) return ''; // 7z
  if (a[0] === 0xFD && a[1] === 0x37 && a[2] === 0x7A && a[3] === 0x58
    && a[4] === 0x5A && a[5] === 0x00) return ''; // xz
  if (a[0] === 0x52 && a[1] === 0x61 && a[2] === 0x72 && a[3] === 0x21
    && a[4] === 0x1A && a[5] === 0x07) return ''; // rar
  if (a[0] === 0x75 && a[1] === 0x73 && a[2] === 0x74 && a[3] === 0x61
    && a[4] === 0x72) return ''; // tar
  if (a[0] === 0x25 && a[1] === 0x50 && a[2] === 0x44 && a[3] === 0x46
    && a[4] === 0x2D) return ''; // pdf
  if (a[0] === 0x46 && a[1] === 0x4C && a[2] === 0x56) return ''; // flv
  if (a[0] === 0x3C && a[1] === 0x3C && a[2] === 0x3C && a[3] === 0x20
    && a[4] === 0x4F && a[5] === 0x72 && a[6] === 0x61 && a[7] === 0x63) return ''; // vdi
  if (a[0] === 0xD0 && a[1] === 0xCF && a[2] === 0x11 && a[3] === 0xE0
    && a[4] === 0xA1 && a[5] === 0xB1 && a[6] === 0x1A && a[7] === 0xE1) return ''; // compound
  if (a[0] === 0x53 && a[1] === 0x51 && a[2] === 0x4C && a[3] === 0x69) return ''; // db
  if (a[0] === 0x00 && a[1] === 0x01 && a[2] === 0x00 && a[3] === 0x00
    && a[4] === 0x53 && a[5] === 0x74 && a[6] === 0x61 && a[7] === 0x6E) return ''; // mdb
  if (a[0] === 0x00 && a[1] === 0x01 && a[2] === 0x00 && a[3] === 0x00
    && a[4] === 0x00) return ''; // ttf
  if (a[0] === 0x4F && a[1] === 0x54 && a[2] === 0x54 && a[3] === 0x4F) return ''; // otf
  if (a[0] === 0x43 && a[1] === 0x44 && a[2] === 0x30 && a[3] === 0x30
    && a[4] === 0x31) return ''; // iso
  if (a[0] === 0x41 && a[1] === 0x54 && a[2] === 0x26 && a[3] === 0x54) return ''; // DjVu
  if (a[0] === 0x66 && a[1] === 0x4C && a[2] === 0x61 && a[3] === 0x43) return 'audio/flac';
  if (a[0] === 0x4F && a[1] === 0x67 && a[2] === 0x67 && a[3] === 0x53) {
    if (buf.byteLength > 999) {
      a = new Uint8Array(buf, 29, 6);
      if (new TextDecoder('ascii').decode(a) === 'theora') return 'video/ogg';
    }
    return 'audio/ogg';
  }
  if (a[0] === 0x52 && a[1] === 0x49 && a[2] === 0x46 && a[3] === 0x46) {
    if (a[8] === 0x57 && a[9] === 0x41 && a[10] === 0x56 && a[11] === 0x45) return 'audio/wav';
    if (a[8] === 0x41 && a[9] === 0x56 && a[10] === 0x49 && a[11] === 0x20) return 'video/x-msvideo';
  }
  if (a[4] === 0x66 && a[5] === 0x74 && a[6] === 0x79 && a[7] === 0x70) { // ftyp (MP4)
    const type = new TextDecoder('ascii').decode(new Uint8Array(a).slice(8, 12));
    switch (type) {
      case 'avc1': case 'iso2': case 'isom': case 'mmp4':
      case 'mp41': case 'mp42': case 'mp71': case 'msnv':
      case 'ndas': case 'ndsc': case 'ndsh': case 'ndsm':
      case 'ndsp': case 'ndss': case 'ndxc': case 'ndxh':
      case 'ndxm': case 'ndxp': case 'ndxs': return 'video/mp4';
      case 'M4A ': return 'audio/aac';
      case 'qt  ': return 'video/quicktime';
      case '3gp4': return 'video/3gpp';
    }
  }
  if (a[0] === 0x00 && a[1] === 0x00 && a[2] === 0x01 && (a[3] === 0xBA || a[3] === 0xB3)) return 'video/mpeg';
  if (a[0] === 0x30 && a[1] === 0x26 && a[2] === 0xB2 && a[3] === 0x75 && a[4] === 0x8E
    && a[5] === 0x66 && a[6] === 0xCF && a[7] === 0x11) return 'video/x-ms-asf';
  if (a[0] === 0x1A && a[1] === 0x45 && a[2] === 0xDF && (a[3] === 0xA3)) return 'video/webm';
  if (a[0] === 0xFF && (a[1] === 0xFB || a[1] === 0xF3 || a[1] === 0xF2)) return 'audio/mpeg';
  if (a[0] === 0x49 && a[1] === 0x44 && a[2] === 0x33) return 'audio/mpeg';
  if (a[0] === 0xFF && a[1] === 0xD8 && a[2] === 0xFF) return 'image/jpeg';
  if (a[0] === 0xFF && a[1] === 0x4F && a[2] === 0xFF && a[3] === 0x51
    || a[0] === 0x00 && a[1] === 0x00 && a[2] === 0x00 && a[3] === 0x0C
    && a[4] === 0x6A && a[5] === 0x50 && a[6] === 0x20 && a[7] === 0x20
    && a[8] === 0x0D && a[9] === 0x0A && a[10] === 0x87 && a[11] === 0x0A) return 'image/jp2';
  if (a[0] === 0x89 && a[1] === 0x50 && a[2] === 0x4E && a[3] === 0x47) return 'image/png';
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
  for (const b of a) {
    if (b < 32 && b !== 10 && b !== 13) return '';
  }
  return 'text/plain';
};

document.getElementById('tree').addEventListener('click', async (e) => {
  if (e.target.tagName === 'BUTTON') {
    e.target.classList.toggle('hide');
    e.target.textContent = e.target.classList.contains('hide') ? '+' : '-';
  } else if (e.target.tagName === 'SPAN') {
    if (e.target.entry.filename.endsWith('/')) return;
    document.querySelectorAll('#tree span').forEach(s => s.classList.remove('selected'));
    e.target.classList.add('selected');
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
    if (element) view.appendChild(element);
  }
});
