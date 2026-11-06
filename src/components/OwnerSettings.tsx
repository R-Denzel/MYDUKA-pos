import { FormEvent, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { Bell, LayoutDashboard, LogIn, LogOut, X } from 'lucide-react';
import { toast } from 'sonner';
import { auth } from '@/lib/firebase';
import { enableSaleNotifications } from '@/lib/notifications';
import { useStore } from '@/store/useStore';

interface OwnerSettingsProps {
  user: User | null;
  hasPremium: boolean;
  isAdmin: boolean;
  demoModeAvailable: boolean;
  isDemoMode: boolean;
  onClose: () => void;
  onOpenAdmin: () => void;
  onToggleDemoMode: () => void;
}

export default function OwnerSettings({
  user,
  hasPremium,
  isAdmin,
  demoModeAvailable,
  isDemoMode,
  onClose,
  onOpenAdmin,
  onToggleDemoMode,
}: OwnerSettingsProps) {
  const {
    vatEnabled,
    vatRate,
    vatInclusive,
    vatCountry,
    setVatSettings,
    setNotificationOwnerUid,
  } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      console.error('Owner sign-in failed', error);
      toast.error('Sign-in failed. Check your email and password.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!email.trim() || password.length < 6) {
      toast.error('Enter an email and a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      toast.success('Owner account created');
      if (auth.currentUser) {
        try {
          await sendEmailVerification(auth.currentUser);
          toast.info('Check your email to verify the account before admin access.');
        } catch (error) {
          console.error('Could not send owner email verification', error);
          toast.error('Account created, but the verification email could not be sent.');
        }
      }
    } catch (error) {
      console.error('Owner account creation failed', error);
      toast.error('Could not create account. The email may already be registered.');
    } finally {
      setBusy(false);
    }
  };

  const handleEnableNotifications = async () => {
    setBusy(true);
    try {
      await enableSaleNotifications();
      if (user) setNotificationOwnerUid(user.uid);
      toast.success('Sale notifications enabled on this device');
    } catch (error) {
      console.error('Sale notifications could not be enabled', error);
      toast.error(error instanceof Error ? error.message : 'Could not enable notifications.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="owner-settings-title"
        className="safe-bottom max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-border bg-card p-5 shadow-modal sm:rounded-3xl sm:p-7"
      >
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Optional account and paid tools</p>
            <h2 id="owner-settings-title" className="mt-1 text-xl font-extrabold">Owner settings</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close settings" className="touch-target rounded-xl p-2 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-5">
          {demoModeAvailable && !user && (
            <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-bold">Local Premium demo</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Try Premium controls without creating an account. Demo changes to products and sales stay on this device and are not synced to Firebase. Notifications and admin tools still require a real account.
              </p>
              <button
                type="button"
                aria-pressed={isDemoMode}
                onClick={onToggleDemoMode}
                className="mt-3 min-h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                {isDemoMode ? 'End local Premium demo' : 'Start local Premium demo'}
              </button>
            </section>
          )}

          <section className="rounded-2xl border border-border p-4">
            {user ? (
              <>
                <p className="text-sm font-semibold">Signed in as {user.email}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasPremium ? 'Premium is active for this account.' : 'Basic plan · Premium tools require admin activation.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={onOpenAdmin}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Admin dashboard
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy || !hasPremium}
                    onClick={handleEnableNotifications}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted disabled:opacity-50"
                  >
                    <Bell className="h-4 w-4" />
                    {hasPremium ? 'Enable sale alerts' : 'Premium sale alerts'}
                  </button>
                  {!hasPremium && (
                    <p className="w-full text-xs text-muted-foreground">
                      Activate Premium to receive sale alerts on this device.
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => signOut(auth)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted disabled:opacity-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <>
              {isDemoMode && (
                <p className="mb-3 rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                  Premium demo is on for this local session. No account is signed in.
                </p>
              )}
              <form onSubmit={handleSignIn} className="space-y-3">
                <p className="text-sm font-semibold">Basic POS features work without an account. Sign in only for Premium tools and sale notifications.</p>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Owner email"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password (at least 6 characters)"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                    <LogIn className="h-4 w-4" />
                    Sign in
                  </button>
                  <button type="button" disabled={busy} onClick={handleCreateAccount} className="min-h-10 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50">
                    Create account for Premium
                  </button>
                </div>
              </form>
              </>
            )}
          </section>

          <section className={`rounded-2xl border border-border p-4 ${hasPremium ? '' : 'opacity-70'}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">VAT settings</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {hasPremium
                    ? 'VAT is only applied when you enable it.'
                    : 'VAT settings require an account with Premium access; basic checkout remains available.'}
                </p>
              </div>
              <button
                type="button"
                disabled={!hasPremium}
                aria-pressed={hasPremium && vatEnabled}
                onClick={() => setVatSettings({
                  enabled: !(hasPremium && vatEnabled),
                  rate: vatRate,
                  inclusive: vatInclusive,
                  country: vatCountry,
                })}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${hasPremium && vatEnabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} disabled:cursor-not-allowed`}
              >
                {hasPremium && vatEnabled ? 'Enabled' : 'Off'}
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-semibold text-muted-foreground">
                VAT jurisdiction
                <select
                  disabled={!hasPremium}
                  value={vatCountry}
                  onChange={(event) => {
                    const country = event.target.value as 'Uganda' | 'Kenya' | 'Custom';
                    setVatSettings({
                      enabled: vatEnabled,
                      rate: country === 'Uganda' ? 18 : country === 'Kenya' ? 16 : vatRate,
                      inclusive: vatInclusive,
                      country,
                    });
                  }}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                >
                  <option value="Uganda">Uganda</option>
                  <option value="Kenya">Kenya</option>
                  <option value="Custom">Custom</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-muted-foreground">
                Tax rate (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  disabled={!hasPremium}
                  value={vatRate}
                  onChange={(event) => setVatSettings({
                    enabled: vatEnabled,
                    rate: Number(event.target.value),
                    inclusive: vatInclusive,
                    country: vatCountry,
                  })}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                />
              </label>
              <label className="text-xs font-semibold text-muted-foreground">
                Price treatment
                <select
                  disabled={!hasPremium}
                  value={vatInclusive ? 'inclusive' : 'exclusive'}
                  onChange={(event) => setVatSettings({
                    enabled: vatEnabled,
                    rate: vatRate,
                    inclusive: event.target.value === 'inclusive',
                    country: vatCountry,
                  })}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                >
                  <option value="exclusive">Add VAT at checkout</option>
                  <option value="inclusive">Prices include VAT</option>
                </select>
              </label>
            </div>
            {!hasPremium && <p className="mt-3 text-xs text-muted-foreground">Activate Premium to use VAT.</p>}
          </section>
        </div>
      </section>
    </div>
  );
}
