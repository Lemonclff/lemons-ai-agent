# Cloudflare Tunnel 設定總覽 — lemons-ai-agent
# 最後更新: 2026-05-21

═══════════════════════════════════════════════════════════════
  摘要
═══════════════════════════════════════════════════════════════
  域名:      dashboard.lemonffing.com
  目標:      http://localhost:3000 (Next.js)
  方式:      Cloudflare Named Tunnel (永久, 有帳號)
  狀態:      ✅ 上線中 (HTTPS 自動憑證)
  舊 tunnel:  tourism-adequate-date-beer.trycloudflare.com ❌ 已停用

═══════════════════════════════════════════════════════════════
  檔案與路徑
═══════════════════════════════════════════════════════════════

  cloudflared 執行檔
    ~/.local/bin/cloudflared (v2026.5.0)

  Cloudflare 認證憑證 (登入後下載)
    ~/.cloudflared/cert.pem

  Tunnel 憑證 (建立 tunnel 時產生, 勿外洩)
    ~/.cloudflared/991df800-fd22-4140-9600-08ce8551619d.json

  Tunnel 設定檔 (ingress rules)
    ~/.cloudflared/config.yml
    內容:
      tunnel: lemons-dashboard
      credentials-file: /home/lemon/.cloudflared/991df800-fd22-4140-9600-08ce8551619d.json
      ingress:
        - hostname: dashboard.lemonffing.com
          service: http://localhost:3000
        - service: http_status:404

  開機自動啟動腳本
    ~/.local/bin/start-cloudflared-tunnel.sh
    內容:
      #!/bin/bash
      sleep 10
      /home/lemon/.local/bin/cloudflared tunnel \
        --config /home/lemon/.cloudflared/config.yml run &

  Next.js 自動啟動腳本
    ~/.local/bin/start-nextjs.sh
    內容:
      #!/bin/bash
      cd /home/lemon/lemons-ai-agent/frontend
      export PATH="/home/lemon/.local/bin:$PATH"
      nohup npm run dev > /tmp/nextjs.log 2>&1 &
    日誌: /tmp/nextjs.log

  Cron 設定
    crontab -l 中的條目:
      @reboot /home/lemon/.local/bin/start-nextjs.sh
      @reboot /home/lemon/.local/bin/start-cloudflared-tunnel.sh
    啟動順序: Next.js 先 (sleep 3 → port 3000), Tunnel 後 (sleep 10)

  Tunnel 日誌
    /tmp/tunnel.log

═══════════════════════════════════════════════════════════════
  Tunnel 資訊
═══════════════════════════════════════════════════════════════
  名稱:      lemons-dashboard
  UUID:      991df800-fd22-4140-9600-08ce8551619d
  協定:      QUIC (4條並行連線)
  節點:      香港 (hkg01/hkg09/hkg10/hkg13)
  網域:      lemonffing.com (Cloudflare Registrar)

═══════════════════════════════════════════════════════════════
  常用指令
═══════════════════════════════════════════════════════════════

  手動啟動:
    ~/.local/bin/cloudflared tunnel --config ~/.cloudflared/config.yml run

  手動啟動 (背景 + 日誌):
    ~/.local/bin/cloudflared tunnel --config ~/.cloudflared/config.yml \
      --logfile /tmp/tunnel.log run &

  檢查狀態:
    ps aux | grep -E "cloudflared|next-server"

  查看日誌:
    tail -f /tmp/tunnel.log     # Tunnel
    tail -f /tmp/nextjs.log     # Next.js

  從 Windows 測試:
    Invoke-WebRequest -Uri "https://dashboard.lemonffing.com" -UseBasicParsing

  新增子網域 (例如 quantdinger.lemonffing.com):
    1. 編輯 ~/.cloudflared/config.yml 加 ingress rule
    2. cloudflared tunnel route dns lemons-dashboard quantdinger.lemonffing.com
    3. 重啟 tunnel

═══════════════════════════════════════════════════════════════
  注意事項
═══════════════════════════════════════════════════════════════
  - WSL 不支援 IPv6, curl 測試請從 Windows 端執行
  - 憑證檔 ~/.cloudflared/*.json 為機敏資料, 勿提交 git
  - trycloudflare.com 臨時 tunnel 無上線保證, 每次重啟 URL 會變,
    已永久方案完全取代
  - 開機自動啟動依賴 cron @reboot, WSL 重啟後約 10 秒 tunnel 上線
