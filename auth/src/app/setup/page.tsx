"use client";

import { useEffect, useMemo, useState } from "react";

type SetupState = {
  profile: {
    name: string;
    bio: string;
    pronouns: string;
    location: string;
    website: string;
  };
  interests: string[];
  dataCollection: {
    analytics: boolean;
    personalized: boolean;
    marketing: boolean;
  };
};

const defaultState: SetupState = {
  profile: {
    name: "",
    bio: "",
    pronouns: "",
    location: "",
    website: "",
  },
  interests: [],
  dataCollection: {
    analytics: true,
    personalized: true,
    marketing: false,
  },
};

const isTrustedRedirect = (url: string, allowedDomains?: string[]) => {
  const domains =
    allowedDomains ||
    (typeof window !== "undefined"
      ? (window as unknown as { TRUSTED_DOMAINS: string[] }).TRUSTED_DOMAINS
      : ["chittersync.com"]);
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
};

const StepTitles = ["Profile", "Personalize", "Privacy", "Finish"];

export default function SetupPage() {
  const defaultHome =
    process.env.NEXT_PUBLIC_CHITTERSYNC_HOME_URL || "https://chittersync.com/home";
  const [state, setState] = useState<SetupState>(defaultState);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [interestInput, setInterestInput] = useState("");

  const redirectUrl = useMemo(() => {
    if (typeof window === "undefined") return defaultHome;
    const params = new URLSearchParams(window.location.search);
    const candidate = params.get("redirect");
    if (candidate && isTrustedRedirect(candidate)) return candidate;
    return defaultHome;
  }, [defaultHome]);

  const buildTutorialUrl = (baseUrl: string) => {
    try {
      const url = new URL(baseUrl);
      url.searchParams.set("tutorial", "1");
      return url.toString();
    } catch {
      return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}tutorial=1`;
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/account/setup", { cache: "no-store" });
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            profile: { ...prev.profile, ...(data.profile || {}) },
            interests: Array.isArray(data.interests) ? data.interests : prev.interests,
            dataCollection: {
              analytics: Boolean(data.dataCollection?.analytics),
              personalized: Boolean(data.dataCollection?.personalized),
              marketing: Boolean(data.dataCollection?.marketing),
            },
          }));
        }
      } catch {
        // ignore load errors
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addInterest = () => {
    const trimmed = interestInput.trim();
    if (!trimmed) return;
    setState((prev) => ({
      ...prev,
      interests: Array.from(new Set([...prev.interests, trimmed])).slice(0, 10),
    }));
    setInterestInput("");
  };

  const removeInterest = (value: string) => {
    setState((prev) => ({
      ...prev,
      interests: prev.interests.filter((item) => item !== value),
    }));
  };

  const saveSetup = async () => {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/account/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Setup failed. Try again.");
        setSaving(false);
        return;
      }
      window.location.href = buildTutorialUrl(defaultHome);
    } catch {
      setError("Setup failed. Try again.");
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-gray-500 font-[Jost,sans-serif] p-4">
      <div className="w-full max-w-2xl bg-white/10 p-8 rounded-2xl shadow-xl backdrop-blur text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Account Setup</h1>
            <p className="text-sm text-gray-200">
              Step {step + 1} of {StepTitles.length}: {StepTitles[step]}
            </p>
          </div>
          <button
            type="button"
            className="text-xs text-gray-300 underline"
            onClick={() => (window.location.href = defaultHome)}
          >
            Skip for now
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-200">Loading your setup...</div>
        ) : (
          <div className="space-y-6">
            {step === 0 && (
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Display name</label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    value={state.profile.name}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, name: e.target.value },
                      }))
                    }
                    placeholder="How should people see you?"
                    maxLength={80}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Bio</label>
                  <textarea
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    value={state.profile.bio}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, bio: e.target.value },
                      }))
                    }
                    placeholder="A short line about you"
                    maxLength={200}
                    rows={3}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Pronouns</label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                      value={state.profile.pronouns}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          profile: { ...prev.profile, pronouns: e.target.value },
                        }))
                      }
                      placeholder="they/them"
                      maxLength={32}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Location</label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                      value={state.profile.location}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          profile: { ...prev.profile, location: e.target.value },
                        }))
                      }
                      placeholder="City, Country"
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Website</label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                      value={state.profile.website}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          profile: { ...prev.profile, website: e.target.value },
                        }))
                      }
                      placeholder="https://example.com"
                      maxLength={200}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Choose interests</label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                      value={interestInput}
                      onChange={(e) => setInterestInput(e.target.value)}
                      placeholder="Add an interest (games, music, art)"
                      maxLength={24}
                    />
                    <button
                      type="button"
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 rounded-lg"
                      onClick={addInterest}
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {state.interests.map((interest) => (
                    <button
                      key={interest}
                      type="button"
                      className="bg-white/20 text-sm px-3 py-1 rounded-full"
                      onClick={() => removeInterest(interest)}
                    >
                      {interest} ✕
                    </button>
                  ))}
                  {!state.interests.length && (
                    <div className="text-sm text-gray-200">No interests added yet.</div>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-200">
                  Help us improve ChitterSync. You can change these later.
                </p>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={state.dataCollection.analytics}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        dataCollection: {
                          ...prev.dataCollection,
                          analytics: e.target.checked,
                        },
                      }))
                    }
                  />
                  <span>Share anonymous analytics to improve performance.</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={state.dataCollection.personalized}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        dataCollection: {
                          ...prev.dataCollection,
                          personalized: e.target.checked,
                        },
                      }))
                    }
                  />
                  <span>Personalize recommendations based on activity.</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={state.dataCollection.marketing}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        dataCollection: {
                          ...prev.dataCollection,
                          marketing: e.target.checked,
                        },
                      }))
                    }
                  />
                  <span>Send updates about new features (optional).</span>
                </label>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Quick tour</h2>
                <ul className="text-sm text-gray-200 space-y-2">
                  <li>• Visit Home to see your feed and recommendations.</li>
                  <li>• Use Settings to manage privacy and linked accounts.</li>
                  <li>• Add a profile photo later from your profile menu.</li>
                  <li>• Use Discover to find new communities and friends.</li>
                </ul>
                <p className="text-sm text-gray-200">
                  You can always revisit setup in Settings.
                </p>
              </div>
            )}

            {error && <div className="text-red-300 text-sm">{error}</div>}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                className="text-sm text-gray-300 underline"
                disabled={step === 0}
                onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
              >
                Back
              </button>
              {step < StepTitles.length - 1 ? (
                <button
                  type="button"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg"
                  onClick={() => setStep((prev) => Math.min(prev + 1, StepTitles.length - 1))}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg"
                  onClick={saveSetup}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Finish and continue"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
