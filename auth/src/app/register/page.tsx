"use client";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWandMagicSparkles, faKey, faEye, faEyeSlash, faIdBadge, faPhone, faUser, faAt, faLocationDot } from "@fortawesome/free-solid-svg-icons";
import { parsePhoneNumberFromString, AsYouType } from "libphonenumber-js";

// AES-GCM encryption helpers
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

if (typeof window !== "undefined") {
  // @ts-expect-error: window.TRUSTED_DOMAINS is a custom global for trusted redirect logic
  window.TRUSTED_DOMAINS = window.TRUSTED_DOMAINS || ["chittersync.com"];
}

function isTrustedRedirect(url: string, allowedDomains?: string[]) {
  // Replace 'any' with 'unknown' and add type guard if needed
  const domains = allowedDomains || (typeof window !== "undefined" ? (window as unknown as { TRUSTED_DOMAINS: string[] }).TRUSTED_DOMAINS : ["chittersync.com"]);
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin === window.location.origin) return true;
    return domains.some((domain: string) => {
      const host = parsed.hostname;
      return host === domain || host.endsWith(`.${domain}`);
    });
  } catch {
    return false;
  }
}

// Username generator helper
function generateUsername() {
  const adjectives = [
    "Swift", "Silent", "Brave", "Lucky", "Clever", "Mighty", "Cosmic", "Fuzzy", "Chill", "Sunny",
    "Bold", "Radiant", "Nimble", "Vivid", "Lively", "Daring", "Epic", "Glowing", "Jolly", "Witty",
    "Frosty", "Blazing", "Shadowy", "Electric", "Golden", "Crimson", "Azure", "Emerald", "Sable", "Ivory",
    "Gentle", "Wild", "Rapid", "Stealthy", "Vast", "Tiny", "Grand", "Shiny", "Dreamy", "Mystic",
    "Serene", "Whimsical", "Radiant", "Harmonious", "Ethereal", "Celestial", "Luminous", "Velvet", "Amber", "Cobalt"
  ];
  const nouns = [
    "Falcon", "Otter", "Tiger", "Pixel", "Nova", "Shadow", "Blossom", "Echo", "Comet", "Panda",
    "Wolf", "Phoenix", "Dragon", "Orchid", "Quartz", "Raven", "Sparrow", "Maple", "Cedar", "Lotus",
    "Vortex", "Nimbus", "Coyote", "Lynx", "Moss", "Breeze", "Dune", "Coral", "Fawn", "Slate",
    "Hawk", "Fox", "Bear", "Moth", "Ivy", "Fern", "Wisp", "Flame", "Gale", "Frost",
    "Zephyr", "Echo", "Quartz", "Sapphire", "Jade", "Onyx", "Opal", "Ruby", "Topaz", "Zinnia"
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(100 + Math.random() * 900); // 3-digit number
  return `${adj}${noun}${num}`;
}

// Password generator helper
function generatePassword(length = 14) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
  let password = "";
  const array = new Uint32Array(length);
  window.crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}

// Login ID generator helper
function generateLoginId() {
  // Example: 8-char alphanumeric, like a user code
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  const array = new Uint32Array(8);
  window.crypto.getRandomValues(array);
  for (let i = 0; i < 8; i++) {
    id += chars[array[i] % chars.length];
  }
  return id;
}

// Strength meter helpers
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (password.length >= 14) score++;
  const labels = ["Very Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"];
  const colors = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-lime-400", "bg-green-500", "bg-emerald-600"];
  const clampedScore = Math.min(score, labels.length - 1);
  return {
    score,
    label: labels[clampedScore],
    color: colors[clampedScore]
  };
}

