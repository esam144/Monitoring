import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/axios';

const MonitorIcon = () => (
  <svg
    className="w-7 h-7 text-indigo-600"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="1.75"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.671A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7.5 11.25l2.25-2.25 2.25 3 3-4.5 1.5 1.5"
    />
  </svg>
);

const loginInputClass =
  'w-full rounded-[10px] border border-gray-200 bg-white px-3.5 text-sm text-gray-900 placeholder-gray-400 min-h-12 outline-none transition-[border-color,box-shadow] duration-150 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25';

export default function Login() {
  const { login, isAuthenticated, bootstrapping } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (bootstrapping) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-sm text-gray-500 px-4"
        style={{
          background: 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf3 100%)',
        }}
      >
        Loading…
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      const redirectTo = location.state?.from?.pathname || '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(
        getErrorMessage(err, 'Unable to sign in. Check your credentials and try again.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-[5%] sm:px-4 py-8 sm:py-12"
      style={{
        background: 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf3 100%)',
      }}
    >
      <div className="w-full max-w-[26rem]">
        <div
          className="bg-white rounded-2xl border border-white/80 p-8 sm:p-10"
          style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
        >
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <MonitorIcon />
            </div>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-gray-900 text-balance leading-snug">
              Welcome to Monitoring App
            </h1>
            <p className="mt-1.5 text-sm text-gray-500">Sign in to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-gray-800 mb-2"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={loginInputClass}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-gray-800 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={loginInputClass}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="text-sm font-medium text-red-700 bg-red-50 border border-red-100 rounded-[10px] px-3.5 py-2.5"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-12 rounded-[10px] text-sm font-bold text-white shadow-sm transition-all duration-150 hover:brightness-105 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
              }}
            >
              {submitting ? 'Signing in…' : 'Login'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-500 leading-relaxed">
            Need an account? Ask an admin to create one for you.
          </p>
        </div>
      </div>
    </div>
  );
}
