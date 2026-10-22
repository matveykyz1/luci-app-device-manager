export function connect() {
	return { call: (object, method, args) => TEST.ubus[object + '.' + method] || {} };
};
