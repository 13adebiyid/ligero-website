const FADE_IN_MS = 200, FADE_OUT_MS = 400, FADE_OUT_DELAY_MS = 1000, PARALLAX = 0.2, RADIUS = 0.02, DARKEN = 0.275, DUOTONE = 0.1;
const VERT = `attribute vec2 aPos; uniform vec2 uCenter, uSize, uViewport; varying vec2 vUv;
void main(){ vUv = aPos + 0.5; vec2 p = uCenter + vec2(aPos.x, -aPos.y) * uSize;
  gl_Position = vec4(p.x / uViewport.x * 2.0 - 1.0, 1.0 - p.y / uViewport.y * 2.0, 0.0, 1.0); }`;
const ROUND = `
float drawRoundedRect(float longSide, float shortSide, float differenceXY, float c) {
  if (longSide < 0.0) differenceXY = -differenceXY;
  if (abs(longSide) < abs(differenceXY) + c) longSide = -c; else longSide -= differenceXY;
  if (abs(shortSide) < c) shortSide = -c;
  return length(abs(vec2(longSide, shortSide)) - c);
}`;
const FRAG = `#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform sampler2D tMap, tThumb, tDuo; uniform vec2 uPlane, uVideoSize, uThumbSize, uParallax;
uniform float uThumbOpacity, uOpacity; uniform vec2 uRes; varying vec2 vUv;
${ROUND}
vec2 cover(vec2 p, vec2 s){ vec2 r = vec2(min((p.x/p.y)/(s.x/s.y),1.0), min((p.y/p.x)/(s.y/s.x),1.0));
  return vUv * r + (1.0 - r) * 0.5 + uParallax; }
void main(){
  vec2 uvV = cover(uPlane, uVideoSize), uvT = cover(uPlane, uThumbSize);
  vec3 c = mix(texture2D(tMap, uvV).rgb, texture2D(tThumb, uvT).rgb, uThumbOpacity);
  c = mix(c, min(c, texture2D(tDuo, uvV).rgb), ${DUOTONE});
  c = mix(c, vec3(0.0), ${DARKEN});
  vec2 centered = vUv * uRes - uRes * 0.5;
  float cr = min(uRes.x, uRes.y) / 2.0 - ${RADIUS} * uRes.x;
  float diff = (uRes.x - uRes.y) / 2.0, rel;
  if (diff > 0.0) rel = log(drawRoundedRect(centered.x, centered.y, diff, cr) / (uRes.y / 2.0 - cr));
  else rel = log(drawRoundedRect(centered.y, centered.x, abs(diff), cr) / (uRes.x / 2.0 - cr));
  float w = max(fwidth(rel) * 0.8, 0.0005);
  float a = (1.0 - smoothstep(-0.5 * w, 0.5 * w, rel)) * uOpacity;
  gl_FragColor = vec4(c * a, a); }`;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const loadImage = (url) => new Promise((res, rej) => {
  const img = new Image(); img.decoding = 'async'; img.crossOrigin = 'anonymous';
  img.onload = () => res(img); img.onerror = () => rej(new Error(`Failed to load image: ${url}`));
  img.src = url;
});

