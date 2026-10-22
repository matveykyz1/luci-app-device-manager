# LuCI Device Manager

A registered-device manager for OpenWrt LuCI, available under **Network → Devices**. It discovers clients from the router's available network sources, keeps a persistent registry, and can apply per-device internet access rules and schedules.

The interface is in Russian. For installation, build instructions, supported features, security details, and known limitations, see the [Russian README](README.ru.md).

## Compatibility

The package targets OpenWrt 25.12 with `apk`, `firewall4`, `rpcd`, and modern JavaScript LuCI. The included APK was built for `mips64_octeonplus`; other targets must build the package for their own architecture and OpenWrt release.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
