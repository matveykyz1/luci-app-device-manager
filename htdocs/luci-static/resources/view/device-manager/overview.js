'use strict';
'require view';
'require rpc';
'require poll';
'require ui';

var callList = rpc.declare({ object: 'device.manager', method: 'list' });
var callSave = rpc.declare({ object: 'device.manager', method: 'save', params: [ 'payload' ] });
var callRemove = rpc.declare({ object: 'device.manager', method: 'remove', params: [ 'mac' ] });
var callGroup = rpc.declare({ object: 'device.manager', method: 'group', params: [ 'payload' ] });
var callBulk = rpc.declare({ object: 'device.manager', method: 'bulk', params: [ 'payload' ] });
var callCaps = rpc.declare({ object: 'device.manager', method: 'capabilities' });
var callExport = rpc.declare({ object: 'device.manager', method: 'export' });
var callImport = rpc.declare({ object: 'device.manager', method: 'import', params: [ 'payload' ] });
var callStatistics = rpc.declare({ object: 'device.manager', method: 'statistics', params: [ 'mac' ] });
var callRuleStatus = rpc.declare({ object: 'device.manager', method: 'rule_status', params: [ 'mac' ] });

function el(tag, attrs, children) { return E(tag, attrs || {}, children || []); }
function value(id) { return document.getElementById(id).value; }
function checked(id) { return document.getElementById(id).checked; }
function field(id, title, val, type) {
	return el('label', { 'class': 'dm-field' }, [el('span', {}, title), el('input', { id: id, type: type || 'text', value: val || '', 'class': 'cbi-input-text' })]);
}
function select(id, title, values, current) {
	return el('label', { 'class': 'dm-field' }, [el('span', {}, title), el('select', { id: id, 'class': 'cbi-input-select' }, values.map(function(v) { return el('option', { value: v[0], selected: v[0] === current }, v[1]); }))]);
}
function box(id, title, enabled) {
	return el('label', { 'class': 'dm-check' }, [el('input', { id: id, type: 'checkbox', checked: !!enabled }), ' ', title]);
}
function scheduleRow(days, start, end) {
	var names = [ _('Пн'), _('Вт'), _('Ср'), _('Чт'), _('Пт'), _('Сб'), _('Вс') ];
	var row = el('div', { 'class': 'dm-interval' });
	row.appendChild(el('div', { 'class': 'dm-days' }, names.map(function(name, i) {
		return el('label', {}, [el('input', { type: 'checkbox', value: String(i + 1), checked: days.indexOf(String(i + 1)) >= 0 }), ' ', name]);
	})));
	row.appendChild(el('input', { type: 'text', 'class': 'dm-start', value: start || '08:00', placeholder: '08:00', 'aria-label': _('Начало') }));
	row.appendChild(el('span', {}, '–'));
	row.appendChild(el('input', { type: 'text', 'class': 'dm-end', value: end || '22:00', placeholder: '22:00', 'aria-label': _('Конец') }));
	row.appendChild(el('button', { 'class': 'btn', click: function() { row.remove(); } }, _('Удалить интервал')));
	return row;
}
function scheduleEditor(raw) {
	var rows = el('div', { id: 'dm-schedule-rows' });
	(raw || '').split(';').forEach(function(part) {
		var m = part.match(/^([1-7](?:,[1-7])*)@(\d\d:\d\d)-(\d\d:\d\d)$/);
		if (m) rows.appendChild(scheduleRow(m[1].split(','), m[2], m[3]));
	});
	return el('div', {}, [rows, el('button', { 'class': 'btn', click: function() { rows.appendChild(scheduleRow([], '08:00', '22:00')); } }, _('Добавить интервал')),
		el('p', { 'class': 'description' }, _('Отмеченные дни и интервалы разрешают интернет. В остальное время доступ закрыт. Для полного дня укажите 00:00–24:00.'))]);
}
function scheduleValue() {
	var result = [];
	document.querySelectorAll('#dm-schedule-rows .dm-interval').forEach(function(row) {
		var days = Array.from(row.querySelectorAll('.dm-days input:checked')).map(function(x) { return x.value; });
		if (!days.length) throw new Error(_('Выберите хотя бы один день для каждого интервала'));
		result.push(days.join(',') + '@' + row.querySelector('.dm-start').value + '-' + row.querySelector('.dm-end').value);
	});
	return result.join(';');
}
function fmt(ts) { return ts ? new Date(ts * 1000).toLocaleString() : _('Неизвестно'); }
function cell(x) { return el('td', { 'class': 'td' }, x == null || x === '' ? _('Неизвестно') : x); }
function notice(msg, bad) { ui.addNotification(null, el('p', {}, msg), bad ? 'danger' : 'info'); }

