import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const {chromium} = require('@playwright/test');
const base = process.env.LIGERO_PREVIEW || 'http://127.0.0.1:4325';
const output = process.env.LIGERO_EVIDENCE;
if (output) await mkdir(output, {recursive:true});
const browser = await chromium.launch({channel:'msedge',headless:true});
const failures = [], summary = [];

// Runs inside the services iframe. Everything per state is synchronous so no
// gsap/rAF work can mutate the scene between the compared captures.
function installHarness() {
  const gallery = document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt.$folio;
  const core = gallery.core, gl = core.renderer.getContext();
  const harness = {gallery, core, gl, saved:null};
  harness.read = () => {
    core.wake(); core.tick();
    const data = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return data;
  };
  // Variant: same uniforms object (shared values), different define => full old shader.
  harness.variant = text => {
    const ordinary = text.material, full = ordinary.clone();
    full.uniforms = ordinary.uniforms;
    full.defines = {...ordinary.defines, LIGERO_REEL_BLUR:1};
    full.needsUpdate = true;
    return {text, ordinary, full};
  };
  harness.use = (variants, key) => variants.forEach(v => { v.text.mesh.material = v[key]; });
  harness.diff = (a, b, tolerance = 0) => {
    let changed = 0, max = 0;
    for (let i = 0; i < a.length; i += 4) {
      const d = Math.max(Math.abs(a[i]-b[i]), Math.abs(a[i+1]-b[i+1]), Math.abs(a[i+2]-b[i+2]), Math.abs(a[i+3]-b[i+3]));
      if (d > max) max = d;
      if (d > tolerance) changed++;
    }
    return {changed, max};
  };
  return harness;
}

async function check(name, run) {
  try { await run(); console.log(name + ' PASS'); }
  catch (error) { failures.push(name + ': ' + error.message); console.error(name, error); }
}

