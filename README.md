# Config Factory

```bash
# For the setting of `rp_filter`, please refer to lantian's article to choose by yourself
# echo "net.ipv4.conf.default.rp_filter=0" >> /etc/sysctl.conf
# echo "net.ipv4.conf.all.rp_filter=0" >> /etc/sysctl.conf
echo "net.ipv4.conf.default.rp_filter=2" >> /etc/sysctl.conf
echo "net.ipv4.conf.all.rp_filter=2" >> /etc/sysctl.conf

echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
echo "net.ipv6.conf.default.forwarding=1" >> /etc/sysctl.conf
echo "net.ipv6.conf.all.forwarding=1" >> /etc/sysctl.conf
sysctl -p
```

## WireGuard

```bash
# Debian 11
apt install wireguard wireguard-tools openresolv -y

# Debian 10
cat << EOF >> /etc/apt/sources.list
deb http://deb.debian.org/debian buster-backports main
deb-src http://deb.debian.org/debian buster-backports main
EOF
apt update -y
apt -t buster-backports install wireguard wireguard-tools wireguard-dkms linux-headers-$(uname -r) openresolv -y

mkdir /etc/wireguard/
cd /etc/wireguard/
wg genkey | tee private.key | wg pubkey > public.key
```

## Bird2

```bash
# https://packages.debian.org/stable/bird2
apt install bird2 -y

# Newer version e.g. Debian 11 https://packages.debian.org/bullseye-backports/bird2
cat << EOF >> /etc/apt/sources.list
deb http://deb.debian.org/debian bullseye-backports main
deb-src http://deb.debian.org/debian bullseye-backports main
EOF
apt update -y
apt -t bullseye-backports install bird2 -y

mkdir -p /etc/bird/peers
```

## ROA

```bash
# crontab -e
*/15 * * * * curl -sfSLR -o /etc/bird/roa_dn42.conf https://dn42.burble.com/roa/dn42_roa_bird2_4.conf && curl -sfSLR -o /etc/bird/roa_dn42_v6.conf https://dn42.burble.com/roa/dn42_roa_bird2_6.conf && /usr/sbin/birdc c 1> /dev/null
```

## Dummy Interface

```bash
cat << EOF >> /etc/network/interfaces
auto dummy-dn42
iface dummy-dn42 inet static
    address <IPv4 Address>/32
    pre-up ip link del dummy-dn42 || true
    pre-up ip link add dummy-dn42 type dummy || true
    post-up ip addr add <IPv6 Address>/128 dev dummy-dn42
EOF
```

## CLI Options

```bash
Options:
  --help                     Show help                                 [boolean]
  --version                  Show version number                       [boolean]
  --exclude-wireguard        Skip wireguard config generation
                                                      [boolean] [default: false]
  --exclude-bird             Skip bird config generation
                                                      [boolean] [default: false]
  --exclude-internal-config  Skip internal config generation
                                                      [boolean] [default: false]
  --exclude-external-config  Skip external config generation
                                                      [boolean] [default: false]
  --delete                   Delete existing config files
                                                       [boolean] [default: true]
```

## Thanks

https://dn42.dev/howto/Getting-started

https://lantian.pub/article/modify-website/dn42-experimental-network-2020.lantian/

https://miaotony.xyz/2021/03/25/Server_DN42/

https://jlu5.com/blog/dn42-multiple-servers-ibgp-igps

And many other great blog posts
