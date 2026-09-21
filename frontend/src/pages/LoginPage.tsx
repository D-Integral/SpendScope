import { useEffect, useState } from 'react';
import { Github } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12z"
      />
      <path
        fill="#34A853"
        d="M6.6 14.3l-.9.7-2.6 2C4.8 20 8.1 22 12 22c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 1-3.6 1-2.7 0-5-1.8-5.8-4.3z"
      />
      <path
        fill="#4A90E2"
        d="M3.1 7.1C2.4 8.5 2 10.2 2 12s.4 3.5 1.1 4.9l3.5-2.7C6.2 13.5 6 12.8 6 12s.2-1.5.6-2.2L3.1 7.1z"
      />
      <path
        fill="#FBBC05"
        d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 3.1 14.7 2 12 2 8.1 2 4.8 4 3.1 7.1l3.5 2.7C7 6.8 9.3 6 12 6z"
      />
    </svg>
  );
}

export function LoginPage() {
  const { refresh } = useAuth();
  const [providers, setProviders] = useState({ google: false, github: false, testMode: false });
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromProvider = params.get('error');
    if (fromProvider) setError(`Could not sign in with ${fromProvider}. Please try again.`);
    api.providers().then(setProviders).catch(() => undefined);
  }, []);

  async function testSignIn(provider: 'google' | 'github') {
    setTesting(true);
    setError(null);
    try {
      await api.testLogin({
        provider,
        providerUserId: provider === 'google' ? 'local-google-demo' : 'local-github-demo',
        email: provider === 'google' ? 'demo@example.com' : null,
        displayName: provider === 'google' ? 'Google Demo' : 'GitHub Demo',
        avatarUrl: null,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test sign-in failed.');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-brand px-12 py-16 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute bottom-20 right-10 h-40 w-40 rounded-full bg-teal-300/20" />
        <p className="font-display text-3xl">SpendScope</p>
        <div>
          <h1 className="font-display text-5xl leading-tight">
            See where the month goes — before it gets away from you.
          </h1>
          <p className="mt-5 max-w-md text-lg text-teal-50">
            Track spending by category, set a monthly budget, and get live alerts at 50%, 80%, and
            100% of your limit.
          </p>
        </div>
        <p className="text-sm text-teal-100">Personal accounts only. No sharing, no public links.</p>
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <p className="mb-2 font-display text-2xl text-brand lg:hidden">SpendScope</p>
          <h2 className="font-display text-4xl">Welcome back</h2>
          <p className="mt-2 text-ink-muted">Continue with your Google or GitHub account.</p>

          {error ? (
            <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="mt-8 space-y-3">
            <a
              href="/api/auth/google"
              className="btn-secondary h-12 w-full text-base hover:bg-white"
            >
              <GoogleIcon />
              Continue with Google
            </a>
            <a href="/api/auth/github" className="btn-secondary h-12 w-full text-base hover:bg-white">
              <Github className="h-5 w-5" />
              Continue with GitHub
            </a>
          </div>

          {providers.testMode ? (
            <div className="mt-8 rounded-2xl border border-dashed border-stone-300 p-4">
              <p className="text-sm font-semibold">Local test sign-in</p>
              <p className="mt-1 text-xs text-ink-muted">
                AUTH_TEST_MODE is on. These buttons stub SSO and are for local demos/tests only.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={testing}
                  onClick={() => void testSignIn('google')}
                >
                  Mock Google
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={testing}
                  onClick={() => void testSignIn('github')}
                >
                  Mock GitHub
                </button>
              </div>
            </div>
          ) : null}

          {!providers.google || !providers.github ? (
            <p className="mt-6 text-xs text-ink-faint">
              Provider buttons are always shown. If a provider is not configured on the server, the
              sign-in attempt will fail until OAuth credentials are added.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
