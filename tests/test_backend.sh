#!/bin/sh
set -eu
here="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ucode="${UCODE:-ucode}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
python3 - "$here/fixtures.json" "$tmp/fixtures.json" "$here/../root/usr/share/rpcd/ucode/device.manager" "$tmp/backend.uc" <<'PY'
import json, sys
with open(sys.argv[1]) as f: data = json.load(f)
data['TEST']['backend'] = sys.argv[4]
with open(sys.argv[2], 'w') as f: json.dump(data, f)
with open(sys.argv[3]) as f: source = f.read()
assert source.endswith("return { 'device.manager': methods };\n")
with open(sys.argv[4], 'w') as f: f.write(source.replace("return { 'device.manager': methods };\n", "TEST.api = { 'device.manager': methods };\n"))
PY
mkdir -p "$tmp/bin"
printf '#!/bin/sh\nexit 0\n' > "$tmp/bin/fw4"
chmod +x "$tmp/bin/fw4"
PATH="$tmp/bin:$PATH" "$ucode" -L "$here/mocks" -F "$tmp/fixtures.json" "$here/run.uc"
