
const FILES = [
    { path: 'tslr.pibit', expectedHash: null },
    { path: 'run.exe', expectedHash: null }
];

/* ---------- helper ---------- */
function triggerSave(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); }, 1000);
}

async function fetchFile(filePath, onProgress) {
    const res = await fetch(filePath);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${filePath}`);

    const reader = res.body?.getReader?.();
    if (!reader) {
        const ab = await res.arrayBuffer();
        if (onProgress) onProgress(ab.byteLength, ab.byteLength);
        return ab;
    }

    const chunks = [];
    let received = 0;
    const total = res.headers.get('Content-Length') ? parseInt(res.headers.get('Content-Length'), 10) : null;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (onProgress) onProgress(received, total);
    }

    const full = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) {
        full.set(c, offset);
        offset += c.length;
    }

    return full.buffer;
}

/* ---------- widget ---------- */
function initWidget() {
    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'fixed',
        right: '16px',
        bottom: '16px',
        width: '280px',
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        padding: '12px',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        zIndex: 9999
    });

    const title = document.createElement('div');
    title.textContent = 'Download Files';
    title.style.fontWeight = '700';
    title.style.marginBottom = '8px';

    const list = document.createElement('div');
    list.style.marginBottom = '8px';
    const items = FILES.map(f => {
        const row = document.createElement('div');
        row.textContent = `${f.path}: Not downloaded`;
        row.style.marginBottom = '4px';
        list.appendChild(row);
        return { file: f, row };
    });

    const btn = document.createElement('button');
    btn.textContent = 'Download';
    Object.assign(btn.style, {
        width: '100%',
        padding: '8px',
        borderRadius: '6px',
        border: 'none',
        background: '#2563eb',
        color: '#fff',
        cursor: 'pointer'
    });

    container.appendChild(title);
    container.appendChild(list);
    container.appendChild(btn);
    document.body.appendChild(container);

    btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.style.opacity = '0.6';

        for (const item of items) {
            try {
                item.row.textContent = `${item.file.path}: Downloading...`;
                const buffer = await fetchFile(item.file.path, (rec, total) => {
                    item.row.textContent = total
                        ? `${item.file.path}: ${Math.round((rec/total)*100)}%`
                        : `${item.file.path}: ${rec} bytes`;
                });
                triggerSave(new Blob([buffer]), item.file.path);
                item.row.textContent = `${item.file.path}: Saved`;
                await new Promise(r => setTimeout(r, 200)); // small delay
            } catch (err) {
                item.row.textContent = `${item.file.path}: Error`;
                console.error(err);
            }
        }

        btn.disabled = false;
        btn.style.opacity = '1';
    });
}

window.addEventListener('DOMContentLoaded', initWidget);
