export function readfile(path) { return TEST.files[path]; };
export function writefile(path, data) { TEST.files[path] = data; return true; };
export function rename(a, b) { TEST.files[b] = TEST.files[a]; delete TEST.files[a]; return true; };
export function unlink(path) { delete TEST.files[path]; return true; };
export function access(path) { return !!TEST.access[path] || TEST.files[path] != null; };
export function readlink(path) { return TEST.links[path]; };
export function popen(cmd) {
	let output = TEST.commands[cmd] || '';
	return { read: n => output, close: () => 0 };
};