export class VideoRenderer {
  constructor(canvas, sources, invalidate) {
    this.canvas = canvas; this.sources = sources; this.invalidate = invalidate;
    this.videos = sources.map(() => null);
    this.videoState = sources.map(() => ({ playing: false, failed: false, framePending: false, frameStamp: null, thumb: 1, tween: null, tex: null, vw: 1, vh: 1, mode: 'out', cancel: null, off: null }));
    this.thumbs = []; this.active = -1; this.disposed = false;
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) throw new Error('WebGL1 context unavailable');
    this.gl = gl;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s); gl.deleteShader(s);
        throw new Error(`Shader compile failed (${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'}): ${log}`);
      } return s;
    };
    if (!gl.getExtension('OES_standard_derivatives')) throw new Error('OES_standard_derivatives unavailable');
    const vs = sh(gl.VERTEX_SHADER, VERT);
    let fs;
    try { fs = sh(gl.FRAGMENT_SHADER, FRAG); } catch (e) { gl.deleteShader(vs); throw e; }
    const prog = this.program = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog); gl.deleteProgram(prog); this.program = null;
      throw new Error(`Program link failed: ${log}`);
    }
    this.u = {};
    for (const n of ['tMap','tThumb','tDuo','uPlane','uVideoSize','uThumbSize','uParallax','uThumbOpacity','uOpacity','uRes','uCenter','uSize','uViewport'])
      this.u[n] = gl.getUniformLocation(prog, n);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-.5,-.5, .5,-.5, -.5,.5, .5,.5]), gl.STATIC_DRAW);
    this.aPos = gl.getAttribLocation(prog, 'aPos');
    this.videoTex = this._texture(); // 1x1 black placeholder bound until a slide has its own video frame
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,255]));
    this.ready = this._load();
  }

  _texture() {
    const gl = this.gl, t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  _upload(tex, src) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  }

  async _load() {
    const [imgs, duo] = await Promise.all([
      Promise.all(this.sources.map((s) => loadImage(s.poster))),
      loadImage(new URL('./duotone.jpg', import.meta.url).href),
    ]);
    if (this.disposed) return;
    this.thumbs = imgs.map((img) => {
      const tex = this._texture(); this._upload(tex, img);
      return { tex, w: img.naturalWidth, h: img.naturalHeight };
    });
    this.duoTex = this._texture(); this._upload(this.duoTex, duo);
    this.invalidate?.();
  }

  _ensureVideo(i) {
    if (this.videos[i]) return this.videos[i];
    const v = document.createElement('video'), st = this.videoState[i];
    st.framePending = false; st.frameStamp = null;
    v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
    v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.preload = 'auto'; v.crossOrigin = 'anonymous';
    const on = (ev, fn) => { v.addEventListener(ev, fn); return () => v.removeEventListener(ev, fn); };
    const offs = [
      on('playing', () => { if (!st.failed) { st.playing = true; this._frameLoop(i); this.invalidate?.(); } }),
      on('pause', () => { st.playing = false; this._cancelFrames(i); }),
      on('error', () => {
        console.warn(`Preview video failed for slide ${i}; keeping poster`, v.error);
        st.failed = true; st.playing = false; this._cancelFrames(i); this.invalidate?.();
      }),
    ];
    st.off = () => offs.forEach((f) => f());
    v.src = this.sources[i].preview;
    this.videos[i] = v;
    return v;
  }

  _frameLoop(i) {
    const v = this.videos[i], st = this.videoState[i];
    if (!v || st.cancel) return;
    const hasRvfc = typeof v.requestVideoFrameCallback === 'function';
    const request = (fn) => hasRvfc ? v.requestVideoFrameCallback(fn) : requestAnimationFrame(fn);
    const cancel = (h) => hasRvfc ? v.cancelVideoFrameCallback(h) : cancelAnimationFrame(h);
    st.handle = request((_, metadata) => {
      st.handle = null; st.cancel = null;
      if (!st.playing || this.disposed) return;
      const stamp = metadata?.presentedFrames ?? v.getVideoPlaybackQuality?.().totalVideoFrames ?? v.currentTime;
      if (stamp !== st.frameStamp) {
        st.frameStamp = stamp; st.framePending = true;
        this.invalidate?.();
      }
      this._frameLoop(i);
    });
    st.cancel = () => { if (st.handle != null) cancel(st.handle); st.handle = null; st.cancel = null; };
  }

  _cancelFrames(i) { this.videoState[i].cancel?.(); }

  _release(i) {
    const v = this.videos[i], st = this.videoState[i];
    this._cancelFrames(i); st.off?.(); st.off = null; st.playing = false; st.framePending = false;
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); this.videos[i] = null; }
    if (st.mode === 'in') { // reference stop(): thumbnail returns after 1s over .4s; last video frame stays meanwhile
      st.mode = 'out'; st.tween = { from: st.thumb, to: 1, delay: FADE_OUT_DELAY_MS, dur: FADE_OUT_MS, start: null };
      this.invalidate?.();
    }
  }

  setActive(index) {
    if (this.disposed) return;
    const prev = this.active;
    this.active = index >= 0 && index < this.sources.length ? index : -1;
    this.videos.forEach((v, i) => {
      if (!v || i === this.active) return;
      this._release(i);
    });
    if (this.active >= 0) {
      const i = this.active, v = this._ensureVideo(i);
      if (!this.videoState[i].failed) {
        const p = v.play();
        p?.catch?.((err) => {
          if (err?.name === 'AbortError' || this.active !== i) return;
          console.warn(`Preview video play rejected for slide ${i}; keeping poster`, err);
          this.videoState[i].failed = true; this.invalidate?.();
        });
      }
    }
    if (prev !== this.active) this.invalidate?.();
  }

  render(states, now) {
    const gl = this.gl;
    if (this.disposed || !this.duoTex || gl.isContextLost()) return;
    const cssW = this.canvas.clientWidth || this.canvas.width, cssH = this.canvas.clientHeight || this.canvas.height;
    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    const pw = Math.max(1, Math.round(cssW * dpr)), ph = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== pw || this.canvas.height !== ph) { this.canvas.width = pw; this.canvas.height = ph; }
    gl.viewport(0, 0, pw, ph);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.aPos); gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);
    const u = this.u;
    gl.uniform1i(u.tMap, 0); gl.uniform1i(u.tThumb, 1); gl.uniform1i(u.tDuo, 2);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.duoTex);
    gl.uniform2f(u.uViewport, cssW, cssH);
    const order = states.map((s, i) => i).sort((a, b) => (states[a].order - states[b].order) || (a - b));
    let animating = false;
    for (const i of order) {
      const s = states[i], th = this.thumbs[i];
      if (!s || !th || !(s.opacity > 0) || !(s.width > 0) || !(s.height > 0)) continue;
      const st = this.videoState[i], v = this.videos[i];
      gl.activeTexture(gl.TEXTURE0);
      if (i === this.active && v && st.playing && st.framePending && !st.failed && v.readyState >= 2 && v.videoWidth > 0) {
        st.tex ||= this._texture();
        this._upload(st.tex, v); st.framePending = false; st.vw = v.videoWidth; st.vh = v.videoHeight;
        if (st.mode !== 'in') {
          st.mode = 'in'; st.tween = { from: st.thumb, to: 0, delay: 0, dur: FADE_IN_MS, start: null };
        }
      }
      const tw = st.tween;
      if (tw) {
        if (tw.start == null) tw.start = now;
        const t = clamp01((now - tw.start - tw.delay) / tw.dur);
        st.thumb = tw.from + (tw.to - tw.from) * t;
        if (t >= 1) st.tween = null; else animating = true;
      }
      gl.bindTexture(gl.TEXTURE_2D, st.tex && st.thumb < 1 ? st.tex : this.videoTex);
      const vw = st.tex ? st.vw : 1, vh = st.tex ? st.vh : 1, thumbOpacity = st.tex ? st.thumb : 1;
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, th.tex);
      gl.uniform2f(u.uCenter, cssW / 2 + s.x, cssH / 2 + s.y);
      gl.uniform2f(u.uSize, s.width, s.height);
      gl.uniform2f(u.uPlane, s.width, s.height);
      gl.uniform2f(u.uRes, s.width * dpr, s.height * dpr);
      gl.uniform2f(u.uVideoSize, vw, vh);
      gl.uniform2f(u.uThumbSize, th.w, th.h);
      gl.uniform2f(u.uParallax, 0, -(s.y / cssH) * PARALLAX * (s.height / cssH));
      gl.uniform1f(u.uThumbOpacity, thumbOpacity);
      gl.uniform1f(u.uOpacity, s.opacity);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    if (animating) this.invalidate?.();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.videos.forEach((v, i) => {
      const st = this.videoState[i];
      this._cancelFrames(i); st.off?.();
      if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
      st.tween = null;
    });
    this.videos.fill(null);
    const gl = this.gl;
    if (!gl.isContextLost()) {
      this.thumbs.forEach((t) => gl.deleteTexture(t.tex));
      this.videoState.forEach((st) => { if (st.tex) gl.deleteTexture(st.tex); st.tex = null; });
      gl.deleteTexture(this.videoTex); if (this.duoTex) gl.deleteTexture(this.duoTex);
      gl.deleteBuffer(this.buffer); gl.deleteProgram(this.program);
    }
    this.thumbs = []; this.invalidate = null;
  }
}
