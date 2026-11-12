// Reads the store's products (femini-eg.com/products.json) and writes the bundles with what is in each:
//   node scripts/bundles.mjs            → src/femini/data/bundles.generated.ts
// Run it again whenever a bundle is added or changed in the store, then build and deploy.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const STORE = 'https://www.femini-eg.com';
const AR = '٠١٢٣٤٥٦٧٨٩';
const digits = (s) => String(s ?? '').replace(/[٠-٩]/g, (c) => AR.indexOf(c));
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const MODEL = String.raw`(?:FC-|Women-)?((?:PAN|BR|SH)\d+|D\d+|A\d+|S\d+)`;

/** bundles whose composition cannot be told at all: shown, but not counted */
const UNKNOWN = {};
/** bundles whose store code says too little: the pieces and colors, read from the pictures */
const FIVE = ['احمر', 'ابيض', 'اسود', 'رمادي', 'بيج'];
const THREE = ['اسود', 'بيج', 'احمر'];
const MANUAL = {
  // read from the store's pictures: the colors of each model in the bundle
  10585047433505: [...['PAN4', 'PAN5', 'BR3', 'BR4', 'SH1'].map((model) => ({ model, qty: 3, colors: THREE })), { model: 'BR2', qty: 1, colors: ['بيج'] }, { model: 'SH2', qty: 1, colors: ['بيج'] }],
  // the picture: black and white racerback sports bras (BR3), the grey thin-strap one (BR4), red and beige triangle bras (BR2).
  // The store's code names BR2 for black/white and BR3 for red/beige: the picture and the model names agree with each other, not with the code.
  10457392546081: [...['SH1', 'PAN4', 'PAN5'].map((model) => ({ model, qty: 5, colors: FIVE })), { model: 'BR3', qty: 2, colors: ['اسود', 'ابيض'] }, { model: 'BR4', qty: 1, colors: ['رمادي'] }, { model: 'BR2', qty: 2, colors: ['احمر', 'بيج'] }],
  10457365250337: [...['PAN1', 'PAN2', 'PAN3', 'PAN4', 'PAN5', 'SH1', 'BR4'].map((model) => ({ model, qty: 5, colors: FIVE }))],
  10457274188065: [...['PAN1', 'PAN2', 'PAN3'].map((model) => ({ model, qty: 5, colors: FIVE }))],
  // the store's code lists the models without the count of each
  10395980333345: [{ model: 'PAN4', qty: 5, colors: null }, { model: 'PAN5', qty: 5, colors: null }],
};

/** colors: "احمر - ابيض" / "احمر + ابيض" → list; "كل الالوان [ما عدا X]" → all of the model but X; nothing → any color */
function colorSpec(rest) {
  const t = clean(rest).replace(/هدية/g, '').replace(/[()]/g, '').replace(/مخزن\s*Y\s*\d+/g, '').trim();
  if (/كل الالوان|كل الألوان/.test(t)) {
    const ex = /ما عدا\s*(.+)$/.exec(t);
    return { colors: null, except: ex ? ex[1].split(/\s*[-+،,]\s*|\s+و\s*/).map(clean).filter(Boolean) : [] };
  }
  const list = t.split(/\s*[-+،,]\s*|\s+و\s*/).map(clean).filter(Boolean);
  return list.length ? { colors: list } : { any: true };
}

/** "(5 قطع FC-BR2 كل الالوان) + (قطعة FC-BR1 احمر)" */
export function parenComps(sku) {
  const out = [];
  for (const m of digits(sku).matchAll(new RegExp(String.raw`\(\s*(?:(\d+|قطعة|قطعتين)\s*(?:قطع)?\s*)?` + MODEL + String.raw`\s*([^)]*)\)`, 'g'))) {
    const n = m[1] === undefined || m[1] === 'قطعة' ? 1 : m[1] === 'قطعتين' ? 2 : Number(m[1]);
    out.push({ model: m[2], qty: n, ...colorSpec(m[3]) });
  }
  return out;
}
const titleQty = (t) => { const m = /(?:باندل|باك)\s*(\d+)/.exec(digits(t)); return m ? Number(m[1]) : null; };

