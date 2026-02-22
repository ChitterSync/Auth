"use client";

import { useState, useEffect } from "react";

if (typeof window !== "undefined") {
  window.TRUSTED_DOMAINS = window.TRUSTED_DOMAINS || ["chittersync.com"];
}

// Helper to validate redirect URLs
function isTrustedRedirect(url: string, allowedDomains?: string[]) {
  const domains = allowedDomains || (typeof window !== "undefined" ? (window as unknown as { TRUSTED_DOMAINS: string[] }).TRUSTED_DOMAINS : ["chittersync.com", "github.dev"]);
  try {
    const parsed = new URL(url, window.location.origin);
    // Allow relative URLs
    if (parsed.origin === window.location.origin) return true;
    // Allow any subdomain of allowed domains
    return domains.some((domain: string) => {
      const host = parsed.hostname;
      return host === domain || host.endsWith(`.${domain}`);
    });
  } catch {
    return false;
  }
}

function isEmbeddedAuthContext() {
  if (typeof window === "undefined") return false;
  return Boolean(window.opener) || window.parent !== window;
}

function resolvePostMessageOrigin(targetUrl: string) {
  try {
    const origin = new URL(targetUrl, window.location.origin).origin;
    return isTrustedRedirect(origin) ? origin : window.location.origin;
  } catch {
    return window.location.origin;
  }
}

function postAuthMessage(payload: Record<string, unknown>, targetOrigin: string) {
  if (typeof window === "undefined") return;
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, targetOrigin);
    }
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(payload, targetOrigin);
    }
  } catch {
    // best-effort messaging only
  }
}

function closeIfPopup() {
  if (typeof window === "undefined") return;
  if (window.opener && !window.opener.closed) {
    window.close();
  }
}

type StoredAccount = {
  id: string;
  loginId: string;
  username?: string;
  displayName?: string;
  lastUsedAt: number;
};

const ACCOUNT_STORAGE_KEY = "chittersync:auth:accounts";

function readStoredAccounts(): StoredAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && (typeof item.loginId === "string" || typeof item.label === "string"))
      .map((item) => {
        const legacyLogin = typeof item.label === "string" ? item.label : "";
        const loginId = typeof item.loginId === "string" ? item.loginId : legacyLogin;
        return {
          id: typeof item.id === "string" ? item.id : loginId,
          loginId,
          username: typeof item.username === "string" ? item.username : undefined,
          displayName: typeof item.displayName === "string" ? item.displayName : undefined,
          lastUsedAt: typeof item.lastUsedAt === "number" ? item.lastUsedAt : 0,
        };
      })
      .filter((item) => Boolean(item.loginId))
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  } catch {
    return [];
  }
}

function writeStoredAccounts(accounts: StoredAccount[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // ignore storage errors
  }
}

function upsertStoredAccount(input: {
  loginId: string;
  username?: string | null;
  displayName?: string | null;
}) {
  if (typeof window === "undefined") return [];
  const trimmed = input.loginId.trim();
  if (!trimmed) return [];
  const accounts = readStoredAccounts();
  const now = Date.now();
  const existing = accounts.find((acc) => acc.loginId === trimmed);
  if (existing) {
    existing.lastUsedAt = now;
    existing.username = input.username || existing.username;
    existing.displayName = input.displayName || existing.displayName;
  } else {
    accounts.push({
      id: trimmed,
      loginId: trimmed,
      username: input.username || undefined,
      displayName: input.displayName || undefined,
      lastUsedAt: now,
    });
  }
  const next = accounts.sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, 12);
  writeStoredAccounts(next);
  return next;
}

function removeStoredAccount(id: string) {
  const next = readStoredAccounts().filter((acc) => acc.id !== id);
  writeStoredAccounts(next);
  return next;
}

async function storeAccountFromSession(loginId: string) {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const data: any = await res.json().catch(() => ({}));
    if (data?.authenticated && data.user) {
      return upsertStoredAccount({
        loginId,
        username: data.user.username,
        displayName: data.user.displayName || data.user.username,
      });
    }
  } catch {
    // ignore lookup errors
  }
  return upsertStoredAccount({ loginId });
}

