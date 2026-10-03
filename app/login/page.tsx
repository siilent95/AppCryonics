export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="loginPanel"><h1>CryoPM</h1><p>Sign in to manage preventive maintenance.</p>
    {error && <p role="alert">Invalid email or password.</p>}
    <form action="/api/auth/login" method="post">
      <label>Email<input name="email" type="email" autoComplete="username" required maxLength={320} /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
      <button className="primaryButton" type="submit">Sign in</button>
    </form></main>;
}