/** the pieces one variant of a bundle is made of, from its store code */
export function compsOf(sku, title, colorOpt, id) {
  if (MANUAL[id]) return MANUAL[id];
  const p = parenComps(sku);
  if (p.length) return p;
  // "D2 احمر/ D1 اسود/ D3 فوشيا": a model with its color each
  const slash = clean(sku).split('/').map((x) => new RegExp('^' + MODEL + String.raw`\s+(\S+)$`).exec(clean(x)));
  if (slash.length > 1 && slash.every(Boolean)) return slash.map((m) => ({ model: m[1], qty: 1, colors: [m[2]] }));
  // a link to the supplier's product (robe + nightgown), in the variant's color
  const link = /product\/(\d+)-(\d+)/.exec(sku);
  if (link && colorOpt) return [{ model: 'S1', qty: 1, colors: [colorOpt] }, { model: 'S2', qty: 1, colors: [colorOpt] }];
  // a single model: "باندل ٥ قطع …", the colors from the option
  const one = new RegExp('^' + MODEL).exec(clean(sku).replace(/\(.*$/, '').trim());
  const n = titleQty(title);
  if (one && n) return [{ model: one[1], qty: n, ...(colorOpt ? colorSpec(colorOpt) : { any: true }) }];
  return [];
}

export function parseProducts(products) {
  const out = [];
  for (const p of products) {
    if (!(/باندل|باك|بندل/.test(p.title) || p.product_type === 'Packs')) continue;
    const opt = Object.fromEntries((p.options ?? []).map((o) => [o.name, o.values]));
    const skus = [...new Set(p.variants.map((v) => v.sku))];
    const price = Math.min(...p.variants.map((v) => Number(v.price)));
    const was = Math.max(0, ...p.variants.map((v) => Number(v.compare_at_price) || 0));
    const sizes = opt.Size ?? [];
    const colorVals = opt.Color ?? [];
    const variants = [];
    for (const sku of skus) {
      const first = p.variants.find((v) => v.sku === sku);
      const ci = (p.options ?? []).findIndex((o) => o.name === 'Color');
      const colorOpt = ci >= 0 ? first[`option${ci + 1}`] ?? '' : '';
      const comps = compsOf(sku, p.title, colorOpt || (colorVals.length === 1 ? colorVals[0] : ''), p.id);
      variants.push({ label: skus.length > 1 ? colorOpt || clean(sku).slice(0, 40) : '', comps });
    }
    const uniq = variants.filter((v, i) => variants.findIndex((w) => JSON.stringify(w.comps) === JSON.stringify(v.comps) && w.label === v.label) === i);
    // the variant list can repeat one combination for every size
    const bundle = { id: String(p.id), title: clean(p.title), image: p.images?.[0]?.src, type: p.product_type, price, was, url: `${STORE}/products/${p.handle}`, available: p.variants.some((v) => v.available), sizes, variants: uniq.filter((v) => v.comps.length) };
    if (UNKNOWN[p.id] || !bundle.variants.length) bundle.unknown = UNKNOWN[p.id] ?? 'التركيبة مش واضحة من بيانات الموقع.';
    out.push(bundle);
  }
  return out;
}

export async function fetchProducts() {
  const all = [];
  for (let page = 1; ; page++) {
    const r = await fetch(`${STORE}/products.json?limit=250&page=${page}`);
    if (!r.ok) throw new Error(`products.json ${r.status}`);
    const { products } = await r.json();
    if (!products.length) break;
    all.push(...products);
  }
  return all;
}

/** the store's picture of each bundle, kept next to the app (the server's policy allows no pictures from elsewhere) */
async function savePictures(bundles) {
  const dir = new URL('../public/bundles/', import.meta.url); mkdirSync(dir, { recursive: true });
  for (const b of bundles) {
    const src = b.image; delete b.image; if (!src) continue;
    const file = new URL(`${b.id}.jpg`, dir);
    if (!existsSync(file)) {
      const r = await fetch(`${src.split('?')[0]}?width=320`); if (!r.ok) { console.warn('no picture for', b.id, r.status); continue; }
      writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    }
    b.img = `${b.id}.jpg`;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bundles = parseProducts(await fetchProducts());
  await savePictures(bundles);
  const file = new URL('../src/femini/data/bundles.generated.ts', import.meta.url);
  writeFileSync(file, `// Generated by scripts/bundles.mjs from ${STORE}/products.json (${new Date().toISOString().slice(0, 10)}). Do not edit by hand: run the script again.\nimport type { Bundle } from '@/femini/domain/bundles';\n\nexport const BUNDLES: Bundle[] = ${JSON.stringify(bundles, null, 1)};\n`);
  console.log(`${bundles.length} bundles, ${bundles.filter((b) => b.unknown).length} without a known composition → ${file.pathname}`);
}
