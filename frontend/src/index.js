import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// 禁用浏览器自动滚动恢复，由应用自己控制
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

// 提前加载 HLS.js，避免悬浮预览时等待脚本下载
if (!window.Hls) {
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js';
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
