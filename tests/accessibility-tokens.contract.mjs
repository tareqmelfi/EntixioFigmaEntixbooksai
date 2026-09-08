import assert from 'node:assert/strict'

function luminance(hex) {
  const channels = hex.match(/[\da-f]{2}/gi).map(value => Number.parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}
function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

for (const [name, foreground, background] of [
  ['primary on card', '4661c7', 'fffdf9'],
  ['primary on paper', '4661c7', 'f6f1e8'],
  ['info on subtle', '4661c7', 'edf0fb'],
  ['success on subtle', '4661c7', 'edf0fb'],
  ['warning on subtle', '8a5f14', 'f7eedc'],
  ['danger on subtle', '9e3b2e', 'fbefec'],
  // Savings green — the narrow commercial exception used by the annual-plan
  // discount chips on the public pricing surfaces (see --savings in theme.css).
  ['savings on subtle', '1f6b45', 'e8f4ed'],
  ['savings on card', '1f6b45', 'fffdf9'],
  ['savings on paper', '1f6b45', 'f6f1e8'],
]) {
  assert.ok(contrast(foreground, background) >= 4.5, `${name}: ${contrast(foreground, background).toFixed(2)}:1`)
}

console.log('accessible semantic token contrasts passed')
