// Streaming JSON projection. Only model/type/timestamp and numeric token counts
// survive a chunk boundary; conversation strings and tool payloads are skipped.
const KEYS = new Set(['type','timestamp','payload','model','info','last_token_usage','total_token_usage',
  'input_tokens','cached_input_tokens','cache_write_input_tokens','output_tokens','reasoning_output_tokens','total_tokens']);
const STRINGS = new Set(['type','timestamp','payload.type','payload.model']);
const NUMERIC = /^payload\.info\.(?:last_token_usage|total_token_usage)\.(?:input_tokens|cached_input_tokens|cache_write_input_tokens|output_tokens|reasoning_output_tokens|total_tokens)$/;

class CostRecordProjector {
  constructor(saved) {
    Object.assign(this, saved || { stack: [], record: {}, token: null, ignored: false, invalid: false, finished: false });
  }
  valuePath() {
    const frame = this.stack.at(-1);
    return frame ? [...frame.path, frame.key || '_'] : [];
  }
  put(path, value) {
    let node = this.record;
    for (const key of path.slice(0, -1)) node = node[key] ||= {};
    node[path.at(-1)] = value;
    if ((path.join('.') === 'type' && !['turn_context','event_msg'].includes(value)) ||
        (path.join('.') === 'payload.type' && this.record.type === 'event_msg' && value !== 'token_count')) this.ignored = true;
  }
  finishToken() {
    const token = this.token;
    this.token = null;
    try {
      if (token.key) {
        const value = token.discardKey ? '_' : JSON.parse('"' + token.text + '"');
        this.stack.at(-1).key = KEYS.has(value) ? value : '_';
        this.stack.at(-1).phase = 'colon';
      } else if (token.capture) {
        this.put(token.path, JSON.parse(token.string ? '"' + token.text + '"' : token.text));
      }
      if (!token.key && this.stack.length) this.stack.at(-1).phase = 'comma';
    } catch { this.invalid = true; }
  }
  feed(text) {
    if (this.ignored || this.invalid) return;
    for (let i = 0; i < text.length; i++) {
      if (this.ignored || this.invalid) break;
      const c = text[i];
      if (this.token?.string) {
        const token = this.token;
        if (!token.capture && !token.key && !token.escape) {
          const match = /["\\]/g; match.lastIndex = i;
          const next = match.exec(text);
          if (!next) break;
          i = next.index;
        }
        const ch = text[i];
        if (token.escape) { if (token.capture) token.text += ch; token.escape = false; }
        else if (ch === '\\') { if (token.capture) token.text += ch; if (token.key) { token.discardKey = true; token.text = ''; } token.escape = true; }
        else if (ch === '"') this.finishToken();
        else if (token.capture || token.key && !token.discardKey) token.text += ch;
        if (token.key && !token.discardKey && ![...KEYS].some(key => key.startsWith(token.text))) { token.discardKey = true; token.text = ''; }
        if (this.token?.text.length > 512) this.invalid = true;
        continue;
      }
      if (this.token) {
        if (/[\s,}\]]/.test(c)) { this.finishToken(); i--; }
        else { if (this.token.capture) this.token.text += c; if (this.token.text.length > 32) this.invalid = true; }
        continue;
      }
      if (/\s/.test(c)) continue;
      if (this.finished) { this.invalid = true; break; }
      const frame = this.stack.at(-1);
      if (c === '"') {
        const key = frame?.kind === 'object' && frame.phase === 'key';
        if (!key && frame?.phase !== 'value') { this.invalid = true; break; }
        const path = key ? [] : this.valuePath();
        this.token = { string: true, key, path, capture: !key && STRINGS.has(path.join('.')), text: '', escape: false };
      } else if (c === '{' || c === '[') {
        if (this.finished) { this.invalid = true; break; }
        if (frame && frame.phase !== 'value') { this.invalid = true; break; }
        const path = this.valuePath();
        if (c === '[') path.push('_');
        if (frame) frame.phase = 'comma';
        this.stack.push({ kind: c === '{' ? 'object' : 'array', path, key: null, phase: c === '{' ? 'key' : 'value' });
        if (this.stack.length > 64) this.invalid = true;
      } else if (c === '}' || c === ']') {
        if (!frame || frame.kind !== (c === '}' ? 'object' : 'array')) this.invalid = true;
        else { this.stack.pop(); if (!this.stack.length) this.finished = true; }
      } else if (c === ':') { if (frame?.phase !== 'colon') this.invalid = true; else frame.phase = 'value'; }
      else if (c === ',') { if (!frame || frame.phase !== 'comma') this.invalid = true; else { frame.phase = frame.kind === 'object' ? 'key' : 'value'; frame.key = null; } }
      else {
        if (!frame || frame.phase !== 'value') { this.invalid = true; break; }
        const path = this.valuePath();
        this.token = { string: false, key: false, path, capture: NUMERIC.test(path.join('.')), text: NUMERIC.test(path.join('.')) ? c : '' };
      }
    }
  }
  result() { return !this.invalid && !this.ignored && this.finished && !this.token ? this.record : null; }
  snapshot() { return { stack: this.stack, record: this.record, token: this.token, ignored: this.ignored, invalid: this.invalid, finished: this.finished }; }
}
module.exports = { CostRecordProjector };
