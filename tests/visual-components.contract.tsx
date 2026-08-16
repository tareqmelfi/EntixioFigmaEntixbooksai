import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Button } from '../src/app/components/ui/button'
import { Card, CardContent, CardHeader } from '../src/app/components/ui/card'
import { Input } from '../src/app/components/ui/input'
import { TableCell, TableHead } from '../src/app/components/ui/table'

function className(markup: string) {
  return markup.match(/class="([^"]+)"/)?.[1] ?? ''
}

const button = className(renderToStaticMarkup(createElement(Button, null, 'Save')))
const input = className(renderToStaticMarkup(createElement(Input, { 'aria-label': 'Name' })))
assert.match(button, /\bh-9\b/)
assert.match(button, /\brounded-lg\b/)
assert.match(button, /focus-visible:ring-2/)
assert.doesNotMatch(button, /ring-\[3px\]/)
assert.match(input, /\bbg-surface\b/)
assert.match(input, /\brounded-lg\b/)
assert.match(input, /focus-visible:ring-2/)

const cardMarkup = renderToStaticMarkup(createElement(
  Card,
  { density: 'compact' },
  createElement(CardHeader, null, 'Header'),
  createElement(CardContent, null, 'Body'),
))
const card = className(cardMarkup)
assert.match(card, /\brounded-lg\b/)
assert.match(card, /\bgap-4\b/)
assert.doesNotMatch(card, /shadow-/)
assert.match(cardMarkup, /\bpx-4\b/)

const head = className(renderToStaticMarkup(createElement(TableHead, null, 'Name')))
const cell = className(renderToStaticMarkup(createElement(TableCell, null, 'Long entity name')))
assert.match(head, /\btext-start\b/)
assert.doesNotMatch(head, /\btext-left\b/)
assert.match(head, /\[&amp;:has\(\[role=checkbox\]\)\]:pe-0/)
assert.doesNotMatch(cell, /whitespace-nowrap/)
assert.match(cell, /\[&amp;:has\(\[role=checkbox\]\)\]:pe-0/)

console.log('visual component contracts passed')
