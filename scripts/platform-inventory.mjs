import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';

// Evidence inventory, not a claim that route references prove functional coverage.
const apiRoot = process.argv[2];
const output = process.argv[3] || 'qa-reports/platform-inventory';
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const parse = file => ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const prop = (node, name) => node.properties?.find(p => p.name?.getText().replaceAll(/["']/g, '') === name)?.initializer;
const literal = node => node && ts.isStringLiteralLike(node) ? node.text : undefined;
const routes = [];
function collect(node, parent = '') {
  if (ts.isObjectLiteralExpression(node)) {
    const segment = literal(prop(node, 'path'));
    const index = prop(node, 'index')?.kind === ts.SyntaxKind.TrueKeyword;
    const route = segment?.startsWith('/') ? segment : segment ? `${parent}/${segment}` : parent;
    const element = prop(node, 'element');
    if (element && (segment !== undefined || index)) {
      const text = element.getText();
      routes.push({ path: route || '/', page: text.match(/import\(["']\.\/pages\/([^"']+)/)?.[1] || null, dynamic: /[:*]/.test(route), redirect: /Navigate|Redirect/.test(text) });
    }
    const children = prop(node, 'children');
    if (children) { ts.forEachChild(children, n => collect(n, route)); return; }
  }
  ts.forEachChild(node, n => collect(n, parent));
}
collect(parse('src/app/routes.tsx'));
const tests = walk('tests').filter(f => /\.(spec|contract)\./.test(f)).map(file => ({ file, text: fs.readFileSync(file, 'utf8') }));
const pages = walk('src/app/pages').filter(f => /\.tsx?$/.test(f)).map(file => {
  const text = fs.readFileSync(file, 'utf8'); const name = path.basename(file).replace(/\.tsx?$/, '');
  const linked = routes.filter(r => r.page === name);
  return { file, lines: text.split('\n').length, sha256: crypto.createHash('sha256').update(text).digest('hex'), routes: linked.map(r => r.path),
    testReferences: tests.filter(t => linked.some(r => !r.dynamic && t.text.includes(r.path)) || t.text.includes(`/pages/${name}`)).map(t => t.file),
    parseErrors: parse(file).parseDiagnostics.length,
    browserPopups: [...text.matchAll(/\b(?:window\.)?(alert|confirm|prompt)\(/g)].map(m => m[1]),
    dialogs: [...text.matchAll(/<(Dialog|AlertDialog|Sheet)\b/g)].map(m => m[1]),
    note: 'Static inventory; test references are candidates, not execution or authorization proof.' };
});
const features = [];
function featureVisit(n) {
  if (ts.isObjectLiteralExpression(n) && literal(prop(n, 'status')) && literal(prop(n, 'name'))) features.push({name: literal(prop(n, 'name')), nameEn: literal(prop(n, 'nameEn')), status: literal(prop(n, 'status')), description: literal(prop(n, 'descEn'))});
  ts.forEachChild(n, featureVisit);
}
featureVisit(parse('src/app/lib/feature-catalog.ts'));
const endpoints = [];
if (apiRoot) for (const file of walk(path.join(apiRoot, 'src/routes')).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
  const source = parse(file);
  function visit(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && /^(get|post|patch|put|delete)$/.test(n.expression.name.text) && literal(n.arguments[0])) {
      endpoints.push({file: path.relative(apiRoot,file), method:n.expression.name.text.toUpperCase(), path:literal(n.arguments[0]), line:source.getLineAndCharacterOfPosition(n.pos).line+1, note:'Mount prefix and middleware must be reviewed in server.ts; declaration is not authorization evidence.'});
    }
    ts.forEachChild(n,visit);
  } visit(source);
}
fs.mkdirSync(output,{recursive:true});
const summary = {generatedAt:new Date().toISOString(),pages:pages.length,routeDeclarations:routes.length,apiEndpointDeclarations:endpoints.length,roadmapFeatures:features.length,parseErrors:pages.reduce((n,p)=>n+p.parseErrors,0),pagesWithTestReferences:pages.filter(p=>p.testReferences.length).length};
fs.writeFileSync(path.join(output,'inventory.json'),JSON.stringify({summary,routes,pages,features,endpoints},null,2));
fs.writeFileSync(path.join(output,'pages.csv'),'file,lines,routes,test_reference_count,parse_errors\n'+pages.map(p=>[p.file,p.lines,p.routes.join(' | '),p.testReferences.length,p.parseErrors].map(x=>JSON.stringify(String(x))).join(',')).join('\n'));
console.log(JSON.stringify(summary,null,2));