function getLoginIdStrength(loginId: string): { score: number; label: string; color: string } {
  let score = 0;
  if (loginId.length >= 6) score++;
  if (/[A-Z]/.test(loginId)) score++;
  if (/[a-z]/.test(loginId)) score++;
  if (/[0-9]/.test(loginId)) score++;
  if (/[^A-Za-z0-9]/.test(loginId)) score++;
  if (loginId.length >= 10) score++;
  const labels = ["Very Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"];
  const colors = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-lime-400", "bg-green-500", "bg-emerald-600"];
  const clampedScore = Math.min(score, labels.length - 1);
  return {
    score,
    label: labels[clampedScore],
    color: colors[clampedScore]
  };
}

// Helper: get flag emoji from country code
function getFlagEmoji(countryCode: string) {
  if (!countryCode) return "";
  // Only allow A-Z
  return countryCode
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("")
    .map(char => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}
// Helper: get email provider icon (SVG or emoji fallback)
function getEmailProviderIcon(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (domain.includes("gmail")) return "📧"; // Replace with SVG if desired
  if (domain.includes("yahoo")) return "🟪";
  if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live")) return "🟦";
  if (domain.includes("icloud")) return "☁️";
  if (domain.includes("proton")) return "🟩";
  if (domain.includes("aol")) return "🅰️";
  if (domain.includes("edu")) return "🎓";
  return "✉️";
}
// Helper: get SVG icon URL for email provider (customized for Google, Windows, Yahoo)
function getEmailProviderSvg(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (domain.includes("gmail") || domain.includes("googlemail"))
    return "https://raw.githubusercontent.com/ChitterSync/ResourceRepo/c5dfd7181d79387ba2ebc392121ac49442d55b79/Icons/SVGREPO/collections/logo/social-and-company-colored-logo-icons/google-color-svgrepo-com.svg";
  if (
    domain.includes("outlook") ||
    domain.includes("hotmail") ||
    domain.includes("live") ||
    domain.includes("aol")
  )
    return "https://raw.githubusercontent.com/ChitterSync/ResourceRepo/c5dfd7181d79387ba2ebc392121ac49442d55b79/Icons/SVGREPO/collections/logo/social-and-company-colored-logo-icons/windowsphone-color-svgrepo-com.svg";
  if (domain.includes("yahoo"))
    return null; // Will use inline SVG below
  if (domain.includes("icloud"))
    return "https://raw.githubusercontent.com/chittersync/resourcerepo/main/email/icloud.svg";
  if (domain.includes("proton"))
    return "https://raw.githubusercontent.com/chittersync/resourcerepo/main/email/protonmail.svg";
  if (domain.includes("edu"))
    return "https://raw.githubusercontent.com/chittersync/resourcerepo/main/email/edu.svg";
  return null;
}
// Helper: get country flag from location string (basic, by country name)
function getCountryFlagFromLocation(location: string) {
  const countries: Record<string, string> = {
    "united states": "US",
    "canada": "CA",
    "united kingdom": "GB",
    "germany": "DE",
    "france": "FR",
    "india": "IN",
    "australia": "AU",
    "japan": "JP",
    "china": "CN",
    "brazil": "BR",
    "mexico": "MX",
    // ...add more as needed
  };
  const key = location.trim().toLowerCase();
  const code = countries[key];
  return code ? getFlagEmoji(code) : "";
}

// Helper: get SVG flag URL for country code
function getFlagSvg(countryCode: string) {
  if (!countryCode) return null;
  return `https://raw.githubusercontent.com/chittersync/resourcerepo/main/flags/${countryCode.toUpperCase()}.svg`;
}

// Helper: format phone number as user types
function formatPhoneNumberInput(input: string) {
  try {
    return new AsYouType().input(input);
  } catch {
    return input;
  }
}

export default function Register() {
  const [showDisplayNameModal, setShowDisplayNameModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<null | (() => void)>(null);
  const [form, setForm] = useState({
    loginId: "",
    password: "",
    email: [""],
    phone: [""],
    username: "",
    name: "",
    gender: "",
    dob: "",
    location: [""],
    tosAgreement: false,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Tooltip state for redirect info
  const [showRedirectTooltip, setShowRedirectTooltip] = useState(false);
  const [redirectTooltipTimeout, setRedirectTooltipTimeout] = useState<NodeJS.Timeout | null>(null);

  // Helper to update dynamic fields
  const handleDynamicChange = (type: "email" | "phone" | "location", idx: number, value: string) => {
    setForm((prev) => {
      const arr = [...(prev[type] as string[])];
      arr[idx] = value;
      return { ...prev, [type]: arr };
    });
  };
  const handleAddField = (type: "email" | "phone" | "location") => {
    setForm((prev) => ({ ...prev, [type]: [...(prev[type] as string[]), ""] }));
  };
  const handleRemoveField = (type: "email" | "phone" | "location", idx: number) => {
    setForm((prev) => {
      const arr = [...(prev[type] as string[])];
      arr.splice(idx, 1);
      return { ...prev, [type]: arr.length ? arr : [""] };
    });
  };

  // Validation for required: at least one of email or phone
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isEmailFilled = form.email.some((e) => e.trim() !== "");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isPhoneFilled = form.phone.some((p) => p.trim() !== "");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const { name, value, type } = target;
    const checked = (type === "checkbox") ? (target as HTMLInputElement).checked : undefined;
    setForm((prev) => ({
      ...prev,
      [name === "ToS Agreement" ? "tosAgreement" : name.toLowerCase().replace(/ /g,"")]: type === "checkbox" ? checked : value,
    }));
  };

  // Add username generator handler
  const handleGenerateUsername = () => {
    setForm((prev) => ({ ...prev, username: generateUsername() }));
  };

  // Add password generator handler
  const handleGeneratePassword = () => {
    setForm((prev) => ({ ...prev, password: generatePassword() }));
  };

  // Add loginId generator handler
  const handleGenerateLoginId = () => {
    setForm((prev) => ({ ...prev, loginId: generateLoginId() }));
  };

  // Intercept submit to show display name modal if not set
  const handleCreateAccountClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setShowDisplayNameModal(true);
      setPendingSubmit(() => () => handleSubmit(e));
      return;
    }
    handleSubmit(e);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.tosAgreement) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }
    // Generate a UUID for the new user (for client reference only)
    const userId = uuidv4();
    // Encrypt the password before sending (using a static key for demo; use a secure key exchange in production)
    const key = await getAesKey("your-strong-shared-secret");
    const encryptedPassword = await encryptPassword(form.password, key);
    // Prepare payload
    const payload = {
      ...form,
      password: encryptedPassword,
      userId,
    };
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Registration failed.");
        return;
      }
      // Success: redirect
      const params = new URLSearchParams(window.location.search);
      const redirectUrl = params.get("redirect");
      let finalUrl = "/home";
      if (redirectUrl && isTrustedRedirect(redirectUrl)) {
        finalUrl = redirectUrl;
      }
      window.location.href = finalUrl;
      setSuccess("Registration successful! You can now sign in.");
    } catch {
      setError("Registration failed. Please try again.");
    }
  };

  const passwordStrength = getPasswordStrength(form.password);
  const loginIdStrength = getLoginIdStrength(form.loginId);

  // Get redirect URL from query string (or default to /home)
  let redirectUrl = "/home";
  let willRedirect = false;
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const url = params.get("redirect");
    if (url && isTrustedRedirect(url)) {
      redirectUrl = url;
      willRedirect = url !== "/home";
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-gray-500 font-[Jost,sans-serif] p-4 select-none"
      style={{ userSelect: 'none' }}
      onMouseDown={e => {
        // Allow selection only for textboxes, textareas, and selects
        const tag = (e.target as HTMLElement).tagName;
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
          e.preventDefault();
        }
      }}
    >
      {/* Display Name Modal */}
      {showDisplayNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full text-gray-900 flex flex-col items-center">
            <h2 className="text-xl font-bold mb-4">Choose a Display Name</h2>
            <input
              type="text"
              className="w-full p-3 rounded-lg border border-gray-300 mb-4"
              placeholder="Display Name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus
            />
            <div className="flex gap-2 w-full relative">
              <div className="flex-1 relative">
                <button
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg"
                  onClick={() => {
                    setShowDisplayNameModal(false);
                    if (pendingSubmit) pendingSubmit();
                  }}
                  onMouseEnter={() => {
                    if (willRedirect) {
                      const timeout = setTimeout(() => setShowRedirectTooltip(true), 2500);
                      setRedirectTooltipTimeout(timeout);
                    }
                  }}
                  onMouseLeave={() => {
                    if (redirectTooltipTimeout) clearTimeout(redirectTooltipTimeout);
                    setShowRedirectTooltip(false);
                  }}
                  aria-label={willRedirect ? `Continue and redirect to ${redirectUrl}` : 'Continue'}
                >Continue{willRedirect ? ` to ${redirectUrl}` : ''}</button>
                {/* Tooltip for redirect info, absolutely positioned below the button, not as a child of the button */}
                {willRedirect && showRedirectTooltip && (
                  <div className="absolute left-1/2 -translate-x-1/2 mt-2 z-50" style={{top: '100%'}}>
                    <div className="relative flex flex-col items-center">
                      <div className="bg-gray-900 text-white text-xs rounded shadow-lg px-3 py-2 animate-fade-in" style={{minWidth:200, textAlign:'center'}}>
                        You will be redirected to:<br />
                        <span className="break-all font-mono">{redirectUrl}</span>
                      </div>
                      <div className="w-3 h-3 bg-gray-900 rotate-45 mt-[-6px]" style={{marginTop: '-6px'}}></div>
                    </div>
                  </div>
                )}
              </div>
              <button
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 rounded-lg"
                onClick={() => setShowDisplayNameModal(false)}
              >Skip</button>
            </div>
            <h6 className="text-sm text-gray-500 mt-4 text-center">
              You can change this later in your profile settings at any time. If you skip this, it will use your username instead. after this section you will gain instant access to ChitterSync Basic Subscription Permanently.
            </h6>
          </div>
        </div>
      )}
      <div className="main w-full max-w-md bg-white/10 p-8 rounded-xl shadow-lg backdrop-blur text-white flex flex-col relative" style={{height: '90vh', minHeight: 400}}>
        <form id="signup-form" className="flex flex-col gap-4 flex-1 overflow-y-auto pr-2" onSubmit={handleCreateAccountClick} autoComplete="off" style={{paddingBottom: 180}}>
          <h1 className="text-center text-3xl font-bold mb-6">Sign Up</h1>
          {error && <div className="text-red-400 text-center mb-2">{error}</div>}
          {success && <div className="text-green-400 text-center mb-2">{success}</div>}
          {/* Username field */}
          <div>
            <label htmlFor="username" className="block text-lg font-semibold mb-2">Username</label>
            <div className="relative flex gap-2 items-center">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <FontAwesomeIcon icon={faAt} />
              </span>
              <input
                type="text"
                id="username"
                name="username"
                placeholder="Username"
                required
                autoComplete="username"
                aria-label="Username"
                className="w-full p-3 pl-10 rounded-lg border border-gray-300 text-gray-900 bg-white mb-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
                value={form.username}
                onChange={handleChange}
              />
              <button
                type="button"
                onClick={handleGenerateUsername}
                className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded mb-2 flex items-center justify-center"
                aria-label="Generate username"
              >
                <FontAwesomeIcon icon={faWandMagicSparkles} />
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="login-id" className="block text-lg font-semibold mb-2">Login ID</label>
            <div className="relative flex gap-2 items-center">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <FontAwesomeIcon icon={faIdBadge} />
              </span>
              {/* Accessibility: add aria-labels and autoComplete for loginId */}
              <input
                type="text"
                id="login-id"
                name="loginId"
                placeholder="Login ID"
                required
                autoComplete="off"
                aria-label="Login ID"
                className="w-full p-3 pl-10 rounded-lg border border-gray-300 text-gray-900 bg-white mb-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
                value={form.loginId}
                onChange={e => setForm(prev => ({ ...prev, loginId: e.target.value }))}
                />
              <button
                type="button"
                onClick={handleGenerateLoginId}
                className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded mb-2 flex items-center justify-center"
                aria-label="Generate login ID"
              >
                <FontAwesomeIcon icon={faIdBadge} />
              </button>
            </div>
            <div className="w-full h-2 rounded mb-1">
              <div
                className={`h-2 rounded transition-all duration-300 ${loginIdStrength.color}`}
                style={{
                  width: `${Math.min((loginIdStrength.score + 1) * 16.6, 100)}%` // Clamp to 100%
                }}
              />
            </div>
            <div className="text-xs text-gray-200 mb-2">
              {loginIdStrength.label}
            </div>
          </div>
          <div>
            <label htmlFor="password" className="block text-lg font-semibold mb-2">Password</label>
            <div className="flex gap-2 items-center">
              {/* Accessibility: add aria-label for password */}
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                placeholder="Password"
                required
                autoComplete="new-password"
                aria-label="Password"
                className="w-full p-3 pl-10 rounded-lg border border-gray-300 text-gray-900 bg-white mb-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
                value={form.password}
                onChange={handleChange}
              />
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded mb-2 flex items-center justify-center"
                aria-label="Generate password"
              >
                <FontAwesomeIcon icon={faKey} />
              </button>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-3 rounded mb-2 flex items-center justify-center"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={0}
              >
                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
              </button>
            </div>
            <div className="w-full h-2 rounded mb-1">
              <div
                className={`h-2 rounded transition-all duration-300 ${passwordStrength.color}`}
                style={{
                  width: `${Math.min((passwordStrength.score + 1) * 16.6, 100)}%` // Clamp to 100%
                }}
              />
            </div>
            <div className="text-xs text-gray-200 mb-2">
              {passwordStrength.label}
            </div>
          </div>
          {/* Dynamic Email Inputs */}
          <div>
            <label className="block text-lg font-semibold mb-2">Email</label>
            {form.email.map((email, idx) => {
              const svg = getEmailProviderSvg(email);
              const domain = email.split("@")[1]?.toLowerCase() || "";
              return (
                <div className="relative flex gap-2 items-center mb-2" key={idx}>
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg w-6 h-6 flex items-center justify-center">
                    {svg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={svg} alt="provider" className="w-5 h-5 object-contain" />
                    ) : domain.includes("yahoo") ? (
                      <span className="w-5 h-5 flex items-center justify-center" title="Yahoo!">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwJSI+PHBhdGggZD0iTTIzMy4yIDQ0Mi4yYzAtMTQuMy0xMC4yLTQ0LjYtMjMuMy00NC42Yy0xMy4yIDAtMjMuMyA0My4yLTQ0LjYgNDQuM2MtMTQuMyAwLTQ0LjYgMjMuMy00NC42IDQ0LjZjMTMuMiAwIDI0LjYtMTAuMiA0NC42LTI0LjZjMTQuMyAwIDM0LjYgMTMuMiA0NC42IDI0LjZjMTQuMyAwIDM0LjYtMTAuMiA0NC42LTI0LjZ6IiBmaWxsPSIjNjAwMWQyIiBvcGFjaXR5PSIuNzU3NTciLz48L3N2Zz4=" alt="Yahoo!" className="w-5 h-5 object-contain" />
                      </span>
                    ) : (
                      getEmailProviderIcon(email)
                    )}
                  </span>
                  {/* Accessibility: add aria-label for email */}
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    autoComplete="email"
                    aria-label="Email"
                    className="w-full p-3 pl-10 rounded-lg border border-gray-300 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    value={email}
                    onChange={e => handleDynamicChange("email", idx, e.target.value)}
                    required={form.email.filter(e => e.trim()).length === 0 && form.phone.filter(p => p.trim()).length === 0 && idx === 0}
                  />
                  {form.email.length > 1 && (
                    <button type="button" className="text-red-500 ml-1" onClick={() => handleRemoveField("email", idx)} tabIndex={0}>&times;</button>
                  )}
                  {idx === form.email.length - 1 && (
                    <button type="button" className="text-green-500 ml-1" onClick={() => handleAddField("email") } tabIndex={0}>+</button>
                  )}
                </div>
              );
            })}
          </div>
          {/* Dynamic Phone Inputs */}
          <div>
            <label className="block text-lg font-semibold mb-2">Phone Number</label>
            {form.phone.map((phone, idx) => {
              let flag = "";
              let flagSvg = null;
              try {
                const parsed = parsePhoneNumberFromString(phone || "");
                flag = parsed && parsed.country ? getFlagEmoji(parsed.country) : "";
                flagSvg = parsed && parsed.country ? getFlagSvg(parsed.country) : null;
              } catch {}
              return (
                <div className="relative flex gap-2 items-center mb-2" key={idx}>
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg min-w-[1.5em] text-center">
                    {flagSvg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={flagSvg} alt="flag" className="w-5 h-5 object-contain" />
                    ) : (flag || <FontAwesomeIcon icon={faPhone} />)}
                  </span>
                  {/* Accessibility: add aria-label for phone number */}
                  <input
                    type="text"
                    name="phone"
                    placeholder="Phone Number"
                    autoComplete="tel"
                    aria-label="Phone Number"
                    className="w-full p-3 pl-10 rounded-lg border border-gray-300 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    value={phone}
                    onChange={e => handleDynamicChange("phone", idx, formatPhoneNumberInput(e.target.value))}
                    required={form.phone.filter(p => p.trim()).length === 0 && form.email.filter(e => e.trim()).length === 0 && idx === 0}
                  />
                  {form.phone.length > 1 && (
                    <button type="button" className="text-red-500 ml-1" onClick={() => handleRemoveField("phone", idx)} tabIndex={0}>&times;</button>
                  )}
                  {idx === form.phone.length - 1 && (
                    <button type="button" className="text-green-500 ml-1" onClick={() => handleAddField("phone") } tabIndex={0}>+</button>
                  )}
                </div>
              );
            })}
          </div>
          {/* Dynamic Location Inputs */}
          <div>
            <label className="block text-lg font-semibold mb-2">Location (optional)</label>
            {form.location.map((loc, idx) => {
              const flag = getCountryFlagFromLocation(loc);
              const flagSvg = getFlagSvg(flag);
              return (
                <div className="relative flex gap-2 items-center mb-2" key={idx}>
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                    {flagSvg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={flagSvg} alt="flag" className="w-5 h-5 object-contain" />
                    ) : (flag || <FontAwesomeIcon icon={faLocationDot} />)}
                  </span>
                  {/* Accessibility: add aria-label for location */}
                  <input
                    type="text"
                    name="location"
                    placeholder="Location"
                    aria-label="Location"
                    className="w-full p-3 pl-10 rounded-lg border border-gray-300 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    value={loc}
                    onChange={e => handleDynamicChange("location", idx, e.target.value)}
                    />
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="tos-agreement"
                name="ToS Agreement"
                className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-400"
                checked={form.tosAgreement}
                onChange={handleChange}
                aria-label="I agree to the Terms of Service and Privacy Policy"
              />
              <label htmlFor="tos-agreement" className="ml-2 text-sm text-gray-300 cursor-pointer">
                I agree to the{" "}
                <a href="/tos" className="text-purple-400 hover:underline" target="_blank" rel="noreferrer">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" className="text-purple-400 hover:underline" target="_blank" rel="noreferrer">
                  Privacy Policy
                </a>
              </label>
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 flex items-center justify-center"
            aria-label="Create account"
          >
            <FontAwesomeIcon icon={faUser} className="mr-2" />
            Create Account
          </button>
          <div className="mt-4 text-center text-sm text-gray-400">
            Already have an account?{" "}
            <a href="/login" className="text-purple-400 hover:underline">
              Sign in
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
