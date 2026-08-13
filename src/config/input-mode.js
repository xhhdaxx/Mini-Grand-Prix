const INPUT_MODES = new Set(['keyboard', 'gamepad']);

export function sanitizeInputMode(value) {
  return INPUT_MODES.has(value) ? value : 'keyboard';
}

export function parseInputMode(args = []) {
  const option = args.find(arg => arg.startsWith('--input-mode='));
  return sanitizeInputMode(option?.slice('--input-mode='.length));
}

export function renderInputMode(html, mode) {
  return html.replaceAll('__INPUT_MODE__', sanitizeInputMode(mode));
}

export function readInputMode(doc = document) {
  return sanitizeInputMode(doc.querySelector('meta[name="input-mode"]')?.content);
}

export function supportsGamepad(mode) {
  return sanitizeInputMode(mode) === 'gamepad';
}
