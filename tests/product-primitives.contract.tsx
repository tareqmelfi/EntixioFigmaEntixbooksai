import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  DataTable,
  EmptyState,
  FormField,
  Metric,
  PageHeader,
  PageToolbar,
  SectionHeader,
  StatusBadge,
} from '../src/app/components/product'

const element = createElement
const page = renderToStaticMarkup(element(PageHeader, {
  title: 'Invoices', description: 'Review issued invoices', actions: element('button', null, 'New'),
}))
const section = renderToStaticMarkup(element(SectionHeader, {
  title: 'Recent activity', actions: element('button', null, 'Export'),
}))
assert.match(page, /<h1/)
assert.match(page, /\btext-page\b/)
assert.match(page, /\bflex-wrap\b/)
assert.match(section, /<h2/)
assert.match(section, /\btext-section\b/)

const metric = renderToStaticMarkup(element(Metric, { label: 'Revenue', value: '12,500.00', tone: 'success' }))
const badge = renderToStaticMarkup(element(StatusBadge, { tone: 'warning' }, 'Needs review'))
assert.match(metric, /^<div class="[^"]*\bbg-surface\b[^"]*">/)
assert.match(metric, /\btabular-nums\b/)
assert.doesNotMatch(metric, /^<div class="[^"]*\bbg-success\b/)
assert.doesNotMatch(badge, /role="status"/)
assert.match(badge, /Needs review/)
const liveBadge = renderToStaticMarkup(element(StatusBadge, { tone: 'info', live: true }, 'Updated'))
assert.match(liveBadge, /role="status"/)
assert.match(badge, /\bbg-warning-subtle\b/)

const field = renderToStaticMarkup(element(FormField, {
  id: 'supplier', label: 'Supplier', help: 'Choose an existing supplier',
  error: 'Supplier is required', required: true,
}, element('input')))
assert.match(field, /for="supplier"/)
assert.match(field, /id="supplier"/)
assert.match(field, /aria-invalid="true"/)
assert.match(field, /aria-describedby="supplier-help supplier-error"/)
assert.match(field, /role="alert"/)

const preservedField = renderToStaticMarkup(element(FormField, {
  id: 'reference', label: 'Reference', help: 'Wrapper help',
}, element('input', {
  required: true,
  'aria-invalid': 'grammar',
  'aria-describedby': 'external-help',
})))
assert.match(preservedField, /required=""/)
assert.match(preservedField, /aria-invalid="grammar"/)
assert.match(preservedField, /aria-describedby="external-help reference-help"/)

const childIdField = renderToStaticMarkup(element(FormField, {
  id: 'wrapper-id', label: 'Reference',
}, element('input', { id: 'child-id' })))
assert.match(childIdField, /for="child-id"/)
assert.match(childIdField, /id="child-id"/)
assert.doesNotMatch(childIdField, /for="wrapper-id"/)

const toolbar = renderToStaticMarkup(element(PageToolbar, { 'aria-label': 'Invoice filters' }, element('button', null, 'All')))
const empty = renderToStaticMarkup(element(EmptyState, { title: 'No invoices', description: 'Create your first invoice' }))
assert.match(toolbar, /role="toolbar"/)
assert.match(toolbar, /aria-label="Invoice filters"/)
assert.match(toolbar, /\bflex-wrap\b/)
assert.match(empty, /role="status"/)
assert.match(empty, /\btext-center\b/)

const dataTable = renderToStaticMarkup(element(DataTable, {
  columns: [
    { key: 'name', header: 'Name', cell: (row: { name: string; total: string }) => row.name },
    { key: 'total', header: 'Total', numeric: true, cell: (row: { name: string; total: string }) => row.total },
  ],
  rows: [{ name: 'عميل تجريبي', total: 'USD 1,250.00' }],
  rowKey: (row: { name: string }) => row.name,
  loading: true,
  error: 'Could not refresh records',
}))
assert.match(dataTable, /aria-busy="true"/)
assert.match(dataTable, /role="alert"/)
assert.match(dataTable, /Could not refresh records/)
assert.match(dataTable, /dir="ltr"/)
assert.match(dataTable, /\btabular-nums\b/)

console.log('product primitive contracts passed')