async function scenario(width, theme) {
  const context = await browser.newContext({viewport:{width,height:900}});
  const errors = [];
  try {
    await context.addInitScript(theme => localStorage.setItem('theme', theme), theme);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push('pageerror: ' + error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push('console: ' + message.text()); });
    await page.goto(base + '/services/', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => {
      const doc = document.querySelector('#services-gallery')?.contentDocument;
      const folio = doc?.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.$folio;
      return folio?.cards.length === 6 && folio.cards.every(card => card.landed)
        && folio.texts.length === 6 && folio.texts.every(text => text.progress === 1) && folio.core.shaderReady === true;
    });
    const frame = await (await page.locator('#services-gallery').elementHandle()).contentFrame();
    await frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const helper = installHarness.toString();
    const run = (fn, arg) => frame.evaluate(`(${fn.toString()})(${JSON.stringify(arg ?? null)}, (${helper})())`);

    // Static material facts.
    const facts = await run((arg, h) => {
      const texts = h.gallery.texts;
      return {
        theme: document.documentElement.dataset.theme,
        titles: texts.map(t => ({
          text: t.el.textContent.trim(), reel: t.reel, outline: t.outline,
          flag: t.material.defines?.LIGERO_REEL_BLUR, uReel: t.material.uniforms.u_reel.value,
          conditional: t.material.fragmentShader.includes('#if LIGERO_REEL_BLUR') && t.material.fragmentShader.includes('#endif'),
        })),
      };
    });
    assert.equal(facts.theme, theme);
    assert.equal(facts.titles.length, 6);
    for (const title of facts.titles) {
      assert.equal(title.outline, true, `${title.text}: outline path`);
      assert.equal(title.reel, false, `${title.text}: ordinary title`);
      assert.equal(title.uReel, 0, `${title.text}: u_reel 0`);
      assert.equal(title.flag, 0, `${title.text}: ordinary LIGERO_REEL_BLUR flag must be 0`);
      assert.equal(title.conditional, true, `${title.text}: fragment shader gates rolling blur with #if LIGERO_REEL_BLUR`);
    }

    // Compile both variants and check for GL/shader errors up front.
    const compiled = await run((arg, h) => {
      const {core, gl, gallery} = h;
      const tick = core.onTick, videos = [...document.querySelectorAll('video')];
      videos.forEach(v => v.pause());
      core.onTick = null;
      const vs = gallery.texts.map(h.variant);
      try {
        h.read();
        const first = [];
        for (const key of ['ordinary', 'full']) {
          h.use(vs, key); h.read();
          first.push(key + ':' + gl.getError());
          vs.forEach(v => {
            const props = core.renderer.properties.get(v[key]);
            const program = props.currentProgram;
            if (!program && v.text.mesh.visible) throw new Error(key + ' visible variant did not compile');
            if (program?.diagnostics && program.diagnostics.runnable === false) throw new Error(key + ' program not runnable: ' + JSON.stringify(program.diagnostics));
          });
        }
        const visible = vs.filter(v => v.text.mesh.visible);
        const firstVisible = visible[0];
        const a = firstVisible?.ordinary, b = firstVisible?.full;
        return {errors: first, visible: visible.length, distinct: !!a && !!core.renderer.properties.get(a).currentProgram && !!core.renderer.properties.get(b).currentProgram && core.renderer.properties.get(a).currentProgram !== core.renderer.properties.get(b).currentProgram};
      } finally {
        h.use(vs, 'ordinary'); vs.forEach(v => v.full.dispose());
        core.onTick = tick; core.wake(); core.tick();
      }
    });
    for (const e of compiled.errors) assert.ok(e.endsWith(':0'), `GL error after compile ${e}`);
    assert.ok(compiled.visible > 0, 'at least one title must be visible for GPU comparison');
    assert.equal(compiled.distinct, true, 'flag 0 and flag 1 must produce distinct programs');

    // Held-scene comparisons. `state` prepares uniforms; null = leave the live scene (hover/scroll) as is.
    const compareState = (name, progress) => run((arg, h) => {
      const {core, gl, gallery} = h;
      const tick = core.onTick, videos = [...document.querySelectorAll('video')];
      videos.forEach(v => v.pause());
      core.onTick = null;
      const vs = gallery.texts.map(h.variant);
      const previous = gallery.texts.map(t => t.progress);
      try {
        if (arg.progress != null) gallery.texts.forEach(t => { t.progress = arg.progress; });
        h.use(vs, 'ordinary'); h.read();
        h.use(vs, 'full'); h.read();
        h.use(vs, 'ordinary'); const ordinary = h.read();
        h.use(vs, 'full'); const full = h.read();
        h.use(vs, 'ordinary'); const again = h.read();
        const visibles = gallery.texts.map(t => t.mesh.visible);
        gallery.texts.forEach(t => { t.mesh.visible = false; });
        const hidden = h.read();
        gallery.texts.forEach((t, i) => { t.mesh.visible = visibles[i]; });
        const flip = h.diff(ordinary, again), result = h.diff(ordinary, full), title = h.diff(ordinary, hidden, 5);
        return {
          name: arg.name, progress: gallery.texts.map(t => t.progress),
          size: [gl.drawingBufferWidth, gl.drawingBufferHeight], glError: gl.getError(),
          deterministic: flip, ordinaryVsFull: result, titlePixels: title.changed,
          alpha: gallery.texts.map(t => t.material.uniforms.u_alpha.value),
        };
      } finally {
        h.use(vs, 'ordinary'); vs.forEach(v => v.full.dispose());
        gallery.texts.forEach((t, i) => { t.progress = previous[i]; });
        core.onTick = tick; core.wake(); core.tick();
      }
    }, {name, progress});

    const states = [];
    for (const progress of [0.1, 0.4, 0.7, 1]) states.push(await compareState(`progress-${progress}`, progress));

    // Real input, then freeze and compare.
    const card = frame.locator('[data-gl="card"]').first();
    const box = await card.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width / 2 + 4, box.y + box.height / 2 + 4, {steps:5});
    await page.waitForTimeout(900);
    states.push(await compareState('hover', null));
    await page.mouse.wheel(0, width > 600 ? 500 : 400);
    await page.waitForTimeout(1200);
    states.push(await compareState('scroll', null));

    for (const s of states) {
      assert.equal(s.glError, 0, `${s.name}: GL error`);
      assert.deepEqual(s.deterministic, {changed:0, max:0}, `${s.name}: ordinary render must be repeatable for the comparison to be valid`);
      assert.ok(s.titlePixels > 0, `${s.name}: titles must contribute pixels (${s.titlePixels})`);
      assert.deepEqual(s.ordinaryVsFull, {changed:0, max:0}, `${s.name}: ordinary vs full shader pixels differ (${JSON.stringify(s.ordinaryVsFull)})`);
    }
    const final = states.find(s => s.name === 'progress-1');
    assert.ok(final.titlePixels > 50, `Settled titles must visibly affect the canvas (${final.titlePixels})`);

    // Constructed real reel smoke (best effort; verifies old reel shader path with the flag compiled on).
    const reel = await run((arg, h) => {
      const {core, gl, gallery} = h;
      const source = gallery.texts.find(t => {
        const rect = t.el.getBoundingClientRect();
        return t.mesh.visible && rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight;
      });
      if (!source) throw new Error('No visible source title for reel smoke');
      const Ctor = source.constructor;
      const tick = core.onTick;
      const el = document.createElement('span');
      el.className = source.el.className;
      el.textContent = '2026';
      el.style.cssText = 'position:fixed;left:0;top:0;white-space:nowrap';
      source.el.parentElement.appendChild(el);
      let text = null;
      core.onTick = null;
      try {
        text = new Ctor({el, core, reel:true});
        if (!text.reel) return {skipped:'reel not enabled (no outline font for element)'};
        const rect = el.getBoundingClientRect();
        if (!text.solve(rect)) return {skipped:'digits outside baked face / solve failed'};
        const skip = new Set(['u_roll','u_spin','u_reel','u_reelH','u_planeW','u_planeH','u_window','u_stagger','u_texture','u_curves','u_alpha','u_progress']);
        for (const key of Object.keys(source.material.uniforms)) {
          if (skip.has(key)) continue;
          const from = source.material.uniforms[key].value, to = text.material.uniforms[key].value;
          if (from?.copy && to?.copy) to.copy(from); else if (typeof from === 'number') text.material.uniforms[key].value = from;
        }
        text.mesh.position.copy(source.mesh.position); text.mesh.quaternion.copy(source.mesh.quaternion); text.mesh.scale.copy(source.mesh.scale);
        text.mesh.visible = true;
        text.mesh.updateMatrixWorld(true);
        text.material.uniforms.u_alpha.value = 1; text.progress = 1;
        const ordinary = text.material, full = ordinary.clone();
        full.uniforms = ordinary.uniforms; full.defines = {...ordinary.defines, LIGERO_REEL_BLUR:1}; full.needsUpdate = true;
        const flag = ordinary.defines?.LIGERO_REEL_BLUR;
        const out = {flag, uReel:ordinary.uniforms.u_reel.value, digits:text.digits, label:el.textContent, frames:[]};
        const hideOthers = gallery.texts.map(t => t.mesh.visible);
        gallery.texts.forEach(t => { t.mesh.visible = false; });
        try {
          for (const roll of [[0,0,0,0], [0.35,0.5,0.65,0.8], [3.5,4.5,5.5,6.5]]) {
            text.set(roll.slice(0, text.slots));
            text.material.uniforms.u_spin.value.fill(0);
            if (roll[0] > 1) text.material.uniforms.u_spin.value.fill(text.material.uniforms.u_reelH.value * 0.3);
            text.mesh.material = ordinary; h.read(); const a = h.read();
            text.mesh.material = full; h.read(); const b = h.read();
            text.mesh.visible = false; const none = h.read(); text.mesh.visible = true;
            out.frames.push({roll, ordinaryVsFull:h.diff(a, b), titlePixels:h.diff(a, none, 5).changed, glError:gl.getError()});
          }
        } finally { gallery.texts.forEach((t, i) => { t.mesh.visible = hideOthers[i]; }); full.dispose(); }
        return out;
      } finally {
        if (text) { text.stage.remove(text.mesh); text.material.dispose(); text.owned?.dispose(); }
        el.remove(); core.onTick = tick; core.wake(); core.tick();
      }
    });
    if (reel.skipped) console.warn(`${width}/${theme} reel smoke skipped: ${reel.skipped}`);
    else {
      assert.equal(reel.flag, 1, 'Reel title must get LIGERO_REEL_BLUR=1');
      assert.equal(reel.uReel, 1);
      for (const f of reel.frames) {
        assert.equal(f.glError, 0, 'reel GL error');
        assert.ok(f.titlePixels > 0, 'reel must visibly draw before pixels can be compared');
        assert.deepEqual(f.ordinaryVsFull, {changed:0, max:0}, 'reel flag-1 material vs clone must match');
      }
    }

    assert.deepEqual(errors, [], 'Page errors: ' + errors.join(' | '));
    if (output) await page.screenshot({path:`${output}/text-shader-${theme}-${width}.png`});
    summary.push({width, theme, titles:facts.titles.map(t => t.text), states, reel});
  } finally {
    await context.close();
  }
}

try {
  for (const width of [1440, 390]) for (const theme of ['black', 'white']) {
    await check(`text shader ${width} ${theme}`, () => scenario(width, theme));
  }
} finally {
  if (output) await writeFile(`${output}/text-shader.json`, JSON.stringify({failures, summary}, null, 2));
  await browser.close();
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
