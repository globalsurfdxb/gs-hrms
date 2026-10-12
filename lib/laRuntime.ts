/* Loader for the Leave & Attendance runtime (public/la/*): stylesheet, scripts and fonts.
   Kept outside the host component so the shell can warm the files before the module is opened. */

const FONTS_ID = 'la-fonts';
const SCRIPT_ID = 'la-runtime';

/* The prototype runtime plus the active layer that gives every screen real behaviour (order matters). */
const SCRIPTS = ['la.js', 'la-core.js', 'la-att.js', 'la-leave.js', 'la-home.js', 'la-ops1.js', 'la-ops2.js'];
const BUILD = Date.now();

let cssPromise: Promise<string> | null = null;
let scriptPromise: Promise<void> | null = null;

export function loadLaCss() {
  cssPromise ??= fetch(`/la/la.css?v=${BUILD}`).then((r) => r.text());
  return cssPromise;
}

const sources = new Map<string, Promise<string>>();

/* All files download in parallel; they are then executed in order from memory, without further requests. */
function fetchSource(name: string) {
  let p = sources.get(name);
  if (!p) {
    p = fetch(`/la/${name}?v=${BUILD}`).then((r) => {
      if (!r.ok) throw new Error(`Failed to load /la/${name}`);
      return r.text();
    });
    p.catch(() => sources.delete(name));
    sources.set(name, p);
  }
  return p;
}

function runScript(name: string, code: string) {
  const id = `${SCRIPT_ID}-${name}`;
  if (document.getElementById(id)) return;
  const s = document.createElement('script');
  s.id = id;
  s.text = `${code}\n//# sourceURL=/la/${name}`;
  document.head.appendChild(s);
}

/** Executes the runtime. Only call once the organisation has been published on window.__laOrg. */
export function loadLaRuntime() {
  scriptPromise ??= Promise.all(SCRIPTS.map(fetchSource))
    .then((codes) => codes.forEach((code, i) => runScript(SCRIPTS[i], code)))
    .catch((e) => {
      scriptPromise = null;
      throw e;
    });
  return scriptPromise;
}

export function ensureLaFonts() {
  if (document.getElementById(FONTS_ID)) return;
  const l = document.createElement('link');
  l.id = FONTS_ID;
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(l);
}

/** Downloads the stylesheet, fonts and script files in the background without running anything,
    so opening Leave & Attendance later does not wait on the network. */
export function prewarmLa() {
  ensureLaFonts();
  void loadLaCss().catch(() => {
    cssPromise = null;
  });
  SCRIPTS.forEach((n) => void fetchSource(n).catch(() => undefined));
}
