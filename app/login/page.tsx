export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <span className="login-logo" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="26"
            height="26"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M2.5 9.5a15 15 0 0 1 19 0" />
            <path d="M5.5 13a10.5 10.5 0 0 1 13 0" />
            <path d="M8.5 16.5a6 6 0 0 1 7 0" />
            <circle cx="12" cy="19" r="1.3" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <h1 className="login-title">Network Monitor</h1>
        <p className="muted">
          Login untuk mengakses dashboard monitoring jaringan kamu.
        </p>
        <a className="btn-github" href="/api/auth/login">
          <span className="btn-github-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </span>
          <span>Login dengan GitHub</span>
        </a>
      </div>
    </div>
  );
}
