import React, { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';

const Layout = ({ children }) => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 动态页面标题
  useEffect(() => {
    const titles = {
      '/': '首页',
      '/search': '搜索',
      '/upload': '上传视频',
      '/my-videos': '我的视频',
      '/profile': '个人资料',
      '/login': '登录',
      '/register': '注册',
      '/admin': '管理后台',
      '/admin/videos': '视频管理',
      '/admin/users': '用户管理',
      '/admin/scraper': '视频抓取',
    };
    const matched = Object.keys(titles).find(k => location.pathname === k || location.pathname.startsWith(k + '/'));
    document.title = matched ? `${titles[matched]} - 视频平台` : '视频平台';
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => {
    return location.pathname === path ? 'text-primary-600' : 'text-gray-600 hover:text-primary-600';
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900">视频平台</span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <Link to="/" className={`font-medium transition-colors ${isActive('/')}`}>
                首页
              </Link>
              {user && (
                <>
                  <Link to="/upload" className={`font-medium transition-colors ${isActive('/upload')}`}>
                    上传视频
                  </Link>
                  <Link to="/my-videos" className={`font-medium transition-colors ${isActive('/my-videos')}`}>
                    我的视频
                  </Link>
                  <Link to="/profile" className={`font-medium transition-colors ${isActive('/profile')}`}>
                    个人资料
                  </Link>
                </>
              )}
              {isAdmin() && (
                <Link to="/admin" className={`font-medium transition-colors ${isActive('/admin')}`}>
                  管理后台
                </Link>
              )}
            </nav>

            {/* User Actions */}
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-3">
                  {/* 通知提醒 */}
                  <NotificationBell />
                  
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-primary-700">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-gray-700">
                      {user.username}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-500 hover:text-red-600 transition-colors"
                  >
                    退出
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Link
                    to="/login"
                    className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors"
                  >
                    登录
                  </Link>
                  <Link
                    to="/register"
                    className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                  >
                    注册
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 py-8 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-white font-semibold mb-4">关于我们</h3>
              <p className="text-sm">
                轻量级视频分享平台，为用户提供优质的视频观看和分享体验。
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">快速链接</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/" className="hover:text-white transition-colors">首页</Link></li>
                <li><Link to="/search" className="hover:text-white transition-colors">搜索</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">登录</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">联系我们</h3>
              <p className="text-sm">
                如有任何问题或建议，请随时与我们联系。
              </p>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} 视频平台. 保留所有权利。</p>
          </div>
        </div>
      </footer>
      {/* 移动端底部导航 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex">
        {[
          { to: '/', label: '首页', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
          { to: '/search', label: '搜索', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
          ...(user ? [{ to: '/upload', label: '上传', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' }] : []),
          ...(user ? [{ to: '/my-videos', label: '我的', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' }] : [{ to: '/login', label: '登录', icon: 'M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1' }]),
        ].map(item => (
          <Link key={item.to} to={item.to}
            className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${location.pathname === item.to ? 'text-primary-600' : 'text-gray-500'}`}>
            <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
            </svg>
            {item.label}
          </Link>
        ))}
      </nav>
      {/* 移动端底部导航占位 */}
      <div className="md:hidden h-16" />
    </div>
  );
};

export default Layout;
