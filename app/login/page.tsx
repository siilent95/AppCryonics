import { PasswordInput } from "@/features/accounts/PasswordInput";
import Image from "next/image";
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="authScreen">
    <section className="loginPanel signInPanel" aria-labelledby="sign-in-title">
      <header className="signInIdentity">
        <Image className="signInLogo" src="/brand/logo-light.png" alt="Cryogenics Solution Inc." width={212} height={56} priority />
        <h1 id="sign-in-title">CryoPM</h1>
        <p>Sign in to your maintenance workspace.</p>
      </header>
      {error && <p className="signInError" id="login-error" role="alert">Email, username or password is incorrect.</p>}
      <form action="/api/auth/login" method="post">
        <label htmlFor="login-identity">Email or username<input id="login-identity" name="email" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={320} aria-invalid={!!error || undefined} aria-describedby={error ? "login-error" : undefined} /></label>
        <PasswordInput id="login-password" name="password" label="Password" autoComplete="current-password" invalid={!!error} describedBy={error ? "login-error" : undefined} />
        <button className="primaryButton" type="submit">Sign in</button>
      </form>
      <p className="passwordHelp">Need access or a password reset? Contact your administrator for a private invitation link.</p>
    </section>
  </main>;
}
