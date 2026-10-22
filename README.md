# luci-app-device-manager

A registered-device manager for LuCI, available under **Network → Devices**. It discovers devices from the router's network sources, keeps a persistent registry, and can apply per-device internet access rules and schedules.

The LuCI interface is currently in Russian. The code uses LuCI's translation API so additional translations can be added later.

## Tested target and platform notes

The available SRX5308 build tree identifies its target as OpenWrt **25.12-SNAPSHOT**, Linux **6.12.112**, architecture **mips64_octeonplus**, with LuCI commit `75a306d` (`luci-base-26.288.56989~75a306d`) and the **apk** package manager. The board has one Cavium CN5010 CPU. An earlier hardware log reports 417704 kB of RAM, 64 MiB of flash, and about 16.5 MiB of writable overlay. These values come from the available source tree and logs; they are not a fresh inspection of a running router.

The board's base profile defines `br-lan` over `lan1`–`lan4`, `wan1` as WAN, and `wan2`–`wan4` in the `wan` firewall zone. IPv6 is disabled in that SRX5308 profile. Earlier logs show both `10.0.0.0/24` and `192.168.1.0/24` as LAN subnets at different points. The live router's current DHCP, DNS, VLAN, firewall, nftables, zones, and free storage have not been confirmed. At runtime, the application queries netifd, ubus, and UCI for network and zone information; it does not assume that IoT or Guest networks are named `lan`.

## Features

- Discovers clients from dnsmasq DHCPv4 leases and static entries, odhcpd DHCPv6 when its ubus method is available, IPv4/IPv6 neighbor tables, Linux bridge FDB, and hostapd.
- Keeps DHCP hostname, DNS hostname, and the user's display name as separate fields. Devices can be registered by MAC or added manually; unregistered devices are listed separately. Registering a device does not reserve an IP address.
- Shows separate registered and unregistered device lists. Selecting an unregistered client opens a simple registration dialog; selecting a registered client opens its settings card. Search, sorting, filters, select-all-visible, clear-selection, bulk actions, and automatic refresh every 15 seconds are available. On narrow screens, entries become cards.
- Blocks routed traffic to interfaces in the configured internet firewall zone using an application-owned nftables chain in `inet fw4`. The rule covers IPv4 and IPv6 where enabled and does not target access to the router itself.
- Reports a device as blocked only when its MAC is found in the active application nftables chain. If the active rule state cannot be checked, the interface reports an unknown status.
- Supports internet access schedules using the system timezone. A monitor checks the schedule every 30 seconds. The firewall includes the saved rules after a restart, and the monitor recalculates schedule state after startup.
- Supports device groups, bulk registration, blocking/unblocking, group assignment, and schedule assignment.
- Imports and exports JSON, validating the schema, MAC addresses, schedules, groups, and duplicate records.
- Displays `nlbwmon` receive/transmit counters for the current period when `nlbwmon` is installed. `nlbwmon` is optional.

## Detection and limitations

- A DHCP lease, static DHCP entry, or old FDB/ARP entry does **not** by itself mean a device is online. Online status requires a current `REACHABLE`, `DELAY`, or `PROBE` neighbor entry, or an authenticated hostapd association. A passive client without such evidence may appear offline. For DHCP clients, the logical network may be inferred from a unique matching netifd IP subnet; that does not establish a physical ingress interface and is not used to authorize blocking.
- MAC addresses can be spoofed. Devices using private or randomized MAC addresses are not automatically merged. Blocking is refused if the incoming interface cannot be identified or hardware flow offloading is enabled.
- The default internet firewall zone is `wan`. It can be changed with `uci set device-manager.main.internet_zone='zone_name'`. The rule does not cover access through other zones, such as a separate VPN or a second internet zone. Configure the zone that actually contains the intended external interfaces.
- Per-device rate limiting is disabled. The target's `tc`/SQM integration, flow offloading, and hardware acceleration have not been validated on a live device. The application can retain imported desired-rate values but does not claim to apply them. Current rates and daily/monthly traffic totals are not shown without a reliable data source.
- Schedule transitions can take up to 30 seconds. After a firewall restart, the last saved rule remains active until the monitor recalculates the schedule, within 30 seconds. This delay may be unsuitable for strict parental-control requirements.
- Manufacturer is shown as unknown until a verified OUI database is available. Renaming a device does not change DHCP or DNS configuration. Static IP addresses are not created automatically.
- Actual IPv4/IPv6 packet blocking, router reboot behavior, and mobile-browser layout still need device testing. The package has **not** been installed on the live router.

## Data storage and security

