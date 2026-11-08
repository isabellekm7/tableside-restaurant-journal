import { CircleAlert, Lock, LogOut, MailCheck, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Notice } from '../../components/ui/Notice'
import { PasswordField } from '../../components/ui/PasswordField'
import { Skeleton } from '../../components/ui/Skeleton'
import { StateMessage } from '../../components/ui/StateMessage'
import { TextField } from '../../components/ui/TextField'
import { MIN_PASSWORD_LENGTH, validateEmail, validateNewPassword, type AuthResult, type SimpleAuthResult } from '../../data'
import { cx } from '../../lib/cx'
import { usePageTitle } from '../../lib/usePageTitle'
import { useAuthStore } from '../../store/authStore'

type Mode = 'signup' | 'signin' | 'forgot'

const RESEND_COOLDOWN_SECONDS = 60

function Page({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-heading">{title}</h1>
        {intro && <p className="mt-2 text-text-muted">{intro}</p>}
      </header>
      {children}
    </div>
  )
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-bg px-3 py-2 text-small font-medium text-danger">
      <CircleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
      {message}
    </p>
  )
}

/** Sign up or sign in. Which one is chosen with the toggle above the form. */
function CredentialsForm({
  mode,
  onResult,
  onForgot,
}: {
  mode: 'signup' | 'signin'
  onResult: (result: AuthResult, email: string) => void
  onForgot: () => void
}) {
  const service = useAuthStore((s) => s.service)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const signingUp = mode === 'signup'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next = {
      email: validateEmail(email) ?? undefined,
      password: (signingUp ? validateNewPassword(password, email) : password ? null : 'Enter your password.') ?? undefined,
    }
    setErrors(next)
    setFormError(null)
    if (next.email || next.password) return

    setPending(true)
    const result = signingUp ? await service.signUp(email, password) : await service.signIn(email, password)
    setPending(false)
    if (result.status === 'error') {
      setFormError(result.message)
      // A wrong password shouldn't linger in the field.
      if (result.code === 'invalid_credentials') setPassword('')
      return
    }
    setPassword('')
    onResult(result, email)
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <TextField
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={email}
        error={errors.email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <PasswordField
        label="Password"
        autoComplete={signingUp ? 'new-password' : 'current-password'}
        value={password}
        error={errors.password}
        hint={signingUp ? `At least ${MIN_PASSWORD_LENGTH} characters. A few random words works well.` : undefined}
        onChange={(e) => setPassword(e.target.value)}
      />
      <FormError message={formError} />
      <Button type="submit" size="lg" fullWidth disabled={pending}>
        {pending ? (signingUp ? 'Creating account…' : 'Signing in…') : signingUp ? 'Create account' : 'Sign in'}
      </Button>
      {!signingUp && (
        <Button variant="ghost" onClick={onForgot}>
          Forgot your password?
        </Button>
      )}
      <p className="flex items-start gap-2 text-small text-text-muted">
        <Lock size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        We use your email only to sign you in. Your kids’ ages stay on this device.
      </p>
    </form>
  )
}

function ConfirmEmail({ email, onBack }: { email: string; onBack: () => void }) {
  const service = useAuthStore((s) => s.service)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  const resend = async () => {
    setMessage(null)
    const result: SimpleAuthResult = await service.resendConfirmation(email)
    if (result.status === 'ok') {
      setMessage({ kind: 'ok', text: 'Sent again. It can take a minute to arrive.' })
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } else {
      setMessage({ kind: 'error', text: result.message })
    }
  }

  return (
    <Page title="Check your email">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface p-6 text-center shadow-card">
        <span className="flex size-14 items-center justify-center rounded-pill bg-primary-soft text-primary">
          <MailCheck size={26} aria-hidden="true" />
        </span>
        <p>
          We sent a confirmation link to <strong className="break-all">{email}</strong>. Open it to finish creating your account.
        </p>
        <p className="text-small text-text-muted">Nothing there? Check your spam folder.</p>
      </div>
      {message && (message.kind === 'error' ? <FormError message={message.text} /> : <Notice>{message.text}</Notice>)}
      <div className="flex flex-col gap-2">
        <Button variant="secondary" onClick={resend} disabled={cooldown > 0}>
          {cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend email'}
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Use a different email
        </Button>
      </div>
    </Page>
  )
}

function ForgotPassword({ onBack }: { onBack: () => void }) {
  const service = useAuthStore((s) => s.service)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const problem = validateEmail(email)
    setError(problem)
    if (problem) return
    setPending(true)
    const result = await service.requestPasswordReset(email)
    setPending(false)
    if (result.status === 'error') setError(result.message)
    else setSentTo(email.trim())
  }

  if (sentTo) {
    return (
      <Page title="Check your email">
        <Notice>If an account exists for {sentTo}, we’ve sent a link to reset your password.</Notice>
        <Button variant="ghost" onClick={onBack}>
          Back to sign in
        </Button>
      </Page>
    )
  }

  return (
    <Page title="Reset your password" intro="Enter your email and we’ll send you a link to choose a new one.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField label="Email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
        <FormError message={error} />
        <Button type="submit" size="lg" fullWidth disabled={pending}>
          {pending ? 'Sending…' : 'Send reset link'}
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Back to sign in
        </Button>
      </form>
    </Page>
  )
}

