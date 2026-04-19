#!/usr/bin/env bash
# 视频平台服务管理脚本
# 使用方法: ./service.sh [start|stop|restart|status]

PROJECT_DIR="/home/alan/videoplatform"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

start_backend() {
    echo "🚀 启动后端服务..."
    cd "$BACKEND_DIR"
    
    # 清理端口
    lsof -ti:5000 | xargs kill -9 2>/dev/null || true
    
    source .venv/bin/activate
    python run.py &
    echo "✅ 后端服务已启动 (PID: $!)"
}

start_frontend() {
    echo "📱 启动前端服务..."
    cd "$FRONTEND_DIR"
    
    # 清理端口
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    
    NODE_NO_WARNINGS=1 pnpm start &
    echo "✅ 前端服务已启动 (PID: $!)"
}

stop_services() {
    echo "🛑 停止所有服务..."
    pkill -f "python.*run.py" 2>/dev/null || true
    pkill -f "react-scripts" 2>/dev/null || true
    pkill -f "pnpm" 2>/dev/null || true
    echo "✅ 所有服务已停止"
}

check_status() {
    echo "📊 检查服务状态..."
    
    # 检查后端
    if lsof -ti:5000 >/dev/null 2>&1; then
        echo "✅ 后端运行中 (端口5000)"
    else
        echo "❌ 后端未运行"
    fi
    
    # 检查前端
    if lsof -ti:3000 >/dev/null 2>&1; then
        echo "✅ 前端运行中 (端口3000)"
    else
        echo "❌ 前端未运行"
    fi
}

case "$1" in
    start)
        start_backend
        start_frontend
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        sleep 2
        start_backend
        start_frontend
        ;;
    status)
        check_status
        ;;
    both)
        start_backend
        sleep 3
        start_frontend
        ;;
    *)
        echo "使用方法: $0 [start|stop|restart|status|both]"
        exit 1
        ;;
esac