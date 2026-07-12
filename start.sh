#!/bin/bash
# ============================================================
# Lemon's AI Agent — 一鍵啟動 (WSL)
# 由 Windows .bat 或 WSL terminal 直接呼叫
# ============================================================
set -e

PROJECT_DIR="/home/lemon/lemons-ai-agent"
LOG_DIR="/tmp/lemons-agent"
mkdir -p "$LOG_DIR"

echo "========================================"
echo "  Lemon's AI Agent — 啟動中..."
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
echo ""

# ---- 1. Docker Desktop readiness ----
echo "[1/3] Docker + PostgreSQL..."
# Wait for Docker daemon to be ready (up to 30 seconds at boot)
DOCKER_READY=false
for i in $(seq 1 15); do
    if docker ps >/dev/null 2>&1; then
        DOCKER_READY=true
        break
    fi
    [ $i -eq 1 ] && echo "  → 等候 Docker Desktop 就緒..."
    printf "."
    sleep 2
done
echo ""
if [ "$DOCKER_READY" = true ]; then
    echo "  → Docker Desktop ✅"
    if docker ps --format '{{.Names}}' | grep -q '^lemonhermes-postgres$'; then
        echo "  → PostgreSQL 已經運行中 ✅"
    else
        echo "  → 啟動 PostgreSQL container..."
        docker start lemonhermes-postgres 2>/dev/null || {
            echo "  ⚠ 無法啟動 PostgreSQL container"
        }
        sleep 2
    fi
else
    echo "  ⚠ Docker Desktop 未能啟動，PostgreSQL 跳過（Next.js 可能無法登入）"
fi

# ---- 2. Next.js (port 3000) ----
echo "[2/3] Next.js (port 3000)..."
fuser -k 3000/tcp 2>/dev/null && echo "  → 已清除舊 process" || true
sleep 1

cd "$PROJECT_DIR/frontend"
nohup "$PROJECT_DIR/frontend/node_modules/.bin/next" dev --port 3000 \
    > "$LOG_DIR/nextjs.log" 2>&1 &
echo "  → PID $!，log: $LOG_DIR/nextjs.log"

# ---- 3. Cloudflare Tunnel ----
echo "[3/3] Cloudflare Tunnel..."
# Check if tunnel is already running
if pgrep -f "cloudflared tunnel run lemons-dashboard" > /dev/null 2>&1; then
    echo "  → 已經運行中"
else
    nohup /home/lemon/.local/bin/cloudflared tunnel run lemons-dashboard \
        > "$LOG_DIR/cloudflared.log" 2>&1 &
    echo "  → PID $!，log: $LOG_DIR/cloudflared.log"
fi

echo ""
echo "========================================"
echo "  等待服務就緒..."
echo "========================================"

# ---- Health Check ----
for i in $(seq 1 30); do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/login 2>/dev/null || echo "000")
    if [ "$CODE" = "200" ]; then
        echo ""
        echo "✅ Next.js     : http://localhost:3000  (HTTP $CODE)"
        break
    fi
    [ $i -eq 1 ] && printf "  等待 Next.js 編譯"
    printf "."
    sleep 2
done

# Tunnel check
TUNNEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://dashboard.lemonffing.com/login 2>/dev/null || echo "000")
if [ "$TUNNEL_CODE" = "200" ]; then
    echo "✅ Cloudflare  : https://dashboard.lemonffing.com  (HTTP $TUNNEL_CODE)"
else
    echo "⚠  Cloudflare Tunnel 尚未就緒 (HTTP $TUNNEL_CODE)，稍後會自動連接"
fi

echo ""
echo "========================================"
echo "  全部啟動完成 🚀"
echo "========================================"