return view.extend({
	load: function() { return Promise.all([callList(), callCaps()]); },
	state: null,
	caps: null,
	query: '',
	filter: 'all',
	sort: 'name',
	selected: {},
	call: function(fn, args) {
		return fn.apply(null, args || []).then(function(r) {
			if (r && r.error) throw new Error(r.error);
			return r;
		}).catch(function(e) { notice(e.message || String(e), true); throw e; });
	},
	refresh: function() {
		var self = this;
		return callList().then(function(data) { self.state = data; if (!document.activeElement.classList.contains('dm-inline')) self.draw(); }).catch(function(e) { notice(_('Не удалось обновить список: ') + e, true); });
	},
	showDevice: function(d) {
		var self = this, groups = [['', _('Без группы')]].concat((this.state.groups || []).map(function(g) { return [g['.name'], g.name || g['.name']]; }));
		var content = [
			el('div', { 'class': 'dm-form' }, [
				el('h4', {}, _('Основное')),
				field('dm-name', _('Название'), d.name),
				field('dm-description', _('Описание'), d.description),
				field('dm-kind', _('Тип устройства'), d.type),
				select('dm-group', _('Группа'), groups, d.group || ''),
				el('p', {}, _('MAC: ') + d.mac + ' · ' + _('IP: ') + ((d.ips || []).join(', ') || _('Неизвестно'))),
				el('p', {}, _('Производитель: Неизвестно') + ' · ' + _('Регистрация: ') + (d.registered ? _('Да') : _('Нет'))),
				el('p', {}, _('DHCP hostname: ') + (d.hostname || _('Неизвестно')) + ' · ' + _('DNS hostname: ') + (d.dns_hostname || _('Неизвестно'))),
				el('h4', {}, _('Подключение')),
				el('p', {}, _('Интерфейс: ') + (d.interface || _('Неизвестно')) + ' · ' + _('Сеть: ') + (d.network || _('Неизвестно')) + ' · ' + _('Зона: ') + (d.zone || _('Неизвестно'))),
				field('dm-interface', _('Интерфейс для правил доступа'), d.interface || ''),
				el('p', {}, _('Способ: ') + (d.medium === 'wifi' ? _('Wi‑Fi') : d.medium === 'ethernet' ? _('Ethernet') : _('Неизвестно')) + ' · ' + _('Источники: ') + ((d.sources || []).join(', ') || _('Неизвестно'))),
				el('h4', {}, _('Доступ в интернет')),
				box('dm-blocked', _('Заблокировать интернет'), d.blocked),
				box('dm-schedule-enabled', _('Включить расписание'), d.schedule_enabled),
				el('p', { id: 'dm-rule-status' }, _('Статус правила: проверка…')),
				scheduleEditor(d.schedule || ''),
				el('h4', {}, _('Скорость')),
				el('p', {}, this.caps.speed_reason),
				el('p', {}, _('Текущая скорость: Неизвестно')),
				el('h4', {}, _('Трафик')),
				el('p', { id: 'dm-traffic' }, _('Загрузка данных…')),
				el('h4', {}, _('История')),
				el('p', {}, _('Первое обнаружение: ') + fmt(d.first_seen) + ' · ' + _('Последнее обнаружение: ') + fmt(d.last_seen) + ' · ' + _('Зарегистрировано: ') + fmt(d.registered_at)),
				el('p', {}, _('Последние изменения: ') + ((d.history || []).map(function(x) { return fmt(x.when) + ' — ' + (x.action === 'registered' ? _('регистрация') : _('изменение настроек')); }).join('; ') || _('Нет данных'))),
				el('p', {}, _('Изменения подключения в текущем сеансе: ') + ((d.status_history || []).map(function(x) { return fmt(x.when) + ' — ' + (x.online ? _('онлайн') : _('офлайн')); }).join('; ') || _('Нет данных')))
			])
		];
		ui.showModal(d.name || d.mac, content.concat([el('div', { 'class': 'right' }, [
			el('button', { 'class': 'btn', click: ui.hideModal }, _('Отмена')),
			' ',
			d.registered ? el('button', { 'class': 'btn', click: function() {
				if (!window.confirm(_('Удалить устройство из реестра? Настройки DHCP и firewall других приложений сохранятся.'))) return;
				self.call(callRemove, [d.mac]).then(function() { ui.hideModal(); self.refresh(); });
			} }, _('Удалить из реестра')) : '',
			' ',
			el('button', { 'class': 'btn cbi-button-positive', click: function() {
				var schedule;
				try { schedule = scheduleValue(); } catch (e) { notice(e.message, true); return; }
				var payload = {
					mac: d.mac, name: value('dm-name'), description: value('dm-description'), type: value('dm-kind'), group: value('dm-group'),
					interface: value('dm-interface'), blocked: checked('dm-blocked'), schedule_enabled: checked('dm-schedule-enabled'), schedule: schedule
				};
				self.call(callSave, [JSON.stringify(payload)]).then(function() { ui.hideModal(); self.refresh(); });
			} }, d.registered ? _('Сохранить') : _('Зарегистрировать'))
		])]));
		callStatistics(d.mac).then(function(r) {
			var target = document.getElementById('dm-traffic');
			if (!target) return;
			target.textContent = r.available ? _('Получено: ') + r.rx_bytes + _(' байт; отправлено: ') + r.tx_bytes + _(' байт (') + r.period + ')' : (r.reason || _('Статистика недоступна'));
		}).catch(function() { var target = document.getElementById('dm-traffic'); if (target) target.textContent = _('Статистика недоступна'); });
		callRuleStatus(d.mac).then(function(r) {
			var target = document.getElementById('dm-rule-status');
			if (target) target.textContent = _('Статус правила: ') + (r.status === 'active' ? _('применено') : r.status === 'inactive' ? _('нет активного правила') : _('неизвестно'));
		});
	},
	addManual: function() {
		var self = this;
		ui.showModal(_('Добавить устройство'), [el('div', { 'class': 'dm-form' }, [
			field('dm-mac', _('MAC-адрес'), ''), field('dm-name', _('Название'), ''),
			field('dm-interface', _('Исходящий интерфейс, например br-lan'), ''),
			el('p', {}, _('Регистрация не закрепляет IP. Интерфейс нужен только для правил доступа.'))
		]), el('div', { 'class': 'right' }, [
			el('button', { 'class': 'btn', click: ui.hideModal }, _('Отмена')), ' ',
			el('button', { 'class': 'btn cbi-button-positive', click: function() {
				self.call(callSave, [JSON.stringify({ mac: value('dm-mac'), name: value('dm-name'), interface: value('dm-interface') })]).then(function() { ui.hideModal(); self.refresh(); });
			} }, _('Зарегистрировать'))
		])]);
	},
	groupModal: function() {
		var self = this;
		ui.showModal(_('Создать группу'), [field('dm-gid', _('Код латиницей'), ''), field('dm-gname', _('Название'), ''),
			el('div', { 'class': 'right' }, [el('button', { 'class': 'btn', click: ui.hideModal }, _('Отмена')), ' ', el('button', { 'class': 'btn cbi-button-positive', click: function() {
				self.call(callGroup, [JSON.stringify({ id: value('dm-gid'), name: value('dm-gname') })]).then(function() { ui.hideModal(); self.refresh(); });
			} }, _('Создать'))])]);
	},
	bulkModal: function() {
		var self = this, macs = Object.keys(this.selected).filter(function(m) { return self.selected[m]; });
		if (!macs.length) return notice(_('Выберите устройства'), true);
		var groups = [['', _('Без группы')]].concat((this.state.groups || []).map(function(g) { return [g['.name'], g.name || g['.name']]; }));
		ui.showModal(_('Массовое действие'), [select('dm-bulk-action', _('Действие'), [
			['register', _('Зарегистрировать')], ['block', _('Заблокировать интернет')], ['unblock', _('Разрешить интернет')], ['group', _('Назначить группу')], ['schedule', _('Применить расписание')]
		], 'register'), select('dm-bulk-group', _('Группа'), groups, ''), scheduleEditor(''),
			el('p', {}, _('Выбрано: ') + macs.length),
			el('div', { 'class': 'right' }, [el('button', { 'class': 'btn', click: ui.hideModal }, _('Отмена')), ' ', el('button', { 'class': 'btn cbi-button-positive', click: function() {
				var action = value('dm-bulk-action'), change = {};
				if (action === 'block') change.blocked = true;
				if (action === 'unblock') change.blocked = false;
				if (action === 'group') change.group = value('dm-bulk-group');
				if (action === 'schedule') { try { change.schedule = scheduleValue(); } catch (e) { notice(e.message, true); return; } change.schedule_enabled = true; }
				self.call(callBulk, [JSON.stringify({ macs: macs, change: change })]).then(function(r) {
					if (r.errors && r.errors.length) notice(r.errors.join('; '), true);
					self.selected = {}; ui.hideModal(); self.refresh();
				});
			} }, _('Применить'))])]);
	},
	exportData: function() {
		this.call(callExport).then(function(r) {
			var blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
			var url = URL.createObjectURL(blob), a = el('a', { href: url, download: 'device-manager.json' });
			a.click(); setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
		});
	},
	importData: function() {
		var self = this;
		ui.showModal(_('Импорт настроек'), [el('p', {}, _('Существующие записи с тем же MAC будут обновлены. Правила доступа применятся после проверки firewall.')),
			el('input', { id: 'dm-import-file', type: 'file', accept: 'application/json,.json' }),
			el('div', { 'class': 'right' }, [el('button', { 'class': 'btn', click: ui.hideModal }, _('Отмена')), ' ',
				el('button', { 'class': 'btn cbi-button-positive', click: function() {
					var file = document.getElementById('dm-import-file').files[0];
					if (!file || file.size > 131072) return notice(_('Выберите JSON-файл размером до 128 КиБ'), true);
					file.text().then(function(text) { return self.call(callImport, [text]); }).then(function() { ui.hideModal(); self.refresh(); });
				} }, _('Импортировать'))])]);
	},
	draw: function() {
		if (!this.root || !this.state) return;
		var self = this, d = this.state, q = this.query.toLocaleLowerCase();
		var rows = (d.devices || []).filter(function(x) {
			if (self.filter === 'registered' && !x.registered || self.filter === 'unregistered' && x.registered || self.filter === 'online' && !x.online || self.filter === 'blocked' && !x.internet_blocked) return false;
			return !q || [x.name, x.mac, x.hostname, x.network, (x.ips || []).join(' ')].join(' ').toLocaleLowerCase().indexOf(q) >= 0;
		}).sort(function(a, b) { return String(a[self.sort] || '').localeCompare(String(b[self.sort] || ''), 'ru'); });
		var stats = [ ['all', _('Все')], ['registered', _('Зарегистрировано')], ['unregistered', _('Не зарегистрировано')], ['online', _('Онлайн')], ['offline', _('Офлайн')], ['blocked', _('Заблокировано')] ];
		var table = el('table', { 'class': 'table dm-table' }, [el('thead', {}, el('tr', { 'class': 'tr' }, [
			_('Выбор'), _('Название'), _('IP'), _('MAC'), _('Статус'), _('Сеть'), _('Подключение'), _('Регистрация'), _('Интернет'), _('Последняя активность'), _('Действия')
		].map(function(h) { return el('th', { 'class': 'th' }, h); })))]);
		var body = el('tbody');
		rows.forEach(function(x) {
			var checkbox = el('input', { type: 'checkbox', checked: !!self.selected[x.mac], change: function(ev) { self.selected[x.mac] = ev.target.checked; } });
			var nameText = el('span', {}, x.name);
			var rename = el('button', { 'class': 'btn dm-link', title: _('Переименовать'), click: function() {
				var input = el('input', { type: 'text', value: x.name, 'class': 'dm-inline', 'aria-label': _('Название устройства') });
				input.addEventListener('keydown', function(ev) {
					if (ev.key === 'Escape') { input.replaceWith(nameText); return; }
					if (ev.key !== 'Enter') return;
					self.call(callSave, [JSON.stringify({ mac: x.mac, name: input.value, description: x.description || '', type: x.type || '', group: x.group || '', interface: x.interface || '', blocked: x.blocked, schedule_enabled: x.schedule_enabled, schedule: x.schedule || '' })]).then(function() { self.refresh(); });
				});
				nameText.replaceWith(input); input.focus(); input.select();
			} }, '✎');
			body.appendChild(el('tr', { 'class': 'tr' }, [cell(checkbox), cell([nameText, ' ', rename]), cell((x.ips || []).join(', ') || _('Неизвестно')), cell(x.mac),
				cell(x.online ? _('Онлайн') : _('Офлайн')), cell(x.network || x.zone || _('Неизвестно')),
				cell(x.medium === 'wifi' ? _('Wi‑Fi') : x.medium === 'ethernet' ? _('Ethernet') : _('Неизвестно')),
				cell(!x.registered ? _('Не управляется') : x.rule_applied === null ? (x.desired_blocked ? _('Статус блокировки неизвестен') : _('Статус правил неизвестен')) :
					x.internet_blocked ? (x.blocked ? _('Заблокирован') : _('Заблокирован по расписанию')) :
					x.desired_blocked ? _('Ожидается правило') : (x.schedule_enabled ? _('Разрешён по расписанию') : _('Разрешён'))),
				cell(fmt(x.last_seen)), cell([el('button', { 'class': 'btn', click: function() { self.showDevice(x); } }, _('Открыть')), ' ',
					x.registered ? el('button', { 'class': 'btn', click: function() {
						var data = { mac: x.mac, name: x.name, description: x.description || '', type: x.type || '', group: x.group || '', interface: x.interface || '', blocked: !x.blocked, schedule_enabled: x.schedule_enabled, schedule: x.schedule || '' };
						self.call(callSave, [JSON.stringify(data)]).then(function() { self.refresh(); });
					} }, x.blocked ? _('Разрешить') : _('Блокировать')) : ''])]));
		});
		table.appendChild(body);
		this.root.replaceChildren(el('h2', {}, _('Устройства')), el('div', { 'class': 'dm-stats' }, stats.map(function(s) { return el('div', { 'class': 'dm-stat' }, [el('strong', {}, String(d.counts[s[0]] || 0)), el('span', {}, s[1])]); })),
			el('div', { 'class': 'dm-tools' }, [
				el('input', { id: 'dm-search', type: 'search', placeholder: _('Поиск по имени, MAC, IP или сети'), value: this.query, input: function(ev) {
					var pos = ev.target.selectionStart; self.query = ev.target.value; self.draw();
					var next = document.getElementById('dm-search'); next.focus(); next.setSelectionRange(pos, pos);
				} }),
				el('select', { change: function(ev) { self.filter = ev.target.value; self.draw(); } }, [ ['all', _('Все')], ['registered', _('Зарегистрированные')], ['unregistered', _('Незарегистрированные')], ['online', _('Онлайн')], ['blocked', _('Заблокированные')] ].map(function(o) { return el('option', { value: o[0], selected: self.filter === o[0] }, o[1]); })),
				el('select', { change: function(ev) { self.sort = ev.target.value; self.draw(); } }, [ ['name', _('Сортировка: название')], ['mac', _('Сортировка: MAC')], ['network', _('Сортировка: сеть')], ['last_seen', _('Сортировка: активность')] ].map(function(o) { return el('option', { value: o[0], selected: self.sort === o[0] }, o[1]); })),
				el('button', { 'class': 'btn', click: this.addManual.bind(this) }, _('Добавить по MAC')),
				el('button', { 'class': 'btn', click: this.groupModal.bind(this) }, _('Новая группа')),
				el('button', { 'class': 'btn', click: this.bulkModal.bind(this) }, _('Массовое действие')),
				el('button', { 'class': 'btn', click: this.exportData.bind(this) }, _('Экспорт')),
				el('button', { 'class': 'btn', click: this.importData.bind(this) }, _('Импорт'))
			]), el('div', { 'class': 'dm-scroll' }, table),
			el('p', { 'class': 'description' }, _('DHCP-аренда и устаревшая запись ARP не считаются признаком подключения. Блокировка действует на маршрутизируемый трафик через выбранную интернет-зону; MAC-адрес можно подменить.')),
			this.caps.nlbwmon ? el('p', {}, _('Для подробной статистики используйте установленный nlbwmon.')) : el('p', {}, _('Статистика трафика: установите nlbwmon и luci-app-nlbwmon.')));
	},
	render: function(data) {
		this.state = data[0]; this.caps = data[1]; this.root = el('div', { 'class': 'cbi-map dm-root' });
		var css = el('style', {}, '.dm-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:12px 0}.dm-stat{border:1px solid #ddd;border-radius:5px;padding:10px;display:flex;flex-direction:column}.dm-stat strong{font-size:1.5em}.dm-tools{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.dm-tools input{min-width:220px;flex:1}.dm-scroll{overflow-x:auto}.dm-table{min-width:1050px}.dm-form{display:grid;gap:8px;max-height:65vh;overflow:auto}.dm-field{display:grid;gap:4px}.dm-check{display:block}.dm-link{padding:1px 5px;margin-left:4px}.dm-interval{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0;padding:8px;border:1px solid #ddd;border-radius:4px}.dm-days{display:flex;flex-wrap:wrap;gap:7px;width:100%}.dm-interval input.dm-start,.dm-interval input.dm-end{width:70px}@media(max-width:650px){.dm-tools>*{width:100%}.dm-stat{padding:7px}}');
		this.draw(); poll.add(this.refresh.bind(this), 15);
		return el('div', {}, [css, this.root]);
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
