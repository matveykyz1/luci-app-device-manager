'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function E(tag, attrs, children) {
	const node = {
		tag,
		attrs: {},
		children: Array.isArray(children) ? children : children == null ? [] : [children],
		appendChild(child) { this.children.push(child); },
		replaceChildren(...items) { this.children = items; },
		addEventListener() {},
		focus() {},
		select() {}
	};
	for (const [key, value] of Object.entries(attrs || {})) {
		if (value != null) node.attrs[key] = value;
	}
	return node;
}

function find(node, predicate, result = []) {
	if (!node || typeof node !== 'object') return result;
	if (predicate(node)) result.push(node);
	for (const child of node.children || []) find(child, predicate, result);
	return result;
}

const source = fs.readFileSync(path.join(__dirname, '../htdocs/luci-static/resources/view/device-manager/overview.js'), 'utf8');
let modal;
const app = new Function('E', 'view', 'rpc', 'poll', 'ui', '_', 'document', 'window', source)(
	E,
	{ extend: value => value },
	{ declare: () => () => Promise.resolve({ available: false, status: 'inactive' }) },
	{ add() {} },
	{ showModal: (title, content) => { modal = { title, children: content }; }, addNotification() {} },
	value => value,
	{ getElementById: () => null },
	{}
);

const devices = [
	{ mac: '02:11:22:33:44:55', name: 'Phone', registered: true, online: false, blocked: false, schedule_enabled: false, ips: ['10.0.0.11'] },
	{ mac: '02:aa:bb:cc:dd:ee', name: 'Laptop', registered: false, online: false, ips: ['10.0.0.12'] }
];
app.render([{ devices, groups: [], counts: { all: 2, registered: 1, unregistered: 1, online: 0, offline: 2, blocked: 0 } }, { nlbwmon: false, speed_reason: 'Unavailable' }]);

function rowBoxes() { return find(app.root, n => n.tag === 'input' && n.attrs.type === 'checkbox'); }
assert.equal(rowBoxes().length, 2);
assert.ok(rowBoxes().every(n => !Object.hasOwn(n.attrs, 'checked')), 'all rows start unselected');
app.selectAllVisible();
assert.ok(rowBoxes().every(n => Object.hasOwn(n.attrs, 'checked')), 'select all selects visible rows');
app.clearSelection();
assert.ok(rowBoxes().every(n => !Object.hasOwn(n.attrs, 'checked')), 'clear selection clears all rows');

app.showDevice(devices[0]);
let controls = find(modal, n => n.tag === 'input' && ['dm-blocked', 'dm-schedule-enabled'].includes(n.attrs.id));
assert.equal(controls.length, 2);
assert.ok(controls.every(n => !Object.hasOwn(n.attrs, 'checked')), 'access and schedule start disabled');

app.showDevice({ ...devices[0], blocked: true, schedule_enabled: true, schedule: '1,2@08:00-22:00' });
controls = find(modal, n => n.tag === 'input' && ['dm-blocked', 'dm-schedule-enabled'].includes(n.attrs.id));
assert.ok(controls.every(n => Object.hasOwn(n.attrs, 'checked')), 'saved access and schedule state is shown');
const days = find(modal, n => n.tag === 'input' && n.attrs.type === 'checkbox' && /^[1-7]$/.test(n.attrs.value || ''));
assert.equal(days.length, 7);
assert.equal(days.filter(n => Object.hasOwn(n.attrs, 'checked')).length, 2, 'only scheduled days are checked');

console.log('OK: default checkboxes, select all, clear selection, access and schedule state');
