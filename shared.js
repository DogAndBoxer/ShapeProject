// Shared by index.html (audit home) and shape-builder.html (builder and audit entry).
// Holds the shape catalogue, the store (browser-local, synced to Supabase when configured), the audit queue,
// and the derivation of primitive minimums from audit records.
window.SA = (() => {
  'use strict';
  const GRID = [45, 90, 135, 180];
  const PROFILES = ['round', 'hoe-like', 'shark fin'];
  const RIB_FACTOR = 1.15;
  const actualOf = g => Math.round(g * RIB_FACTOR * 10) / 10;
  const rad = deg => deg * Math.PI / 180;
  const setbackOf = (a, Ro) => a >= 90 ? Ro : Ro * Math.tan(rad(a) / 2);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));

  // ---------- catalogue ----------
  // The audit asks each bender for the shapes cut most often, not every bend combination. A shape here is its
  // bends only: the lengths in a code just say which segments are short and which long, for the drawing. The
  // operator makes each as short as the machine will go and enters every length achieved.
  const TOP_SHAPES = [
    'l100,w90,l100',
    'l100,w90,l100,w90,l100',
    'l100,w135,l1000,w90,l1000,w90,l1000,w90,l1000,w135,l100',
    'l100,w90,l100,w-90,l100',
    'l100,w180,l1000,w180,l100',
    'l100,w135,l1000',
    'l100,w180,l1000,w90,l1000,w90,l1000,w180,l100',
    'l100,w180,l1000',
    'l100,w135,l1000,w-135,l100',
    'l100,w135,l1000,w90,l1000,w90,l1000,w135,l100',
    'l100,w180,l1000,w90,l100',
    'l100,w135,l1000,w135,l100',
    'l100,w90,l100,w-90,l100,w-90,l100,w90,l100',
    'l100,w90,l1000,w90,l1000,w90,l1000,w90,l1000,w90,l100',
    'l100,w135,l1000,w90,l100',
    'l100,w90,l100,w90,l100,w-90,l100',
    'l100,w-45,l100,w45,l100,w45,l100,w-45,l100',
    'l100,w180,l1000,w180,l1000,w180,l100',
    'l100,w90,l1000,w-180,l1000,w90,l100',
  ];

  // Minimal NSS reader: segment lengths, bends (angle and direction), which segments are arcs.
  function parseNSS(code) {
    const legs = [], arcs = [], bends = [];
    let pendingR = false;
    for (const t of String(code || '').trim().split(/[\s,]+/).filter(Boolean)) {
      const m = t.match(/^([lwr])(-?\d+(?:\.\d+)?)$/i);
      if (!m) return null;
      const k = m[1].toLowerCase(), v = +m[2];
      if (k === 'r') pendingR = true;
      else if (k === 'l') { if (legs.length > bends.length) bends.push({ a: 0, d: 1 }); legs.push(v > 0 ? v : null); arcs.push(pendingR); pendingR = false; }
      else { if (legs.length === bends.length) return null; bends.push({ a: Math.min(180, Math.abs(v)), d: v < 0 ? -1 : 1 }); }
    }
    return legs.length ? { legs, arcs, bends } : null;
  }
  // A shape's bends as signed angles. The same shape can be written four ways: as is, mirrored (every bend the
  // other way), from the other end, or both. From the other end, the bends come in reverse order and each turns
  // the other way, so "reverse and mirror" is simply the list reversed.
  const seqOf = p => p.bends.map(b => b.a * b.d);
  const neg = q => q.map(v => -v || 0), same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  // Signature: one string for all four ways of writing a shape, so records and shapes match however they were
  // entered. null for anything with an arc or without a bend.
  function sigOf(code) {
    const p = typeof code === 'string' ? parseNSS(code) : code;
    if (!p || p.arcs.some(Boolean) || !p.bends.length) return null;
    const q = seqOf(p), r = q.slice().reverse();
    return [q, neg(q), r, neg(r)].map(v => v.join('_')).sort()[0];
  }
  // How a record with bends r lines up with a shape with bends q: [{ reverse }] for each way that works.
  // reverse means the record's segments run the other way along the shape. A symmetric shape lines up both ways.
  function alignments(q, r) {
    const out = [], rr = r.slice().reverse();
    if (same(q, r) || same(q, neg(r))) out.push({ reverse: false });
    if (same(q, rr) || same(q, neg(rr))) out.push({ reverse: true });
    return out;
  }
  const symmetric = code => { const p = parseNSS(code); return !!p && alignments(seqOf(p), seqOf(p)).length > 1; };
  function describe(code) {
    const p = parseNSS(code);
    if (!p || !p.bends.length) return 'Straight';
    if (p.bends.length === 1) return `One bend: ${p.bends[0].a}°`;
    const oneWay = p.bends.every(b => b.d === p.bends[0].d), first = p.bends[0].d;
    return `${p.bends.length} bends: ` + p.bends.map(b => `${b.a}°` + (oneWay ? '' : b.d === first ? ' up' : ' down')).join(' / ') + (oneWay ? ', all one way' : '');
  }
  const BUILTIN = TOP_SHAPES.map(code => ({ id: 's-' + sigOf(code), kind: 'shape', sig: sigOf(code), name: describe(code), code }));
  // Rings with hooks: a hook, a bend, a ring that laps itself, the same bend, the same hook, all turning the
  // same way (l200,w90,r393,l3000,w90,l200). Only for benders marked as making ring shapes. The operator enters
  // the smallest outside diameter and the hook length; the lap is drawn at RING_SWEEP and is not a measurement.
  const RING_ANGLES = [90, 135, 180], RING_SWEEP = 3000 / 393, PLAIN_SWEEP = 2000 / 293;
  for (const a of RING_ANGLES) BUILTIN.push({ id: `ring-hook-${a}`, kind: 'ring', angle: a, name: `Ring with ${a}° hooks`, code: `l200,w${a},r393,l3000,w${a},l200` });
  // The plain ring (r293,l2000): one figure per bar diameter, the smallest ring's outside diameter. It is all a
  // radius machine is asked for, and benders marked as making ring shapes are asked for it too.
  const RING_MIN = { id: 'ring-min', kind: 'ringmin', name: 'Smallest ring', code: 'r293,l2000' };

  // Primitive ids, as the check uses them: lead-A, tail-A, int-s-A-B, int-o-A-B (A made first).
  const PRIM_IDS = [];
  for (const a of GRID) PRIM_IDS.push(`lead-${a}`);
  for (const a of GRID) PRIM_IDS.push(`tail-${a}`);
  for (const k of ['s', 'o']) for (const a of GRID) for (const b of GRID) PRIM_IDS.push(`int-${k}-${a}-${b}`);
  function primInfo(id) {
    const p = id.split('-');
    if (p[0] === 'lead') return { name: `Lead end before a ${p[1]}° bend`, angles: [+p[1]] };
    if (p[0] === 'tail') return { name: `Tail end after a ${p[1]}° bend`, angles: [+p[1]] };
    return { name: `Between ${p[2]}° (made first) and ${p[3]}°, ${p[1] === 's' ? 'same direction' : 'opposite directions'}`, angles: [+p[2], +p[3]] };
  }

  // ---------- store ----------
  const KEY = 'shapeAudit.v1', CFG_KEY = 'shapeAudit.cfg';
  const TABLES = { machines: 'shape_machines', shapes: 'shape_shapes', audits: 'shape_audits' };
  const blank = () => ({ machines: [], shapes: [], audits: [] });
  // The project the audit syncs to. The key is the publishable one, meant to be public; access is set by the
  // policies in supabase/schema.sql. Settings can point a laptop at a different project.
  const DEFAULT_URL = 'https://xeiownkriopbervmgijy.supabase.co', DEFAULT_KEY = 'sb_publishable_R3vIRUPCw4Oj_wIBAfF8fA_ZTR-BzBe';
  let db = blank(), cfg = { url: DEFAULT_URL, key: DEFAULT_KEY, operator: '' };
  try { db = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage unavailable */ }
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(CFG_KEY) || '{}')); } catch (e) { /* storage unavailable */ }
  if (!cfg.url || !cfg.key) { cfg.url = DEFAULT_URL; cfg.key = DEFAULT_KEY; }   // blank settings fall back to the built-in project
  const listeners = [];
  const notify = () => listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* storage unavailable */ } };
  const saveCfg = patch => { Object.assign(cfg, patch); try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) { /* storage unavailable */ } };
  const rows = t => db[t].filter(r => !r.deleted);
  const get = (t, id) => db[t].find(r => r.id === id && !r.deleted) || null;
  function put(t, row) {
    if (!row.id) row.id = uuid();
    row.updated_at = new Date().toISOString();
    row._dirty = true;
    const i = db[t].findIndex(r => r.id === row.id);
    if (i >= 0) db[t][i] = row; else db[t].push(row);
    persist(); queueSync();
    return row;
  }
  const remove = (t, id) => { const r = db[t].find(x => x.id === id); if (r) put(t, Object.assign(r, { deleted: true })); };

  // ---------- Supabase sync (optional) ----------
  // Each table is id, updated_at, deleted, data (jsonb). Local rows changed since the last sync are upserted,
  // then everything is pulled and the newer copy of each row wins.
  let syncState = { text: cfg.url ? 'Not synced yet' : 'Saved in this browser only', ok: !cfg.url }, syncing = false, again = false, timer = null;
  const queueSync = () => { clearTimeout(timer); timer = setTimeout(sync, 400); };
  async function sync() {
    if (!cfg.url || !cfg.key) { syncState = { text: 'Saved in this browser only', ok: true }; notify(); return; }
    if (syncing) { again = true; return; }
    syncing = true;
    const base = cfg.url.replace(/\/+$/, '') + '/rest/v1/';
    const headers = { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json' };
    try {
      for (const t in TABLES) {
        const dirty = db[t].filter(r => r._dirty);
        if (dirty.length) {
          const body = dirty.map(r => { const data = Object.assign({}, r); delete data._dirty; return { id: r.id, updated_at: r.updated_at, deleted: !!r.deleted, data }; });
          const res = await fetch(base + TABLES[t] + '?on_conflict=id', { method: 'POST', headers: Object.assign({ Prefer: 'resolution=merge-duplicates,return=minimal' }, headers), body: JSON.stringify(body) });
          if (!res.ok) throw new Error(`${TABLES[t]}: ${res.status} ${(await res.text()).slice(0, 200)}`);
          dirty.forEach(r => { delete r._dirty; });
        }
        const res = await fetch(base + TABLES[t] + '?select=id,updated_at,deleted,data', { headers });
        if (!res.ok) throw new Error(`${TABLES[t]}: ${res.status} ${(await res.text()).slice(0, 200)}`);
        for (const remote of await res.json()) {
          const row = Object.assign({}, remote.data, { id: remote.id, updated_at: remote.updated_at, deleted: !!remote.deleted });
          const i = db[t].findIndex(r => r.id === row.id);
          if (i < 0) db[t].push(row);
          else if (!db[t][i]._dirty && Date.parse(row.updated_at) > Date.parse(db[t][i].updated_at)) db[t][i] = row;
        }
      }
      persist();
      syncState = { text: 'Synced ' + new Date().toLocaleTimeString(), ok: true };
    } catch (e) {
      persist();
      syncState = { text: 'Sync failed, saved in this browser: ' + e.message, ok: false };
    }
    syncing = false;
    notify();
    if (again) { again = false; queueSync(); }
  }
  const exportAll = () => JSON.stringify({ exported: new Date().toISOString(), machines: db.machines, shapes: db.shapes, audits: db.audits }, null, 1);
  // Import merges by id, newer copy wins, and marks what it takes as needing sync.
  function importAll(text) {
    const src = JSON.parse(text);
    let n = 0;
    for (const t in TABLES) for (const row of (src[t] || [])) {
      if (!row || !row.id) continue;
      const i = db[t].findIndex(r => r.id === row.id);
      if (i >= 0 && Date.parse(db[t][i].updated_at) >= Date.parse(row.updated_at)) continue;
      row._dirty = true;
      if (i >= 0) db[t][i] = row; else db[t].push(row);
      n++;
    }
    persist(); queueSync(); notify();
    return n;
  }

  // ---------- shapes, queue ----------
  const customShapes = () => rows('shapes').sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  // Arcs with bends are judged case by case, so added shapes with an arc are never queued; the ring-with-hooks
  // pieces are the exception and go only to benders marked as making them.
  // An added shape that is already on the list under another spelling is not asked for twice.
  const shapeKey = s => s.sig || sigOf(s.code) || 'id:' + s.id;
  function shapesFor(m) {
    const out = BUILTIN.filter(s => s.kind !== 'ring' || m.ringHooks), have = new Set(out.map(shapeKey));
    for (const s of customShapes()) if (!s.hasArc && !have.has(shapeKey(s))) { have.add(shapeKey(s)); out.push(s); }
    return out;
  }
  const comboKey = c => `${c.wire}|${c.pin}|${c.profile}`;
  // Wire and pin pairs the machine runs: every pair of its wires and pins, less the ones switched off.
  function combosOf(m) {
    const off = new Set(m.off || []), out = [];
    if (m.type === 'radius') return out;
    for (const wire of (m.wires || []).slice().sort((a, b) => a - b))
      for (const p of (m.pins || []).slice().sort((a, b) => a.dia - b.dia || a.profile.localeCompare(b.profile))) {
        const c = { wire, pin: p.dia, profile: p.profile };
        if (!off.has(comboKey(c))) out.push(c);
      }
    return out;
  }
  const liveAudits = () => rows('audits').filter(r => !r.voided);
  // Every piece the machine owes, wire outermost so changeovers are few. state: todo, skipped or done.
  function queue(m) {
    const mine = liveAudits().filter(r => r.machine_id === m.id), items = [];
    const stateOf = recs => recs.some(r => r.status === 'done' || r.status === 'cannot') ? 'done' : recs.some(r => r.status === 'skip') ? 'skipped' : 'todo';
    if (m.type === 'radius') {
      for (const wire of (m.wires || []).slice().sort((a, b) => a - b)) {
        const recs = mine.filter(r => r.shape_id === RING_MIN.id && r.wire === wire);
        items.push({ combo: { wire, pin: null, profile: null }, shape: RING_MIN, state: stateOf(recs), recs });
      }
      return items;
    }
    // Records are matched to shapes by signature, so a piece saved under an older name or entered from the other
    // end still counts. Rings match by id.
    const byKey = new Map();
    for (const r of mine) { const k = `${comboKey(r)}|${sigOf(r.code) || 'id:' + r.shape_id}`; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(r); }
    const shapes = shapesFor(m), combos = combosOf(m);
    for (const wire of [...new Set(combos.map(c => c.wire))]) {
      for (const combo of combos.filter(c => c.wire === wire)) for (const shape of shapes) {
        const recs = byKey.get(`${comboKey(combo)}|${shapeKey(shape)}`) || [];
        items.push({ combo, shape, state: stateOf(recs), recs });
      }
      if (m.ringHooks) {   // the plain ring has no bends, so it is asked once per bar, not per pin
        const recs = mine.filter(r => r.shape_id === RING_MIN.id && r.wire === wire);
        items.push({ combo: { wire, pin: null, profile: null }, shape: RING_MIN, state: stateOf(recs), recs });
      }
    }
    return items;
  }
  // Next piece to do: the first not yet tried, then the skipped ones, oldest skip first.
  function nextItem(items) {
    const todo = items.find(i => i.state === 'todo');
    if (todo) return todo;
    const last = i => Math.max(...i.recs.filter(r => r.status === 'skip').map(r => Date.parse(r.at)));
    return items.filter(i => i.state === 'skipped').sort((a, b) => last(a) - last(b))[0] || null;
  }

  // ---------- minimums ----------
  // What one made piece says about single segments (lead-A, tail-A, int-s-A-B, int-o-A-B, A made first): each straight segment is an observation, as a straight
  // (tangent point to tangent point, or to the bar end) worked out with the piece's own bar and pin.
  function observations(rec) {
    const s = parseNSS(rec.code);
    if (!s || s.arcs.some(Boolean)) return [];   // a segment beside an arc is not the same case as one between straights
    const Ro = rec.pin / 2 + (rec.actual || actualOf(rec.wire)), n = s.legs.length, out = [];
    const onGrid = b => GRID.includes(b.a);
    for (let i = 0; i < n; i++) {
      if (s.arcs[i] || s.legs[i] == null) continue;
      const bL = i > 0 ? s.bends[i - 1] : null, bR = i < n - 1 ? s.bends[i] : null;
      if (bL && bR) {
        const first = rec.rev ? bR : bL, second = rec.rev ? bL : bR;
        if (!onGrid(first) || !onGrid(second)) continue;
        out.push({ id: `int-${first.d === second.d ? 's' : 'o'}-${first.a}-${second.a}`, leg: i, straight: s.legs[i] - setbackOf(first.a, Ro) - setbackOf(second.a, Ro) });
      } else if (bL || bR) {
        const b = bL || bR, lead = rec.rev ? i === n - 1 : i === 0;
        if (!onGrid(b)) continue;
        out.push({ id: `${lead ? 'lead' : 'tail'}-${b.a}`, leg: i, straight: s.legs[i] - setbackOf(b.a, Ro) });
      }
    }
    return out;
  }
  // Shortest straight seen for each primitive, per machine, wire and pin. tradeoff marks a minimum that comes
  // from a piece recorded in more than one version, where it may not hold alongside its neighbours' minimums.
  function minimums() {
    const groups = new Map(), versions = new Map(), done = liveAudits().filter(r => r.status === 'done');
    const vkey = r => `${r.machine_id}|${comboKey(r)}|${sigOf(r.code) || r.shape_id}`;
    for (const r of done) versions.set(vkey(r), (versions.get(vkey(r)) || 0) + 1);
    for (const r of done) {
      const gk = `${r.machine_id}|${comboKey(r)}`, obs = observations(r);
      if (!obs.length) continue;
      if (!groups.has(gk)) { const m = get('machines', r.machine_id); groups.set(gk, { machine_id: r.machine_id, machine: m ? m.name : '(deleted machine)', wire: r.wire, pin: r.pin, profile: r.profile, prim: {} }); }
      const g = groups.get(gk);
      for (const o of obs) {
        const cur = g.prim[o.id];
        if (!cur || o.straight < cur.straight) g.prim[o.id] = { straight: o.straight, rec: r.id, tradeoff: versions.get(vkey(r)) > 1, count: (cur ? cur.count : 0) + 1 };
        else cur.count++;
      }
    }
    return [...groups.values()];
  }
  // Every bent piece saved, with its bends read out, for checking a shape as a whole.
  function shapeVersions() {
    const out = [];
    for (const r of liveAudits()) {
      if (r.status !== 'done') continue;
      const p = parseNSS(r.code), sig = p && sigOf(p);
      if (!sig || p.legs.some(L => L == null)) continue;
      const m = get('machines', r.machine_id);
      out.push({ rec: r, sig, seq: seqOf(p), legs: p.legs, angles: p.bends.map(b => b.a), machine: m ? m.name : '(deleted machine)' });
    }
    return out;
  }
  // Ring minimums. plain: smallest ring per radius machine and bar. hooked: smallest diameter and shortest hook
  // per bender, bar, pin and hook angle, each taken across the versions saved.
  function ringData() {
    const plain = new Map(), hooked = new Map();
    const name = id => { const m = get('machines', id); return m ? m.name : '(deleted machine)'; };
    for (const r of liveAudits()) {
      if (r.status !== 'done' || !(r.od > 0)) continue;
      if (r.shape_id === RING_MIN.id) {
        const k = `${r.machine_id}|${r.wire}`, cur = plain.get(k);
        if (!cur || r.od < cur.od) plain.set(k, { machine_id: r.machine_id, machine: name(r.machine_id), wire: r.wire, od: r.od });
      } else if (String(r.shape_id).startsWith('ring-hook-')) {
        const angle = +r.shape_id.slice(10), k = `${r.machine_id}|${comboKey(r)}|${angle}`;
        const e = hooked.get(k) || { machine_id: r.machine_id, machine: name(r.machine_id), wire: r.wire, pin: r.pin, profile: r.profile, angle, od: Infinity, hook: Infinity, versions: 0 };
        e.od = Math.min(e.od, r.od); if (r.hook > 0) e.hook = Math.min(e.hook, r.hook); e.versions++;
        hooked.set(k, e);
      }
    }
    return { plain: [...plain.values()], hooked: [...hooked.values()] };
  }
  // What was achieved on a saved piece, as text.
  function recText(r) {
    if (r.status !== 'done') return '';
    const f = v => v == null ? '–' : String(Math.round(v));
    if (r.od > 0) return `Ø${f(r.od)} outside` + (r.hook > 0 ? ` · hooks ${f(r.hook)}` : '');
    return (r.legs || []).map(f).join(' / ');
  }

  // Grid angles and weights for an angle: one on a grid angle, two between, none under 45.
  function gridWeights(a) {
    if (a < GRID[0] - 1e-6 || a > 180 + 1e-6) return null;
    for (let i = 0; i < GRID.length; i++) {
      if (Math.abs(a - GRID[i]) < 1e-6) return [[GRID[i], 1]];
      if (i < GRID.length - 1 && a > GRID[i] && a < GRID[i + 1]) { const t = (a - GRID[i]) / (GRID[i + 1] - GRID[i]); return [[GRID[i], 1 - t], [GRID[i + 1], t]]; }
    }
    return null;
  }

  return {
    GRID, PROFILES, BUILTIN, RING_ANGLES, RING_SWEEP, PLAIN_SWEEP, RING_MIN, ringData, recText, PRIM_IDS,
    sigOf, alignments, symmetric, describe, shapeKey, shapeVersions, primInfo, actualOf, setbackOf, esc, cfg, saveCfg, rows, get, put, remove,
    sync, syncState: () => syncState, onChange: f => listeners.push(f), exportAll, importAll,
    parseNSS, customShapes, shapesFor, comboKey, combosOf, queue, nextItem, observations, minimums, gridWeights,
  };
})();
