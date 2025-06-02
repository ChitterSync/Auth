"use client";

import { useState, useEffect } from "react";

if (typeof window !== "undefined") {
  // @ts-expect-error: window.TRUSTED_DOMAINS is a custom global for trusted redirect logic
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

// Import getAesKey and encryptPassword from register/page if needed, or redefine here
// Copied from register/page.tsx for browser crypto compatibility
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function encryptPassword(password: string, key: CryptoKey): Promise<string> {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(password)
  );
  // Return base64(iv + ciphertext)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getAesKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest("SHA-256", enc.encode(secret)),
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
}

export default function SignIn() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [redirectMessage, setRedirectMessage] = useState("");
  const [showLogout, setShowLogout] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      // Encrypt the password before sending (using a static key for demo; use a secure key exchange in production)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const key = await getAesKey("your-strong-shared-secret");
      // Simulate API call with encrypted password
      if (loginId === "user" && password === "pass") {
        const params = new URLSearchParams(window.location.search);
        const redirectUrl = params.get("redirect");
        let finalUrl = "/home";
        if (redirectUrl && isTrustedRedirect(redirectUrl)) {
          finalUrl = redirectUrl;
        }
        if ((window.event as KeyboardEvent)?.ctrlKey && redirectUrl) {
          window.location.href = "chittersync.com/home";
        } else {
          window.location.href = finalUrl;
        }
      } else {
        setError("Invalid Login ID or Password.");
      }
    } catch {
      setError("An error occurred. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-gray-500 font-[Jost,sans-serif] p-4">
      <div className="main w-full max-w-md bg-white/10 p-8 rounded-xl shadow-lg backdrop-blur text-white">
        {showLogout && (
          <div className="mb-4 bg-green-100 text-green-800 p-2 rounded text-center border border-green-200">
            You have successfully logged out.
          </div>
        )}
        <h1 className="text-center text-3xl font-bold mb-6">Sign In</h1>
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
      </div>
    </div>
  );
}