export default function SignIn() {
  const defaultHome =
    process.env.NEXT_PUBLIC_CHITTERSYNC_HOME_URL || "https://chittersync.com/home";
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showFailBar, setShowFailBar] = useState(false);
  const [failBarAttempts, setFailBarAttempts] = useState<number | null>(null);
  const [redirectMessage, setRedirectMessage] = useState("");
  const [showLogout, setShowLogout] = useState(false);
  const [attempts, setAttempts] = useState<number | null>(null);
  const [storedAccounts, setStoredAccounts] = useState<StoredAccount[]>([]);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    accountId: string | null;
  }>({ open: false, x: 0, y: 0, accountId: null });
  const showForm = !showAccountSwitcher;

  useEffect(() => {
    // Show logout notification if ?loggedOut=true
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("loggedOut") === "true") {
        setShowLogout(true);
        setTimeout(() => setShowLogout(false), 5000);
      }
      const redirectUrl = params.get("redirect");
      if (redirectUrl) setRedirectMessage(`You will be redirected to: ${redirectUrl}`);
    }
    // Keyboard events for Control key
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Control") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("redirect")) setRedirectMessage("Hold Control: Continue & Ignore URL Redirect");
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Control") {
        const params = new URLSearchParams(window.location.search);
        const redirectUrl = params.get("redirect");
        setRedirectMessage(redirectUrl ? `You will be redirected to: ${redirectUrl}` : "");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const accounts = readStoredAccounts();
    setStoredAccounts(accounts);
    setShowAccountSwitcher(accounts.length > 0);
  }, []);

  useEffect(() => {
    if (!contextMenu.open) return;
    const handleClick = () => setContextMenu({ open: false, x: 0, y: 0, accountId: null });
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu({ open: false, x: 0, y: 0, accountId: null });
      }
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("contextmenu", handleClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("contextmenu", handleClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu.open]);

  const handleAccountSelect = (account: StoredAccount) => {
    setLoginId(account.loginId);
    setShowAccountSwitcher(false);
  };

  const handleAccountContextMenu = (event: React.MouseEvent, accountId: string) => {
    event.preventDefault();
    setContextMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      accountId,
    });
  };

  const handleAccountSignOut = async () => {
    if (!contextMenu.accountId) return;
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore logout errors
    }
    const next = removeStoredAccount(contextMenu.accountId);
    setStoredAccounts(next);
    setShowAccountSwitcher(next.length > 0);
    setContextMenu({ open: false, x: 0, y: 0, accountId: null });
  };

  const handleAccountRemove = () => {
    if (!contextMenu.accountId) return;
    const next = removeStoredAccount(contextMenu.accountId);
    setStoredAccounts(next);
    setShowAccountSwitcher(next.length > 0);
    setContextMenu({ open: false, x: 0, y: 0, accountId: null });
  };

  // Fetch last 7 failed login attempts for this loginId or IP
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/login-logs?n=20", {
          headers: { "x-admin-device": "master" },
        });
        if (res.ok) {
          const data: any = await res.json();
          let count = 0;
          if (data.logs && Array.isArray(data.logs)) {
            // Try to filter by loginId if entered, else by IP if available
            let filtered = data.logs.filter((log: any) => log.success === false);
            if (loginId) {
              filtered = filtered.filter((log: any) => log.loginId === loginId);
            } else if (typeof window !== 'undefined' && (window as any).ip) {
              filtered = filtered.filter((log: any) => log.ip === (window as any).ip);
            }
            count = filtered.length > 7 ? 7 : filtered.length;
          }
          setAttempts(count);
        }
      } catch {}
    })();
  }, [loginId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: loginId, password }),
      });
      if (!res.ok) {
        const data: any = await res.json().catch(() => ({}));
        setError(data.error || "Invalid Login ID or Password.");
        setFailBarAttempts(attempts);
        setShowFailBar(true);
        setTimeout(() => setShowFailBar(false), 3500);
        return;
      }
      const data: any = await res.json().catch(() => ({}));

      const params = new URLSearchParams(window.location.search);
      const redirectUrl = params.get("redirect");
      let finalUrl = defaultHome;
      if (redirectUrl && isTrustedRedirect(redirectUrl)) {
        finalUrl = redirectUrl;
      }
      if ((window.event as KeyboardEvent)?.ctrlKey && redirectUrl) {
        finalUrl = defaultHome;
      }

      await storeAccountFromSession(loginId);
      if (isEmbeddedAuthContext()) {
        postAuthMessage(
          {
            type: "chittersync:auth",
            action: "login",
            userId: data.userId || null,
            redirectUrl: finalUrl,
            timestamp: new Date().toISOString(),
          },
          resolvePostMessageOrigin(finalUrl),
        );
        closeIfPopup();
        return;
      }

      setStoredAccounts(readStoredAccounts());
      window.location.href = finalUrl;
    } catch {
      setError("An error occurred. Please try again.");
      setFailBarAttempts(attempts);
      setShowFailBar(true);
      setTimeout(() => setShowFailBar(false), 3500);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-gray-500 font-[Jost,sans-serif] p-4">
      <div className="main w-full max-w-md bg-white/10 p-8 rounded-xl shadow-lg backdrop-blur text-white relative">
        {showAccountSwitcher && (
          <div className="mb-6 bg-black/40 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Choose an account</h2>
              <button
                type="button"
                className="text-xs text-gray-300 underline"
                onClick={() => setShowAccountSwitcher(false)}
              >
                Use another account
              </button>
            </div>
            <div className="space-y-2">
              {storedAccounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => handleAccountSelect(account)}
                  onContextMenu={(event) => handleAccountContextMenu(event, account.id)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <div className="font-semibold">
                    {account.displayName || account.username || account.loginId}
                  </div>
                  <div className="text-xs text-gray-300">
                    {account.username ? `@${account.username}` : account.loginId}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {showLogout && (
          <div className="mb-4 bg-green-100 text-green-800 p-2 rounded text-center border border-green-200">
            You have successfully logged out.
          </div>
        )}
        <h1 className="text-center text-3xl font-bold mb-6">Sign In</h1>
        {showForm && attempts !== null && (
          <div className="mb-2 text-center text-sm text-gray-200">
            Failed Attempts: {attempts}/7
          </div>
        )}
        {/* Notification bar for failed attempts */}
        {showForm && showFailBar && (
          <div className="absolute left-0 right-0 mx-auto mt-2 z-20 flex justify-center" style={{ top: '100%' }}>
            <div className="bg-red-500 text-white px-4 py-2 rounded shadow-lg border border-red-700 animate-fade-in-out">
              {failBarAttempts !== null ? `Failed Attempts: ${failBarAttempts}/7` : "Login failed."}
            </div>
          </div>
        )}
        {showForm && (
        <form id="signin-form" className="flex flex-col gap-4" onSubmit={handleSubmit} autoComplete="off">
          {error && <div className="form__message form__message--error text-red-400 text-center">{error}</div>}
          <div>
            <label htmlFor="login-id" className="block text-lg font-semibold mb-2">Login ID</label>
            <input
              type="text"
              id="login-id"
              name="Login ID"
              placeholder="Login ID"
              required
              className="w-full p-3 rounded-lg border border-gray-300 text-gray-900 bg-white mb-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
              value={loginId}
              onChange={e => setLoginId(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-lg font-semibold mb-2">Password</label>
            <input
              type="password"
              id="password"
              name="Password"
              placeholder="Password"
              required
              className="w-full p-3 rounded-lg border border-gray-300 text-gray-900 bg-white mb-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            id="loginButton"
            className="bg-[#573b8a] hover:bg-[#6d44b8] text-white font-bold py-3 rounded-lg transition-colors relative"
          >
            Login
            <span className="tooltip absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-800 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 pointer-events-none">
              You will be redirected to your dashboard
            </span>
          </button>
          <p id="redirectMessage" className="text-center text-gray-200 text-sm min-h-[1.5em]">{redirectMessage}</p>
          {/* eslint-disable-next-line react/no-unescaped-entities */}
          <p className="text-center text-gray-300 text-sm">
            Don&apos;t have an account?&nbsp;
            <a href="/register" className="underline hover:text-white">Register here</a>
          </p>
        </form>
        )}
      </div>
      {contextMenu.open && (
        <div
          className="fixed z-[9999] bg-gray-900 text-white text-sm rounded-md shadow-xl border border-white/10 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            className="w-full text-left px-3 py-2 hover:bg-white/10"
            onClick={handleAccountSignOut}
          >
            Sign out
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-2 hover:bg-white/10"
            onClick={handleAccountRemove}
          >
            Remove from list
          </button>
        </div>
      )}
    </div>
  );
}
