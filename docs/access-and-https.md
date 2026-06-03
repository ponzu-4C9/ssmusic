# 公開とLANアクセスの構築メモ（music.shirai-dev.com）

ssmusic を `https://music.shirai-dev.com` で公開し、**自宅LAN内の全端末（スマホ・PC）からもドメインでアクセスできる**ようにするまでの経緯と最終構成の記録。

環境: SoftBank 光（IPv6 IPoE）/ ルーター = **SoftBank 光BBユニット E-WMTA2.3** / 固定グローバルIPv4 `60.133.254.60` / 自宅Ubuntuサーバー。

---

## 最終構成（これが動いている状態）

- **公開**: Caddy がリバースプロキシで 80/443 を TLS 終端（Let's Encrypt 自動取得・更新）。アプリ(Next.js)は `127.0.0.1:3000`、Caddy が `app:3000` へ中継。
- **ドメイン (ValueDomain) のレコード**:
  ```
  a    music 60.133.254.60                        # 公開IPv4（外部アクセス用・ルーターで80/443転送）
  aaaa music 2400:2412:c1:1400:7285:c2ff:fefb:db18 # サーバーのグローバルIPv6（自宅LANアクセスの要）
  ```

### アクセス経路まとめ

| どこから | 経路 | 結果 |
|---|---|---|
| 外（モバイル通信・外出先） | ドメイン → **A(IPv4)** → ルーター80/443転送 → Caddy | ◯ |
| 自宅LAN（スマホ/PC/有線） | ドメイン → **AAAA(サーバーIPv6)** → LAN内IPv6直通 → Caddy | ◯ |

ポイント: 端末はIPv6を優先するので、自宅では自然と AAAA 経由（LAN内直通）になり、外では IPv4 にフォールバックする。

---

## 経緯（つまずき → 解決）

### 1. HTTPS公開（Caddy + Let's Encrypt）
- `docker-compose.caddy.yml`（オーバーレイ）で Caddy を追加。`.env` に `DOMAIN` / `TRUST_PROXY=1`。
- DNS: `a music <固定IP>`。ルーターで 80/443 をサーバーへポート転送。
- **つまずき**: 最初 443 の転送が抜けていて、Caddy ログで `tls-alpn-01: Connection refused`／`http-01(80)` は成功 → 証明書は取得できたが 443 が外から届かない状態。→ **ルーターに 443 転送を追加**して解決。
- 確認: `docker compose ... logs -f caddy` に `certificate obtained successfully`。

### 2. 自宅LANから見えない（ヘアピンNAT）
- 外からは開けるのに、**自宅Wi-Fi/有線の端末からドメインで開くと `ERR_CONNECTION_REFUSED`**。
- 原因: ドメインは公開IP(60.133.254.60)に解決される → LAN内端末がそこへ繋ぐと、ルーターが「自分の公開IP宛て」を内部へ折り返す必要がある（**ヘアピンNAT / NATループバック**）。**E-WMTA2.3 は非対応**。
- 注意: LAN内からの“外部テスト”は不可（同一LANだとヘアピンになる）。本当の外部テストは**スマホのモバイル通信**で行う。

### 3. split DNS（dnsmasq）を試す → 部分的に成功
- `docker-compose.dns.yml` で dnsmasq を立て、LAN内だけ `music.shirai-dev.com → サーバーLAN IP(192.168.3.50)` に上書き（SNIはドメインのままなので証明書も有効）。
- **つまずき①**: Docker のブリッジ＋ポート公開だと、dnsmasq 既定の `local-service` が「LAN(別サブネット)からの問い合わせ」を無視してタイムアウト → `network_mode: host` ＋ `--bind-interfaces --listen-address=<LAN_IP>` で解決（local-service無効化＋systemd-resolvedの127.0.0.53と非競合）。
- **つまずき②（本質）**: PCのDNSを 192.168.3.50 にしても効かない。`ipconfig /all` を見ると **ルーターが配るIPv6 DNS（`2400:...:1111:1111:1111:1111`）が最優先**で、そこが公開IPを返していた。Windowsは手動のIPv4 DNSを入れても、自動取得のIPv6 DNSを優先する。
- **PCの対処**: hosts ファイル（`192.168.3.50 music.shirai-dev.com`）で全DNSを上書き。
  - 罠: 管理者でないとメモ帳の保存が本物の hosts に届かない。→ **管理者PowerShell** で確実に:
    `Add-Content -Path "$env:windir\System32\drivers\etc\hosts" -Value "192.168.3.50 music.shirai-dev.com"`
  - 確認は **`ping`**（`nslookup` は hosts を無視してDNSに直接聞くので不可）。
