import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { httpsCallable } from 'firebase/functions';
import { ArrowLeft, Crown, RefreshCw, ShieldCheck, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { auth, functions } from '@/lib/firebase';

interface AdminAccount {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  disabled: boolean;
  premium: boolean;
  createdAt: string;
  lastSignInAt: string | null;
}

interface DashboardResponse {
  users: AdminAccount[];
  nextPageToken: string | null;
}

interface AdminDashboardProps {
  onClose: () => void;
  onPremiumChanged: (active: boolean) => void;
}

const getAdminDashboard = httpsCallable<
  { pageToken?: string; email?: string },
  DashboardResponse
>(functions, 'getAdminDashboard');
const setPremiumAccess = httpsCallable<
  { email: string; enabled: boolean },
  { uid: string; premium: boolean }
>(functions, 'setPremiumAccess');

export default function AdminDashboard({ onClose, onPremiumChanged }: AdminDashboardProps) {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [previousPageTokens, setPreviousPageTokens] = useState<Array<string | undefined>>([]);
  const [currentPageToken, setCurrentPageToken] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const currentPage = previousPageTokens.length + 1;

  const loadPage = useCallback(async (pageToken?: string, email?: string) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const request: { pageToken?: string; email?: string } = {};
      if (pageToken) request.pageToken = pageToken;
      if (email) request.email = email;
      const { data } = await getAdminDashboard(request);
      setAccounts(data.users);
      setNextPageToken(data.nextPageToken);
      setCurrentPageToken(pageToken);
      setAppliedSearch(email || '');
    } catch (error) {
      console.error('Administrator account list could not be loaded', error);
      setErrorMessage('Could not load accounts. Check your administrator access and Firebase Functions deployment.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const handlePremiumChange = async (account: AdminAccount) => {
    if (!account.email || busyUid) return;
    setBusyUid(account.uid);
    try {
      const enabled = !account.premium;
      await setPremiumAccess({ email: account.email, enabled });
      setAccounts((current) => current.map((item) =>
        item.uid === account.uid ? { ...item, premium: enabled } : item,
      ));
      toast.success(`Premium ${enabled ? 'granted to' : 'revoked from'} ${account.email}`);
      if (auth.currentUser?.uid === account.uid) {
        try {
          await auth.currentUser.getIdToken(true);
          onPremiumChanged(enabled);
        } catch (error) {
          console.error('Premium was updated but the account token could not be refreshed', error);
          toast.error('Premium was updated. Sign in again to refresh your access.');
        }
      }
    } catch (error) {
      console.error('Administrator could not update account Premium access', error);
      toast.error('Premium access could not be updated.');
    } finally {
      setBusyUid(null);
    }
  };

  const goToNextPage = () => {
    if (!nextPageToken) return;
    setPreviousPageTokens((tokens) => [...tokens, currentPageToken]);
    void loadPage(nextPageToken);
  };

  const goToPreviousPage = () => {
    if (previousPageTokens.length === 0) return;
    const previousTokens = previousPageTokens.slice(0, -1);
    const pageToken = previousPageTokens[previousPageTokens.length - 1];
    setPreviousPageTokens(previousTokens);
    void loadPage(pageToken);
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPreviousPageTokens([]);
    void loadPage(undefined, searchEmail.trim());
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-dashboard-title"
        className="safe-bottom flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-modal sm:rounded-3xl"
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Platform controls</p>
              <h2 id="admin-dashboard-title" className="text-xl font-extrabold">Admin dashboard</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close admin dashboard" className="touch-target rounded-xl p-2 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /><span className="text-xs font-semibold">Accounts on this page</span></div>
              <p className="mt-2 text-2xl font-extrabold tabular-nums">{accounts.length}</p>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 text-muted-foreground"><Crown className="h-4 w-4" /><span className="text-xs font-semibold">Premium on this page</span></div>
              <p className="mt-2 text-2xl font-extrabold tabular-nums">{accounts.filter((account) => account.premium).length}</p>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 text-muted-foreground"><ShieldCheck className="h-4 w-4" /><span className="text-xs font-semibold">Verified on this page</span></div>
              <p className="mt-2 text-2xl font-extrabold tabular-nums">{accounts.filter((account) => account.emailVerified).length}</p>
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h3 className="font-bold">User accounts</h3>
                <p className="text-xs text-muted-foreground">Review access and manage Premium entitlements.</p>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => void loadPage(currentPageToken, appliedSearch)}
                className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <form onSubmit={handleSearch} className="flex gap-2 border-b border-border p-3">
              <input
                type="email"
                value={searchEmail}
                onChange={(event) => setSearchEmail(event.target.value)}
                placeholder="Find an account by exact email"
                aria-label="Search account by email"
                className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={loading}
                className="min-h-9 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                Search
              </button>
              {appliedSearch && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setSearchEmail('');
                    setPreviousPageTokens([]);
                    void loadPage();
                  }}
                  className="min-h-9 rounded-xl border border-border px-3 text-xs font-semibold disabled:opacity-50"
                >
                  Clear
                </button>
              )}
            </form>

            {errorMessage ? (
              <div role="alert" className="p-5 text-sm text-destructive">{errorMessage}</div>
            ) : loading ? (
              <p className="p-5 text-sm text-muted-foreground">Loading user accounts…</p>
            ) : accounts.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">No accounts found.</p>
            ) : (
              <div className="divide-y divide-border">
                {accounts.map((account) => (
                  <article key={account.uid} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{account.displayName || account.email || 'No email address'}</p>
                      {account.displayName && <p className="truncate text-xs text-muted-foreground">{account.email || 'No email address'}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {account.emailVerified ? 'Verified' : 'Unverified'}
                        {account.disabled ? ' · Disabled' : ''}
                        {' · Joined '}
                        {new Date(account.createdAt).toLocaleDateString()}
                        {' · Last active '}
                        {account.lastSignInAt
                          ? new Date(account.lastSignInAt).toLocaleDateString()
                          : 'Never'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${account.premium ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {account.premium ? 'Premium' : 'Basic'}
                      </span>
                      <button
                        type="button"
                        disabled={!account.email || account.disabled || busyUid !== null}
                        onClick={() => void handlePremiumChange(account)}
                        className="min-h-9 rounded-xl border border-border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyUid === account.uid ? 'Updating…' : account.premium ? 'Revoke Premium' : 'Grant Premium'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <footer className="flex items-center justify-between border-t border-border px-4 py-3">
              <button
                type="button"
                disabled={loading || previousPageTokens.length === 0}
                onClick={goToPreviousPage}
                className="min-h-9 rounded-xl border border-border px-3 text-xs font-semibold disabled:opacity-40"
              >
                <ArrowLeft className="mr-1 inline h-3.5 w-3.5" />Previous
              </button>
              <span className="text-xs font-semibold text-muted-foreground">Page {currentPage}</span>
              <button
                type="button"
                disabled={loading || !nextPageToken}
                onClick={goToNextPage}
                className="min-h-9 rounded-xl border border-border px-3 text-xs font-semibold disabled:opacity-40"
              >
                Next<ArrowLeft className="ml-1 inline h-3.5 w-3.5 rotate-180" />
              </button>
            </footer>
          </section>
          <p className="text-xs leading-5 text-muted-foreground">Only verified administrator emails configured in Firebase Functions can view accounts or change Premium access.</p>
        </div>
      </section>
    </div>
  );
}