Persistent device records are stored in `/etc/config/device-manager` (schema 1). Up to 20 configuration-change events are retained per device. The last-seen time is written to flash no more than once per device per day. Frequent sightings and online/offline transitions are kept in `/tmp/device-manager-sightings.json`. The application owns `/etc/nftables.d/90-device-manager.nft`.

The application reads other UCI packages, including `network`, `dhcp`, and `firewall`, but does not modify them. Its rpcd ACL grants access to its own `device.manager` ubus object.

When rules change, the application generates its rule file, runs `fw4 check`, then reloads firewall4. If validation or reload fails, it restores the previous file and reloads firewall again. Rules are generated only for registered devices with an explicit block or an active schedule. Global firewall policies are not changed.

Schedule format:

```text
1,2,3,4,5@08:00-22:00;6,7@00:00-24:00
```

Days 1–7 mean Monday–Sunday. Listed intervals allow internet access; access is blocked at other times. An interval cannot cross midnight; use two intervals for an overnight schedule. Unsupported schema versions are rejected. No schema migration is currently needed because this is the first format version.

## Build

In an OpenWrt buildroot with the LuCI feed enabled:

```sh
ln -s /path/to/luci-app-device-manager feeds/luci/applications/luci-app-device-manager
./scripts/feeds install -p luci luci-app-device-manager
make 'CONFIG_PACKAGE_luci-app-device-manager=m' package/feeds/luci/luci-app-device-manager/compile -j2
```

For the SRX5308 target above, the resulting package is:

```text
bin/packages/mips64_octeonplus/luci/luci-app-device-manager-1.0.0-r7.apk
```

For other architectures, build with the matching SDK or buildroot. The router-side package does not require Python or Lua. OpenWrt 24.10 with `opkg` requires a separate build against its LuCI/firewall4 components and has not been tested.

This repository includes a built APK at `dist/luci-app-device-manager-1.0.0-r7.apk` for `mips64_octeonplus`:

```text
SHA-256: 3d191dd15cca6420cdaee5df57087093c382e04e8bdb26cbd869d3f2b531ef18
```

## Install and remove

The package is unsigned. For OpenWrt 25.12 with `apk`, copy the matching build to the router, then install it:

```sh
apk add --allow-untrusted /tmp/luci-app-device-manager-1.0.0-r7.apk
```

Before removal, export the device registry from LuCI if you want to keep it. Remove the package with:

```sh
apk del luci-app-device-manager
```

The removal scripts stop and disable the monitor, remove the application's nftables file, and reload firewall4. They do not remove DHCP, VLAN, WAN, VPN, or third-party firewall configuration. Depending on the package manager's conffile behavior, `/etc/config/device-manager` may remain after package removal; export the registry before removing that file manually.

## Tests and verification status

Run the host-side backend tests with ucode installed:

```sh
UCODE=/path/to/ucode tests/test_backend.sh
node tests/test_ui.js
```

Tests use mocked UCI, ubus, network sources, and LuCI DOM behavior; they do not connect to a router. Covered cases include DHCP and non-DHCP discovery, an IoT network, avoiding false online status from leases/FDB, registration, preserving names after a device disappears, IP changes, nftables rule generation/removal, schedule parsing, groups, import/export, duplicate rejection, router-MAC protection, and disabled rate limiting. The UI test checks default checkbox states, selecting and clearing visible devices, and saved access/schedule states. JavaScript syntax was checked with `node --check`. The APK was built with the local OpenWrt buildroot and inspected with `apk adbdump`.

The following still require testing on the target router: actual IPv4/IPv6 packet handling, schedule transitions and firewall restart, reboot behavior, Wi-Fi and DHCPv6 status on the installed firmware, APK install/removal and import, mobile-browser layout, and interaction with the router's active firewall/VPN setup. IPv6 testing on the described SRX5308 profile requires an environment where IPv6 is enabled.

| Area | Verification |
|---|---|
| DHCP, non-DHCP, multiple networks | Local RPC tests with mocked DHCP, neighbor, and bridge data, including IoT and unambiguous subnet inference |
| Registration, rename, offline retention, IP change, UCI | Local tests and APK build |
| IPv4/IPv6 block and unblock | Family-neutral `inet fw4` rule generation checked locally; packet handling on a router is unverified |
| Schedules, firewall restart, router reboot | Schedule parsing and saved rules checked locally; timer transitions and reboot are unverified on device |
| Mobile layout | Compact device cards implemented for narrow screens; browser check not performed |
| Optional dependencies | Rate limiting and traffic statistics are reported as unavailable when no reliable backend exists; live target not checked |
| Protection of router administration | Rule applies to `forward`; router MAC is rejected; hardware behavior is unverified |
| Removal and third-party settings | Package script removes only its own nftables file; removal was not run on a device |

## License

The source code and package metadata declare the [MIT License](LICENSE).