- **スマホ(Android)の壁**: hosts が無い／静的DNSもIPv6 RDNSSに負ける／プライベートDNSはDoT(ホスト名)専用かつ全ネット共通で使えない → Android単体ではIPv6 DNSを無視させられず詰み。

### 4. 最終解：AAAA（IPv6）レコードで“IPv6を味方に”
- 根本原因は「端末がIPv6 DNSを優先 → ドメインが**IPv4の公開IP**に解決 → IPv4ヘアピンで失敗」。
- そこで **ドメインに AAAA（→ サーバーのグローバルIPv6）を追加**。すると:
  - 端末はIPv6優先 → ドメインが**サーバーのIPv6**に解決
  - スマホ・サーバーは同じ `/64` 上 → **LAN内でIPv6直通**（NAT・ヘアピン・DNS小細工すべて不要）
  - SNI一致で証明書も有効（🔒）
  - **全端末・設定ゼロ**で自宅から開ける（ルーターのIPv6 DNSをそのまま利用＝今まで敵だったものが味方に）
- サーバーのIPv6は `ip -6 addr show scope global` で確認。`7285:c2ff:fefb:db18` はMAC由来(EUI-64)の**安定アドレス**。
- 事前検証（DNS変更前）: LAN内のPCから
  `curl --resolve music.shirai-dev.com:443:[<IPv6>] https://music.shirai-dev.com -I`
  → `HTTP/2 307 / location: /login / via: Caddy`（証明書エラーなし）で到達確認 → AAAA を追加。

---

## コマンド / 確認 チートシート

```bash
# Caddy 起動・ログ（本番、両方の -f が必要。.env に COMPOSE_FILE を入れれば省略可）
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.caddy.yml logs -f caddy

# サーバーの LAN IP / グローバルIPv6
ip route get 1.1.1.1 | grep -oP 'src \K\S+'
ip -6 addr show scope global

# DNS伝播チェック（curl だけ）
curl -s "https://dns.google/resolve?name=music.shirai-dev.com&type=A"
curl -s "https://dns.google/resolve?name=music.shirai-dev.com&type=AAAA"

# LAN内からIPv6で到達テスト（SNI付き）
curl --resolve music.shirai-dev.com:443:[2400:2412:c1:1400:7285:c2ff:fefb:db18] https://music.shirai-dev.com -I
```

---

## メンテナンス・注意

- **サーバーのIPv6が変わったら AAAA を更新**: EUI-64で基本安定だが、SoftBankのIPv6プレフィックス(`2400:2412:c1:1400::/64`)が変わると要更新（稀）。`ip -6 addr show scope global` で確認 → ValueDomain の AAAA を直す。将来は簡易IPv6 DDNSを仕込む手もある。
- **外部アクセスは IPv4(A) 頼み**: ルーターの 80/443 転送が前提。**443転送を消さない**こと。
- **証明書更新**: Caddy が自動（http-01 = 80/IPv4 で更新）。80転送は維持する。
- **不要になったもの**: split DNS の dnsmasq は停止可（`docker compose -f docker-compose.dns.yml down`）。PC の hosts 行も削除可（消すとPCもIPv6経路になる。残してもIPv4で繋がる）。

---

## 学び（ハマりポイント要約）
1. 自宅から自分のドメインが見えない＝ほぼ **ヘアピンNAT**。本当のテストは外部回線（モバイル通信）で。
2. **SoftBank 光BBユニット(E-WMTA2.3)は NATループバック非対応**。
3. dnsmasq を Docker で LAN DNS にするなら **host network + `--bind-interfaces --listen-address`**（既定 local-service 対策）。
4. 近年は **IPv6 DNS が優先される**ので、IPv4だけのDNS設定/上書きが効かないことがある（新しめの罠）。Androidは hosts も無く特に詰みやすい。
5. **IPv6 は NAT されない＝LAN内直通**。AAAA を足すのが、SoftBank系IPv6回線では最もきれいな“自宅からドメインで開く”解。
