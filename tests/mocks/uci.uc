export function cursor() {
	return {
		get: (pkg, section, option) => {
			let s = TEST.config[pkg]?.[section];
			return option == null ? s?.['.type'] : s?.[option];
		},
		get_all: (pkg, section) => TEST.config[pkg]?.[section],
		unload: pkg => true,
		set: (pkg, section, option, value) => {
			TEST.config[pkg] ||= {};
			TEST.config[pkg][section] ||= { '.name': section };
			if (value == null) TEST.config[pkg][section]['.type'] = option;
			else TEST.config[pkg][section][option] = value;
			return true;
		},
		'delete': (pkg, section, option) => {
			if (option == null) delete TEST.config[pkg][section];
			else delete TEST.config[pkg][section][option];
			return true;
		},
		foreach: (pkg, kind, cb) => {
			for (let key, s in (TEST.config[pkg] || {})) if (s['.type'] == kind) cb(s);
		},
		commit: pkg => true,
		revert: pkg => true
	};
};
