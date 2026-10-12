import {
  HalfFloatType,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
} from 'three'

/**
 * Final colour pass. The world (and the viewmodel) are rendered into an HDR
 * target; this pass tone-maps it (ACES, as three would), converts to sRGB,
 * smooths the jagged edges (FXAA), then grades it like a grim war film in a
 * dust storm: bleach-bypass contrast, drained colour, sickly green shadows
 * against burnt amber highlights, blacks lifted by the dust in the air, film
 * grain and a heavy vignette (or with a map's own look, see setLook).
 *
 * The target is not multisampled: MSAA on a half-float target cost an
 * integrated GPU (Radeon 780M) three times the rest of the frame put together
 * (21 ms against 6 ms at 1080p); FXAA in this same pass costs a fraction of a
 * millisecond.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D tScene;
  uniform float exposure;
  uniform float contrast;
  uniform float saturation;
  uniform vec3 shadowTint;
  uniform vec3 highlightTint;
  uniform float vignette;
  uniform float bleach;
  uniform vec2 aspect;
  uniform float grain;
  uniform float time;
  uniform vec3 dust;
  uniform float lift;
  uniform vec2 texel;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  // three.js's ACES filmic (Stephen Hill's RRT+ODT fit), so the base look matches.
  vec3 RRTAndODTFit(vec3 v) {
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
  }
  vec3 acesFilmic(vec3 color) {
    const mat3 ACESInputMat = mat3(
      vec3(0.59719, 0.07600, 0.02840),
      vec3(0.35458, 0.90834, 0.13383),
      vec3(0.04823, 0.01566, 0.83777)
    );
    const mat3 ACESOutputMat = mat3(
      vec3( 1.60475, -0.10208, -0.00327),
      vec3(-0.53108,  1.10813, -0.07276),
      vec3(-0.07367, -0.00605,  1.07602)
    );
    color *= exposure / 0.6;
    color = ACESInputMat * color;
    color = RRTAndODTFit(color);
    color = ACESOutputMat * color;
    return clamp(color, 0.0, 1.0);
  }
  vec3 toSRGB(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }
  vec3 tonemapped(vec2 uv) {
    return toSRGB(acesFilmic(texture2D(tScene, uv).rgb));
  }
  // Brightness for finding edges: the luminance through a one-channel stand-in
  // for the tone curve (Narkowicz's ACES fit, then gamma 2). Close enough to the
  // tone-mapped colour's luma to find the same edges, at a fraction of the cost.
  float edgeLuma(vec2 uv) {
    float x = dot(texture2D(tScene, uv).rgb, vec3(0.2126, 0.7152, 0.0722)) * exposure;
    return sqrt(clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0));
  }

  // FXAA (the compact "FXAA 2" form): find the edge from the corners' luma,
  // blur along it, and keep the wider blur only if it stays in range.
  vec3 antialiased(vec2 uv) {
    const vec3 L = vec3(0.299, 0.587, 0.114);
    float lNW = edgeLuma(uv + vec2(-1.0, -1.0) * texel);
    float lNE = edgeLuma(uv + vec2(1.0, -1.0) * texel);
    float lSW = edgeLuma(uv + vec2(-1.0, 1.0) * texel);
    float lSE = edgeLuma(uv + vec2(1.0, 1.0) * texel);
    float lM = edgeLuma(uv);
    float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
    float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
    // Flat areas: nothing to smooth (and most of the screen is flat).
    if (lMax - lMin < max(0.0312, lMax * 0.125)) return tonemapped(uv);
    vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
    float reduce = max((lNW + lNE + lSW + lSE) * (0.25 / 8.0), 1.0 / 128.0);
    float rcpMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
    dir = clamp(dir * rcpMin, vec2(-8.0), vec2(8.0)) * texel;
    vec3 a = 0.5 * (tonemapped(uv + dir * (1.0 / 3.0 - 0.5)) + tonemapped(uv + dir * (2.0 / 3.0 - 0.5)));
    vec3 b = a * 0.5 + 0.25 * (tonemapped(uv - dir * 0.5) + tonemapped(uv + dir * 0.5));
    float lB = dot(b, L);
    return (lB < lMin || lB > lMax) ? a : b;
  }

  void main() {
    vec3 c = antialiased(vUv);
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    // Split toning: tint the darks and the brights separately.
    c += shadowTint * (1.0 - smoothstep(0.0, 0.5, luma)) + highlightTint * smoothstep(0.5, 1.0, luma);
    // Bleach bypass: overlay the image with its own luminance — the gritty,
    // silvery, high-contrast war-film look.
    vec3 over = mix(2.0 * c * luma, 1.0 - 2.0 * (1.0 - c) * (1.0 - luma), step(0.5, luma));
    c = mix(c, over, bleach);
    // Saturation, then contrast around mid grey.
    c = mix(vec3(luma), c, saturation);
    c = (c - 0.5) * contrast + 0.5;
    // Dust in the air: nothing is ever quite black.
    c = c * (1.0 - lift) + dust * lift;
    // Soft vignette (round, regardless of the window's shape), browned at the edge.
    vec2 d = (vUv - 0.5) * aspect;
    float v = smoothstep(0.22, 0.85, length(d));
    c *= 1.0 - vignette * v;
    c = mix(c, c * vec3(0.92, 0.84, 0.72), v * 0.5);
    // Film grain, stronger in the darks.
    float n = hash(gl_FragCoord.xy + fract(time * 7.13) * 911.0) - 0.5;
    c += n * grain * (1.15 - luma);
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }
`

const LOOK_KEYS = ['exposure', 'contrast', 'saturation', 'shadowTint', 'highlightTint', 'vignette', 'bleach', 'grain', 'dust', 'lift']

export class ColorGrade {
  /** `samples`: MSAA on the HDR target. Leave at 0: the pass anti-aliases itself (FXAA). */
  constructor({ samples = 0 } = {}) {
    this.target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples })
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        tScene: { value: this.target.texture },
        exposure: { value: 1.02 },
        contrast: { value: 1.15 },
        saturation: { value: 0.66 },
        shadowTint: { value: [-0.03, 0.016, 0.0] },
        highlightTint: { value: [0.05, 0.018, -0.04] },
        vignette: { value: 0.48 },
        bleach: { value: 0.4 },
        aspect: { value: new Vector2(1, 1) },
        grain: { value: 0.05 },
        time: { value: 0 },
        dust: { value: [0.42, 0.36, 0.28] },
        lift: { value: 0.07 },
        texel: { value: new Vector2(1, 1) },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
    /** The war-film look above, to go back to after a map with its own. */
    this.base = Object.fromEntries(LOOK_KEYS.map((k) => [k, this.material.uniforms[k].value]))
    this.look = null
    this.scene = new Scene()
    const quad = new Mesh(new PlaneGeometry(2, 2), this.material)
    quad.frustumCulled = false
    this.scene.add(quad)
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this._size = new Vector2()
  }

  /** A map's own grade (environment.js), or null for the default. Cheap to call every frame. */
  setLook(look) {
    if (look === this.look) return
    this.look = look
    const values = look ?? this.base
    for (const k of LOOK_KEYS) if (values[k] !== undefined) this.material.uniforms[k].value = values[k]
  }

  /** Whether this renderer can keep an HDR (half-float) target; otherwise skip grading. */
  static supported(gl) {
    const ext = gl.extensions
    return gl.capabilities.isWebGL2 && (ext.has('EXT_color_buffer_half_float') || ext.has('EXT_color_buffer_float'))
  }

  /** Sizes the target to the canvas and points rendering at it. */
  begin(gl) {
    gl.getDrawingBufferSize(this._size)
    const w = Math.max(1, Math.floor(this._size.x))
    const h = Math.max(1, Math.floor(this._size.y))
    if (this.target.width !== w || this.target.height !== h) {
      this.target.setSize(w, h)
      const a = w / h
      this.material.uniforms.aspect.value.set(a > 1 ? a : 1, a > 1 ? 1 : 1 / a)
      this.material.uniforms.texel.value.set(1 / w, 1 / h)
    }
    gl.setRenderTarget(this.target)
    gl.clear()
  }

  /** Resolves the target onto the screen through the grade. */
  end(gl) {
    this.material.uniforms.time.value = performance.now() / 1000
    gl.setRenderTarget(null)
    gl.clear()
    gl.render(this.scene, this.camera)
  }

  dispose() {
    this.target.dispose()
    this.material.dispose()
  }
}
