import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const start = source.indexOf('/* ===== PMM_MUTATION_FILTER:');
const end = source.indexOf('/* ===== PMM_MUTATION_FILTER END ===== */', start);
assert.ok(start >= 0 && end > start);
const affects = vm.runInNewContext(source.slice(start, end) + '\npmmMutationsAffect');
const doc = {};
class Element {
  constructor(id, parent = null) {
    this.nodeType = 1; this.id = id; this.parentElement = parent; this.ownerDocument = doc; this.children = [];
    parent?.children.push(this);
  }
  matches(selector) { return selector.split(',').some(s => s.trim() === '#' + this.id); }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector); }
  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const found = child.querySelector(selector); if (found) return found;
    }
    return null;
  }
}
const html = doc.documentElement = new Element('html');
const body = doc.body = new Element('body', html);
doc.querySelector = selector => html.querySelector(selector);
const chat = new Element('chat', body), message = new Element('message', chat);
const panel = new Element('panel', body), row = new Element('row', panel);
const mutation = (target, addedNodes = [], removedNodes = []) => ({ type:'childList', target, addedNodes, removedNodes });
const attribute = target => ({ type:'attributes', target });
const text = parentElement => ({ nodeType:3, parentElement });
assert.equal(affects([], '#panel'), false);
assert.equal(affects([mutation(message, [new Element('token')])], '#panel'), false);
assert.equal(affects([attribute(message)], '#panel', true), false);
assert.equal(affects([mutation(body, [text(null)])], '#panel', true), false);
assert.equal(affects([mutation(row, [text(row)])], '#panel'), true);
assert.equal(affects([attribute(row)], '#panel'), true);
assert.equal(affects([{ type:'characterData', target:text(row) }], '#panel'), true);
assert.equal(affects([{ type:'characterData', target:text(message) }], '#panel'), false);
assert.equal(affects([mutation(body, [new Element('other'), panel])], '#panel'), true);
assert.equal(affects([mutation(body, [], [panel])], '#panel'), true);
const wrapper = new Element('wrapper'); new Element('panel', wrapper);
assert.equal(affects([mutation(body, [wrapper])], '#panel'), true);
assert.equal(affects([mutation(body, [], [wrapper])], '#panel'), true);
assert.equal(affects([mutation(body, [wrapper])], '#missing,#panel'), true);
assert.equal(affects([attribute(html)], '#panel'), false);
assert.equal(affects([attribute(html)], '#panel', true), true);
assert.equal(affects([attribute(body)], '#panel', true), true);
assert.equal(affects([mutation(body, [message])], '#panel', true), false);
const otherDoc = { querySelector:()=>null };
const otherBody = otherDoc.body = { nodeType:1, ownerDocument:otherDoc, closest:()=>null };
assert.equal(affects([attribute(otherBody)], '#panel', true), false, 'Theme/style changes in unrelated iframes stay unrelated');
message.querySelector = () => { throw Error('Unrelated attributes must not scan descendants'); };
assert.equal(affects([attribute(message)], '#panel', true), false);
assert.equal(affects([mutation(message), mutation(row)], '#panel'), true);
// Plain node-like objects from another realm must work without instanceof checks.
assert.equal(affects([mutation(body, [{ nodeType:1, matches:()=>true }])], '#panel'), true);
assert.ok(source.includes('#preset-manager-floating-panel,#settings_preset_openai,select[data-preset-manager-for*="openai"]'), 'Floating synchronization must retain native preset dependencies');
assert.equal((source.match(/pmmMutationsAffect\(records,/g) || []).length, 8, 'All seven full-page UI observers use the filter');
for (const file of ['test24-group-select-nesting.js','test26-tauri-editor-overflow.js']) {
  assert.ok((await readFile(new URL('../patches/' + file, import.meta.url), 'utf8')).includes('pmmMutationsAffect(records, PANEL_SELECTOR, true)'), 'Patch source must retain the filter: ' + file);
}
console.log('Mutation filtering: unrelated chat, text, batch changes, root/wrapper mount/removal, inherited host attributes and cross-realm nodes passed.');