function SetNewPassword() {
  const service = useAuthStore((s) => s.service)
  const finishRecovery = useAuthStore((s) => s.finishRecovery)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const problem = validateNewPassword(password)
    setError(problem)
    if (problem) return
    setPending(true)
    const result = await service.updatePassword(password)
    setPending(false)
    if (result.status === 'error') setError(result.message)
    else finishRecovery()
  }

  return (
    <Page title="Choose a new password">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <PasswordField label="New password" autoComplete="new-password" value={password} hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} onChange={(e) => setPassword(e.target.value)} />
        <FormError message={error} />
        <Button type="submit" size="lg" fullWidth disabled={pending}>
          {pending ? 'Saving…' : 'Save password'}
        </Button>
      </form>
    </Page>
  )
}

function SignedIn() {
  const service = useAuthStore((s) => s.service)
  const user = useAuthStore((s) => s.user)
  const [pending, setPending] = useState(false)

  return (
    <Page title="Your account">
      <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 shadow-card">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-primary-soft text-primary">
          <UserRound size={24} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-small text-text-muted">Signed in as</p>
          <p className="font-semibold break-all">{user?.email ?? 'your account'}</p>
        </div>
      </div>
      <Notice>Your saved lists now sync to your account.</Notice>
      <div className="flex flex-col gap-2">
        <ButtonLink to="/" size="lg" fullWidth>
          Back to Explore
        </ButtonLink>
        <Button
          variant="secondary"
          leadingIcon={<LogOut size={18} aria-hidden="true" />}
          disabled={pending}
          onClick={async () => {
            setPending(true)
            await service.signOut()
            setPending(false)
          }}
        >
          Sign out
        </Button>
      </div>
      <p className="text-small text-text-muted">Signing out keeps lists already saved on this device. They’ll sync again when you sign back in.</p>
    </Page>
  )
}

function SignedOut() {
  const [mode, setMode] = useState<Mode>('signup')
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)

  if (confirmEmail) return <ConfirmEmail email={confirmEmail} onBack={() => setConfirmEmail(null)} />
  if (mode === 'forgot') return <ForgotPassword onBack={() => setMode('signin')} />

  return (
    <Page title={mode === 'signup' ? 'Create your account' : 'Welcome back'} intro="Optional: an account syncs your saved lists across devices. Everything else works without one.">
      <div role="group" aria-label="Sign up or sign in" className="flex rounded-pill border-2 border-line-strong p-0.5">
        {(
          [
            ['signup', 'Create account'],
            ['signin', 'Sign in'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            className={cx(
              'min-h-10 flex-1 rounded-pill px-4 text-small font-semibold transition-colors duration-(--duration-fast)',
              mode === value ? 'bg-primary text-on-primary' : 'text-text-muted hover:text-text',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {/* key: switching modes starts a clean form (no stale errors or password). */}
      <CredentialsForm
        key={mode}
        mode={mode}
        onForgot={() => setMode('forgot')}
        onResult={(result) => {
          if (result.status === 'confirm_email') setConfirmEmail(result.email)
        }}
      />
    </Page>
  )
}

/** /account: create an account, sign in, reset a password, or sign out. */
export function AccountPage() {
  usePageTitle('Account')
  const service = useAuthStore((s) => s.service)
  const user = useAuthStore((s) => s.user)
  const ready = useAuthStore((s) => s.ready)
  const recovering = useAuthStore((s) => s.recovering)

  if (!service.available) {
    return (
      <StateMessage kind="offline" level={1} title="Accounts aren’t available here">
        This copy of Tableside is running on its bundled sample data with no backend, so there’s nothing to sign in to. Everything else works.
      </StateMessage>
    )
  }
  if (!ready) {
    return (
      <Page title="Account">
        <div role="status" aria-label="Checking your session" className="flex flex-col gap-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      </Page>
    )
  }
  if (recovering) return <SetNewPassword />
  if (user) return <SignedIn />
  return <SignedOut />
}

