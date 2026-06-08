export function OAuthCallback() {
  return (
    <div className="oauth-callback-screen">
      <div className="oauth-callback-card">
        <i className="fas fa-circle-notch fa-spin oauth-callback-spinner" aria-hidden />
        <h1>Signing you in</h1>
        <p>Completing Google authentication…</p>
      </div>
    </div>
  );
}
