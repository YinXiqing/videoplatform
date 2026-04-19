#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$ROOT_DIR/backend/.venv"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

check_python() {
  if ! command -v uv >/dev/null 2>&1; then
    echo "[错误] 未找到 uv，请先安装 uv 并确保可执行。"
    exit 1
  fi
}

activate_venv() {
  if [ ! -d "$VENV_DIR" ]; then
    echo "[信息] 创建虚拟环境：$VENV_DIR"
    uv venv "$VENV_DIR"
  fi
  # shellcheck source=/dev/null
  source "$VENV_DIR/bin/activate"
}

install_backend_deps() {
  activate_venv
  uv pip install -r "$BACKEND_DIR/requirements.txt"
}

install_frontend_deps() {
  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "[信息] 安装前端依赖..."
    cd "$FRONTEND_DIR"
    pnpm install
  fi
}

init_db() {
  echo "[信息] 初始化数据库..."
  cd "$BACKEND_DIR"
  install_backend_deps
  python init_db.py
  echo
  echo "[成功] 数据库初始化完成！"
  echo "默认管理员账号: admin / admin123"
}

start_backend() {
  echo "[信息] 启动后端服务器..."
  cd "$BACKEND_DIR"
  install_backend_deps
  python run.py
}

start_frontend() {
  echo "[信息] 启动前端服务器..."
  cd "$FRONTEND_DIR"
  install_frontend_deps
  pnpm start
}

start_both() {
  echo "[信息] 同时启动前后端服务器..."
  install_backend_deps
  install_frontend_deps

  (cd "$BACKEND_DIR" && python run.py) &
  sleep 3
  cd "$FRONTEND_DIR"
  pnpm start
}

show_menu() {
  cat <<EOF
========================================
   轻量级视频平台启动脚本 (Linux/macOS)
========================================

1. 初始化数据库
2. 启动后端服务器
3. 启动前端服务器
4. 同时启动前后端服务器
5. 退出
EOF

  read -rp "请输入选项 (1-5): " choice
  case "$choice" in
    1) init_db ;; 
    2) start_backend ;; 
    3) start_frontend ;; 
    4) start_both ;; 
    5) exit 0 ;; 
    *) echo "无效选项，请重新选择"; show_menu ;; 
  esac
}

check_python

if [ "$#" -gt 0 ]; then
  case "$1" in
    init_db) init_db ;; 
    backend) start_backend ;; 
    frontend) start_frontend ;; 
    both) start_both ;; 
    *) echo "用法: ./start.sh [init_db|backend|frontend|both]"; exit 1 ;;
  esac
else
  show_menu
fi
