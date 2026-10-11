/**
 * Renders the sound bank off the main thread: every sound is synthesised
 * sample by sample, which is over a second of CPU even on a fast machine and
 * would stutter the game if done alongside it. Each sound is posted back as
 * soon as it's ready (gunshots first), as transferable sample arrays.
 */
import { BANK_SAMPLE_RATE, bankRecipes } from './bank.js'

self.onmessage = () => {
  let seed = 1
  for (const [name, count, render] of bankRecipes()) {
    const variants = []
    for (let v = 0; v < count; v++) variants.push(render(seed++ * 7919))
    self.postMessage({ name, variants, sampleRate: BANK_SAMPLE_RATE }, variants.map((d) => d.buffer))
  }
  self.postMessage({ done: true })
}
