/** Renders what `Pieces.build()` returned. */
export function Merged({ parts, shadow = true }) {
  return parts.map(({ material, geometry }, i) => (
    <mesh key={i} geometry={geometry} material={material} castShadow={shadow && !material.transparent} receiveShadow />
  ))
}
