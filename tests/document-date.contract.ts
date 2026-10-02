import assert from 'node:assert/strict';
import { parseDocumentDate } from '../src/app/lib/document-date';
for (const [input, expected] of [
  ['02/08/2016', '2016-08-02'], ['٠٢/٠٨/٢٠١٦', '2016-08-02'], ['۰۲/۰۸/۲۰۱۶', '2016-08-02'],
  ['2016-2-29', '2016-02-29'], ['29022016', '2016-02-29'], ['29.02.16', '2016-02-29'],
  ['01/01/1900', '1900-01-01'], ['31/12/2099', '2099-12-31'], ['29/02/2000', '2000-02-29'],
  ['2016-02-30', ''], ['29/02/2015', ''], ['29/02/1900', ''], ['31042016', ''],
  ['2016-13-01', ''], ['2016-00-01', ''], ['2016-01-00', ''], ['0000-01-01', ''],
  ['02/08/216', ''], ['31/12/202026', ''], ['not a date', ''], ['  ', null],
] as const) assert.equal(parseDocumentDate(input), expected, input);
console.log('Document date contract passed: historical, Arabic/Persian digits, leap years and invalid dates.');
