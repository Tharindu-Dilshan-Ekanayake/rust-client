/**
 * Layer for shadow-only stand-ins (merged, positions-only copies of things
 * that cast shadows): drawn into the sun's shadow map, never in the view, so
 * they cost nothing in the main pass.
 */
export const SHADOW_ONLY_LAYER = 3

/**
 * three.js tests layers in the shadow pass against the VIEW camera's layers
 * (the camera given to render()), not the light's shadow camera. The shadow
 * pass runs after the main pass has already picked what to draw, so the view
 * camera gets the shadow-only layer for just that pass.
 */
export function enableShadowOnlyLayer(gl) {
  const shadowMap = gl.shadowMap
  if (shadowMap.shadowOnlyLayer) return
  const render = shadowMap.render
  shadowMap.render = function (lights, scene, camera) {
    const mask = camera.layers.mask
    camera.layers.enable(SHADOW_ONLY_LAYER)
    try {
      return render.call(this, lights, scene, camera)
    } finally {
      camera.layers.mask = mask
    }
  }
  shadowMap.shadowOnlyLayer = true
}
