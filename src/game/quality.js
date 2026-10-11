/** Graphics quality levels, lowest first. */
export const QUALITY_STEPS = ['low', 'medium', 'high']

/**
 * A starting quality for this machine, from the GPU the browser reports and
 * the CPU/memory it has. Software renderers and basic integrated GPUs get
 * Low; better integrated GPUs (Iris Xe, Radeon APUs, Apple) get Medium;
 * dedicated cards get High. The frame-rate watchdog corrects it from there.
 */
export function detectQuality(gl) {
  let renderer = ''
  try {
    const ctx = gl.getContext()
    const ext = ctx.getExtension('WEBGL_debug_renderer_info')
    renderer = String(ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER)).toLowerCase()
  } catch {
    // Unknown GPU: decide from the CPU and memory alone.
  }
  const cores = navigator.hardwareConcurrency || 4
  const memory = navigator.deviceMemory || 8
  let q = 'high'
  if (/swiftshader|llvmpipe|softpipe|software|microsoft basic render/.test(renderer)) q = 'low'
  else if (/mali|adreno|powervr|videocore|intel.*\b(hd|uhd)\b graphics|intel\(r\) (hd|uhd)|gma/.test(renderer)) q = 'low'
  else if (/intel|iris|radeon(\(tm\))? graphics|radeon vega|vega \d|apple|amd radeon r\d/.test(renderer)) q = 'medium'
  // A weak CPU or little memory holds back even a good GPU.
  if (cores <= 2 || memory <= 2) q = 'low'
  else if ((cores <= 4 || memory <= 4) && q === 'high') q = 'medium'
  return q
}
