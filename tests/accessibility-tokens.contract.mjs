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
  ['primary on white', '0f62c3', 'ffffff'],
  ['info on subtle', '0f62c3', 'eff6ff'],
  ['success on subtle', '126c4a', 'eef9f4'],
  ['warning on subtle', '815200', 'fff8e6'],
  ['danger on subtle', 'b4233e', 'fff1f3'],
]) {
  assert.ok(contrast(foreground, background) >= 4.5, `${name}: ${contrast(foreground, background).toFixed(2)}:1`)
}

console.log('accessible semantic token contrasts passed')
