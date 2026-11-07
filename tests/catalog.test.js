import { catalog, CATS, levelInfo } from '../js/catalog.js';
import { noteName } from '../js/theory.js';
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const items = catalog();
let bad = 0;
const byCat = {}, byLevel = {};
for (const it of items) {
  const s = it.build();
  byCat[it.cat] = (byCat[it.cat] || 0) + 1; byLevel[it.level] = (byLevel[it.level] || 0) + 1;
  if (!s.notes.length) { bad++; console.log('EMPTY', it.id); }
  if (s.warnings.length) { bad++; console.log('WARN', it.id, s.warnings.slice(0, 3)); }
  if (s.notes.some((n) => n.m < 36 || n.m > 96)) { bad++; console.log('RANGE', it.id); }
}
const ids = new Set(items.map((i) => i.id)); if (ids.size !== items.length) { bad++; console.log('DUPLICATE IDS'); }
const show = (id) => { const s = items.find((i) => i.id === id).build(); console.log(id, '→', s.notes.filter((n) => n.h === 'R').slice(0, 16).map((n) => noteName(n.m, true)).join(' '), s.chords.slice(0, 4).map((c) => c.name).join(' ')); };
show('v_mayamalavagowla_dhruva'); show('v_mohanam_ata'); show('v_kalyani_jhampa'); show('g_srigananatha'); show('c_i_iv_V_i_Bm_L'); show('c_I_bVII_IV_C_L'); show('c_I_vi_IV_V_D_L'); show('sc_maj_Eb');
console.log('by category', byCat); console.log('by level', byLevel); console.log('TOTAL', items.length, bad ? 'PROBLEMS ' + bad : 'all clean');
process.exit(bad ? 1 : 0);
