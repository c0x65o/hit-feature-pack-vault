'use client';
async function fetchJson(url, init) {
    const res = await fetch(url, { credentials: 'include', ...init });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = json?.error || json?.detail || json?.message || `Request failed (${res.status})`;
        throw new Error(String(msg));
    }
    return json;
}
async function copyToClipboard(text) {
    const value = String(text ?? '');
    if (!value)
        throw new Error('Nothing to copy');
    // Preferred: async clipboard API
    try {
        await navigator.clipboard.writeText(value);
        return;
    }
    catch {
        // fallback below
    }
    // Fallback: execCommand
    const el = document.createElement('textarea');
    el.value = value;
    el.setAttribute('readonly', 'true');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.top = '0';
    document.body.appendChild(el);
    el.select();
    try {
        const ok = document.execCommand('copy');
        if (!ok)
            throw new Error('Clipboard copy failed');
    }
    finally {
        document.body.removeChild(el);
    }
}
async function revealVaultItemSecrets(itemId) {
    const id = String(itemId || '').trim();
    if (!id)
        throw new Error('Missing item id');
    return await fetchJson(`/api/vault/items/${encodeURIComponent(id)}/reveal`, { method: 'POST' });
}
function base32Decode(base32) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const s = String(base32 || '').toUpperCase().replace(/=+$/, '');
    let bits = 0;
    let value = 0;
    const out = [];
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        const idx = alphabet.indexOf(ch);
        if (idx === -1)
            throw new Error(`Invalid base32 character: ${ch}`);
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return new Uint8Array(out);
}
async function generateTotpCodeWeb(secretBase32) {
    const keyBytes = base32Decode(secretBase32);
    // 30-second time step (RFC 6238)
    const timeStep = Math.floor(Date.now() / 1000 / 30);
    // 8-byte big-endian buffer
    const msg = new ArrayBuffer(8);
    const view = new DataView(msg);
    view.setUint32(0, 0, false);
    view.setUint32(4, timeStep >>> 0, false);
    const cryptoAny = crypto;
    if (!cryptoAny?.subtle)
        throw new Error('WebCrypto is not available');
    const hmacKey = await cryptoAny.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const sigBuf = await cryptoAny.subtle.sign('HMAC', hmacKey, msg);
    const hash = new Uint8Array(sigBuf);
    const offset = hash[hash.length - 1] & 0x0f;
    const binCode = ((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff);
    const otp = (binCode % 1000000).toString().padStart(6, '0');
    return otp;
}
export const actionHandlers = {
    'vault.copyUsername': async ({ record }) => {
        const username = String(record?.username || '').trim();
        if (!username)
            throw new Error('No username on this item');
        await copyToClipboard(username);
    },
    'vault.copyPassword': async ({ record }) => {
        const id = String(record?.id || '').trim();
        if (!id)
            throw new Error('Missing item id');
        const revealed = await revealVaultItemSecrets(id);
        const value = String(revealed?.password || revealed?.secret || '').trim();
        if (!value)
            throw new Error('No secret/password found for this item');
        await copyToClipboard(value);
    },
    'vault.generateTotp': async ({ record }) => {
        const id = String(record?.id || '').trim();
        if (!id)
            throw new Error('Missing item id');
        const revealed = await revealVaultItemSecrets(id);
        const secret = String(revealed?.totpSecret || '').trim();
        if (!secret)
            throw new Error('No TOTP secret configured for this item');
        const code = await generateTotpCodeWeb(secret);
        await copyToClipboard(code);
    },
};
