include $(TOPDIR)/rules.mk

PKG_LICENSE:=MIT
PKG_VERSION:=1.0.0
PKG_RELEASE:=8
LUCI_TITLE:=Registered device manager
LUCI_URL:=https://github.com/matveykyz1/luci-app-device-manager
LUCI_MAINTAINER:=matveykyz1
LUCI_DEPENDS:=+luci-base +rpcd-mod-ucode +firewall4 +ucode-mod-fs +ucode-mod-uci +ucode-mod-ubus
LUCI_PKGARCH:=all

define Package/luci-app-device-manager/conffiles
/etc/config/device-manager
/etc/nftables.d/90-device-manager.nft
endef

define Package/luci-app-device-manager/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
/etc/init.d/rpcd reload 2>/dev/null
/etc/init.d/device-manager enable 2>/dev/null
/etc/init.d/device-manager start 2>/dev/null
exit 0
endef

define Package/luci-app-device-manager/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
/etc/init.d/device-manager stop 2>/dev/null
/etc/init.d/device-manager disable 2>/dev/null
exit 0
endef

define Package/luci-app-device-manager/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
rm -f /etc/nftables.d/90-device-manager.nft /tmp/device-manager-state.json /tmp/device-manager-sightings.json
/etc/init.d/firewall reload 2>/dev/null
/etc/init.d/rpcd reload 2>/dev/null
exit 0
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
