import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/axios';

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
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-sm text-gray-500 px-4">
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
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-8 sm:py-12">
      <div className="w-full max-w-[26rem]">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="h-11 w-11 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center mb-4">
              <img
                src="/logo_monitoring_app.png"
                alt=""
                className="w-full h-full object-contain p-1"
              />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 text-balance">
              Welcome to Monitoring App
            </h1>
            <p className="mt-1 text-sm text-gray-500">Sign in to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label htmlFor="email" className="label-field">
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
                className="input-field min-h-11"
              />
            </div>

            <div>
              <label htmlFor="password" className="label-field">
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
                className="input-field min-h-11"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="text-sm font-medium text-red-700 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full min-h-11 active:bg-gray-900"
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
