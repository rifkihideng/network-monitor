export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1>Network Monitor</h1>
        <p className="muted">
          Login untuk mengakses dashboard monitoring jaringan kamu.
        </p>
        <a className="btn-github" href="/api/auth/login">
          Login dengan GitHub
        </a>
      </div>
    </div>
  );
}
