import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const iconClass = 'w-5 h-5 flex-shrink-0';

const LogoIcon = () => (
  <div className="h-6 w-6 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center">
    <img
      src="/logo_monitoring_app.png"
      alt="App Logo"
      className="w-full h-full object-contain"
    />
  </div>
);

const DashboardIcon = () => (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
  </svg>
);

const SitesIcon = () => (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.5 3a17 17 0 000 18M12.5 3a17 17 0 010 18" />
  </svg>
);

const UsersIcon = () => (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.5-1.632z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const LogoutIcon = () => (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12" />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const navItemClass = (isActive) =>
  `flex items-center w-full px-2.5 py-2.5 rounded-xl transition-colors duration-200 ${
    isActive
      ? 'bg-white text-black shadow-sm font-semibold'
      : 'text-gray-600 hover:text-black hover:bg-gray-200/70'
  }`;

export default function SidebarLayout({ children }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const mainRef = useRef(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { id: 'sites', label: 'Sites', icon: <SitesIcon />, path: '/sites' },
    { id: 'config', label: 'Config', icon: <SettingsIcon />, path: '/config' },
    { id: 'users', label: 'Users', icon: <UsersIcon />, path: '/users' },
  ];

  const handleLogout = async () => {
    await logout();
    setIsMobileMenuOpen(false);
    navigate('/login');
  };

  const displayName = user?.name || user?.email || 'User';

  return (
    <div className="relative flex w-full h-screen max-h-screen border border-gray-200 bg-gray-100 overflow-hidden shadow-sm">
      {!isMobileMenuOpen && (
        <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-14 px-4 bg-gray-100 border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0">
            <LogoIcon />
            <span className="font-semibold text-gray-900 text-sm truncate">Monitoring App</span>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors"
            aria-label="Open navigation"
          >
            <MenuIcon />
          </button>
        </header>
      )}

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <aside className="w-[min(80%,280px)] h-full bg-gray-100 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <LogoIcon />
                <span className="font-semibold text-gray-900 text-sm truncate">Monitoring App</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors"
                aria-label="Close navigation"
              >
                <CloseIcon />
              </button>
            </div>

            <nav className="flex flex-col flex-1 p-3 gap-1.5 overflow-y-auto">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={navItemClass(isActive)}
                    aria-label={item.label}
                  >
                    <div className="w-6 flex justify-center flex-shrink-0">{item.icon}</div>
                    <span className="ml-3 text-sm font-medium">{item.label}</span>
                  </NavLink>
                );
              })}

              <button
                type="button"
                onClick={handleLogout}
                className={`${navItemClass(false)} mt-auto`}
                aria-label="Logout"
              >
                <div className="w-6 flex justify-center flex-shrink-0"><LogoutIcon /></div>
                <span className="ml-3 text-sm font-medium">Logout</span>
              </button>
            </nav>

            <div className="flex items-center gap-3 p-4 border-t border-gray-200 flex-shrink-0">
              <img alt="" className="w-9 h-9 rounded-full object-cover" src="/logo.png" />
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-800 block truncate">{displayName}</span>
                {user?.role && (
                  <span className="text-xs uppercase text-gray-500">{user.role}</span>
                )}
              </div>
            </div>
          </aside>

          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex-1 h-full bg-black/40"
          />
        </div>
      )}

      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`hidden md:flex md:sticky md:top-0 md:h-screen md:self-start bg-gray-100 flex-col justify-between p-3 flex-shrink-0 transition-all duration-300 ease-in-out z-20 ${
          isHovered ? 'md:w-56' : 'md:w-16'
        }`}
      >
        <div className="flex items-center gap-3 overflow-hidden h-10 px-1">
          <div className="w-8 flex justify-center flex-shrink-0">
            <LogoIcon />
          </div>
          <span
            className={`font-semibold text-gray-900 text-sm whitespace-nowrap transition-opacity duration-200 ${
              isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            Monitoring App
          </span>
        </div>

        <nav className="flex flex-col flex-1 my-6 gap-1.5">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.id}
                to={item.path}
                title={item.label}
                aria-label={item.label}
                className={navItemClass(isActive)}
              >
                <div className="w-6 flex justify-center flex-shrink-0">{item.icon}</div>
                <span
                  className={`ml-3 text-sm font-medium whitespace-nowrap transition-opacity duration-200 ${
                    isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          })}

          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
            className={navItemClass(false)}
          >
            <div className="w-6 flex justify-center flex-shrink-0"><LogoutIcon /></div>
            <span
              className={`ml-3 text-sm font-medium whitespace-nowrap transition-opacity duration-200 ${
                isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              Logout
            </span>
          </button>
        </nav>

        <div className="flex items-center gap-3 overflow-hidden pt-3 border-t border-transparent px-1">
          <div className="w-8 flex justify-center flex-shrink-0">
            <img alt="" className="w-7 h-7 rounded-full object-cover" src="/logo.png" />
          </div>
          <span
            className={`text-sm font-medium text-gray-800 whitespace-nowrap transition-opacity duration-200 ${
              isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {displayName}
          </span>
        </div>
      </aside>

      {!isMobileMenuOpen && (
        <main
          ref={mainRef}
          className="flex-1 min-w-0 min-h-0 bg-white rounded-xl mt-14 md:mt-2 m-2 p-4 sm:p-5 md:p-6 overflow-y-auto overflow-x-hidden border border-gray-200/80 shadow-inner"
        >
          {children}
        </main>
      )}
    </div>
  );
}
