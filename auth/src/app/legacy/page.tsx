"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

declare global {
  interface Window {
    TRUSTED_DOMAINS?: string[];
  }
}

if (typeof window !== "undefined") {
  window.TRUSTED_DOMAINS = window.TRUSTED_DOMAINS || ["chittersync.com"];
}

function isTrustedRedirect(url: string, allowedDomains?: string[]) {
  const domains =
    allowedDomains ||
    (typeof window !== "undefined" ? window.TRUSTED_DOMAINS || ["chittersync.com"] : ["chittersync.com"]);
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "https://chittersync.com");
    if (typeof window !== "undefined" && parsed.origin === window.location.origin) return true;
    return domains.some((domain: string) => {
      const host = parsed.hostname;
      return host === domain || host.endsWith(`.${domain}`);
    });
  } catch {
    return false;
  }
}

type Operation = "merge" | "create";

type MergeOptionsState = {
  overwritePassword: boolean;
  copyProfileFields: boolean;
  copyContact: boolean;
  copyLocation: boolean;
  legacyDisposition: "preserve" | "archive" | "delete";
  keepLegacyLoginActive: boolean;
  note: string;
};

const toList = (value: string) =>
  value
    .split(/[\n,]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/* --------------------------------
   Tiny UI kit (friendly + obvious)
---------------------------------*/

function StepShell({
  stepLabel,
  title,
  desc,
  children,
}: {
  stepLabel: string;
  title: string;
  desc?: string;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <div className="cardHead">
        <div className="badge">{stepLabel}</div>
        <div className="headText">
          <h2>{title}</h2>
          {desc ? <p>{desc}</p> : null}
        </div>
      </div>
      <div className="cardBody">{children}</div>
    </section>
  );
}

function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "success" | "error";
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={`callout ${tone}`}>
      <div className="calloutTitle">{title}</div>
      {children ? <div className="calloutBody">{children}</div> : null}
    </div>
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return <button {...rest} className={`btn primary ${className}`} />;
}
function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return <button {...rest} className={`btn secondary ${className}`} />;
}
function GhostButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return <button {...rest} className={`btn ghost ${className}`} />;
}

function Field({
  label,
  helper,
  required,
  children,
  error,
}: {
  label: string;
  helper?: string;
  required?: boolean;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div className="field">
      <div className="fieldTop">
        <div className="fieldLabel">
          {label} {required ? <span className="req">*</span> : null}
        </div>
        {helper ? <div className="fieldHelper">{helper}</div> : null}
      </div>
      {children}
      {error ? <div className="fieldError">{error}</div> : null}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  helper,
  required,
  error,
  type = "text",
  locked,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  helper?: string;
  required?: boolean;
  error?: string;
  type?: string;
  locked?: boolean;
}) {
  const id = useMemo(() => `tf_${label.replace(/\W+/g, "_").toLowerCase()}`, [label]);
  return (
    <Field label={label} helper={helper} required={required} error={error}>
      <input
        id={id}
        className={`input ${locked ? "locked" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        readOnly={locked}
        aria-readonly={locked ? "true" : "false"}
      />
    </Field>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  helper,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  helper?: string;
  rows?: number;
}) {
  const id = useMemo(() => `ta_${label.replace(/\W+/g, "_").toLowerCase()}`, [label]);
  return (
    <Field label={label} helper={helper}>
      <textarea
        id={id}
        className="textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </Field>
  );
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  helper,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  helper?: string;
  options: { value: T; label: string }[];
}) {
  const id = useMemo(() => `sel_${label.replace(/\W+/g, "_").toLowerCase()}`, [label]);
  return (
    <Field label={label} helper={helper}>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function CheckboxRow({
  label,
  helper,
  checked,
  onChange,
  tone,
  disabled,
}: {
  label: string;
  helper?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  tone?: "normal" | "danger";
  disabled?: boolean;
}) {
  const id = useMemo(() => `cb_${label.replace(/\W+/g, "_").toLowerCase()}`, [label]);
  return (
    <label className={`checkRow ${tone === "danger" ? "danger" : ""} ${disabled ? "disabled" : ""}`} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <div className="checkText">
        <div className="checkLabel">{label}</div>
        {helper ? <div className="checkHelper">{helper}</div> : null}
      </div>
    </label>
  );
}

function ChoiceCards<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; title: string; desc: string }[];
}) {
  return (
    <div className="choiceGrid">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            className={`choiceCard ${active ? "active" : ""}`}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
          >
            <div className="choiceTitle">{opt.title}</div>
            <div className="choiceDesc">{opt.desc}</div>
          </button>
        );
      })}
    </div>
  );
}

function Progress({ step, total, titles }: { step: number; total: number; titles: string[] }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="progress">
      <div className="progressTop">
        <div>
          Step <strong>{step}</strong> of <strong>{total}</strong>
        </div>
        <div className="pct">{pct}%</div>
      </div>
      <div className="bar">
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="crumbs" aria-label="Steps">
        {titles.map((t, i) => {
          const s = i + 1;
          const cls = s === step ? "active" : s < step ? "done" : "";
          return (
            <div key={t} className={`crumb ${cls}`}>
              <span className="dot">{s}</span>
              <span className="txt">{t}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------
   Page
---------------------------------*/

export default function LegacyControlPage() {
  const [operation, setOperation] = useState<Operation>("merge");
  const [legacy, setLegacy] = useState({
    username: "",
    password: "",
    emails: "",
    phones: "",
    name: "",
    gender: "",
    dob: "",
    locations: "",
    pronouns: "",
    bio: "",
    website: "",
  });

  const [targetUsername, setTargetUsername] = useState("");
  const [targetLoginId, setTargetLoginId] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newLoginId, setNewLoginId] = useState("");

  const [rawLegacyJson, setRawLegacyJson] = useState("{}");
  const [showJsonImport, setShowJsonImport] = useState(false);

  const [options, setOptions] = useState<MergeOptionsState>({
    overwritePassword: false,
    copyProfileFields: true,
    copyContact: true,
    copyLocation: true,
    legacyDisposition: "preserve",
    keepLegacyLoginActive: true,
    note: "",
  });

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const totalSteps = 5;

  const [showMoreLegacy, setShowMoreLegacy] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmConversion, setConfirmConversion] = useState(false);
  const [lockedFields, setLockedFields] = useState({ username: false, password: false });

  const redirectUrl = useMemo(() => {
    if (typeof window === "undefined") return "https://chittersync.com/home";
    const params = new URLSearchParams(window.location.search);
    const url = params.get("redirect");
    if (url && isTrustedRedirect(url)) return url;
    return "https://chittersync.com/home";
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlUsername = params.get("username") || params.get("legacy_username") || "";
    const urlPassword = params.get("password") || params.get("legacy_password") || "";
    if (urlUsername || urlPassword) {
      setLegacy((prev) => ({
        ...prev,
        username: urlUsername || prev.username,
        password: urlPassword || prev.password,
      }));
      setLockedFields({
        username: Boolean(urlUsername),
        password: Boolean(urlPassword),
      });
    }
  }, []);

  const payloadPreview = useMemo(() => {
    const preview = {
      operation,
      legacy: {
        username: legacy.username || undefined,
        password: legacy.password || undefined,
        emails: toList(legacy.emails),
        phones: toList(legacy.phones),
        name: legacy.name || undefined,
        gender: legacy.gender || undefined,
        dob: legacy.dob || undefined,
        locations: toList(legacy.locations),
        pronouns: legacy.pronouns || undefined,
        bio: legacy.bio || undefined,
        website: legacy.website || undefined,
      },
      targetUsername: targetUsername || undefined,
      targetLoginId: targetLoginId || undefined,
      newUsername: newUsername || undefined,
      newLoginId: newLoginId || undefined,
      options,
    };
    return JSON.stringify(preview, null, 2);
  }, [legacy, operation, options, targetLoginId, targetUsername, newLoginId, newUsername]);

  const missingLegacyUsername = !legacy.username.trim();
  const missingTarget = operation === "merge" && !targetUsername.trim() && !targetLoginId.trim();
  const missingNewUsername = operation === "create" && !newUsername.trim();

  const stepTitles = [
    "Choose what to do",
    "Old account (legacy) info",
    operation === "merge" ? "Where to put it" : "New account name",
    "Optional settings",
    "Review & convert",
  ];

  const stepErrors: string[] = useMemo(() => {
    if (step === 2 && missingLegacyUsername) return ["Please enter the legacy username."];
    if (step === 3 && operation === "merge" && missingTarget) return ["Enter a target username OR a login ID."];
    if (step === 3 && operation === "create" && missingNewUsername) return ["Please choose a username for the new account."];
    if (step === 5) {
      const errs = [
        missingLegacyUsername && "Legacy username is required.",
        missingTarget && "Provide a target username or login ID.",
        missingNewUsername && "Choose a username for the new account.",
        !confirmConversion && "Please confirm you understand before converting.",
      ].filter(Boolean) as string[];
      return errs;
    }
    return [];
  }, [step, missingLegacyUsername, missingTarget, missingNewUsername, operation, confirmConversion]);

  const canGoNext = step < totalSteps && stepErrors.length === 0;

  const handleLegacyChange = (field: keyof typeof legacy, value: string) => {
    setLegacy((prev) => ({ ...prev, [field]: value }));
  };

  const handleLegacyJsonImport = () => {
    setError(null);
    setToast(null);
    if (!rawLegacyJson.trim()) {
      setError("Paste a legacy JSON blob to import.");
      return;
    }
    try {
      const parsed = JSON.parse(rawLegacyJson);
      setLegacy((prev) => ({
        ...prev,
        username: parsed.username ?? prev.username,
        password: parsed.password ?? prev.password,
        emails: Array.isArray(parsed.emails) ? parsed.emails.join(", ") : parsed.email ?? prev.emails,
        phones: Array.isArray(parsed.phones) ? parsed.phones.join(", ") : parsed.phone ?? prev.phones,
        name: parsed.name ?? parsed.profile?.displayName ?? prev.name,
        gender: parsed.gender ?? prev.gender,
        dob: parsed.dob ?? prev.dob,
        locations: Array.isArray(parsed.locations) ? parsed.locations.join(", ") : parsed.location ?? prev.locations,
        pronouns: parsed.pronouns ?? prev.pronouns,
        bio: parsed.bio ?? prev.bio,
        website: parsed.website ?? prev.website,
      }));
      setToast("Imported legacy JSON.");
      setShowJsonImport(false);
    } catch {
      setError("Could not parse that JSON. Make sure it is valid.");
    }
  };

  const goNext = () => setStep((s) => clamp(s + 1, 1, totalSteps));
  const goBack = () => setStep((s) => clamp(s - 1, 1, totalSteps));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < totalSteps) {
      setStep(totalSteps);
      return;
    }

    setError(null);
    setResult(null);
    setToast(null);

    if (stepErrors.length > 0) {
      setError(stepErrors[0]);
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/legacy/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation,
          legacy: {
            username: legacy.username.trim(),
            password: legacy.password || undefined,
            emails: toList(legacy.emails),
            phones: toList(legacy.phones),
            name: legacy.name,
            gender: legacy.gender,
            dob: legacy.dob,
            locations: toList(legacy.locations),
            pronouns: legacy.pronouns,
            bio: legacy.bio,
            website: legacy.website,
          },
          targetUsername: targetUsername.trim() || undefined,
          targetLoginId: targetLoginId.trim() || undefined,
          newUsername: newUsername.trim() || undefined,
          newLoginId: newLoginId.trim() || undefined,
          options,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Conversion failed.");

      setResult(data);
      setToast(operation === "merge" ? "Done! Legacy account merged." : "Done! New account created from legacy data.");
      window.location.href = redirectUrl;
    } catch (err: any) {
      setError(err?.message || "Conversion failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="hero">
        <div className="heroLeft">
          <div className="kicker">ChitterHaven → ChitterSync</div>
          <h1>Move your old account, step by step</h1>
          <p className="sub">
            This page is a guided helper. You can go back any time, and you will review everything before it sends.
          </p>
          <Progress step={step} total={totalSteps} titles={stepTitles} />
        </div>

        <div className="heroRight">
          <Callout tone="info" title="Quick reassurance">
            <ul className="bullets">
              <li>Only the legacy username is required.</li>
              <li>Most fields are optional.</li>
              <li>Advanced settings are hidden unless you open them.</li>
            </ul>
          </Callout>
          <Callout tone="info" title="Where you go after">
            <div className="mini">
              After conversion, we will redirect you to:
              <div className="url">{redirectUrl}</div>
            </div>
          </Callout>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="form">
        {step === 1 && (
          <StepShell
            stepLabel="Step 1"
            title="What do you want to do?"
            desc="Pick one option. You can change it later."
          >
            <ChoiceCards<Operation>
              value={operation}
              onChange={(v) => setOperation(v)}
              options={[
                {
                  value: "merge",
                  title: "Merge into my existing ChitterSync account",
                  desc: "Use this if you already have a new account. We’ll move legacy info into it.",
                },
                {
                  value: "create",
                  title: "Create a new ChitterSync account",
                  desc: "Use this if you don’t have a new account yet. We’ll create one from legacy info.",
                },
              ]}
            />

            <div className="row">
              <GhostButton type="button" onClick={() => setShowJsonImport((v) => !v)}>
                {showJsonImport ? "Hide JSON import" : "Show JSON import (optional)"}
              </GhostButton>
            </div>

            {showJsonImport ? (
              <div className="stack">
                <TextAreaField
                  label="Paste legacy JSON (optional)"
                  value={rawLegacyJson}
                  onChange={setRawLegacyJson}
                  helper="If you have a JSON blob, paste it here. We’ll fill the fields for you."
                  placeholder='Example: { "username":"alice", "emails":["a@b.com"] }'
                  rows={5}
                />
                <div className="row">
                  <SecondaryButton type="button" onClick={handleLegacyJsonImport}>
                    Import JSON
                  </SecondaryButton>
                  <GhostButton
                    type="button"
                    onClick={() => {
                      setRawLegacyJson("{}");
                      setToast("Cleared JSON box.");
                    }}
                  >
                    Clear
                  </GhostButton>
                </div>
              </div>
            ) : null}
          </StepShell>
        )}

        {step === 2 && (
          <StepShell
            stepLabel="Step 2"
            title="Old account info (legacy)"
            desc="Start with the username. Everything else is optional."
          >
            {stepErrors.length > 0 ? (
              <Callout tone="warn" title="We need one thing">
                {stepErrors[0]}
              </Callout>
            ) : (
              <Callout tone="info" title="What’s required">
                Legacy username. That’s it.
              </Callout>
            )}

            <div className="grid2">
              <TextField
                label="Legacy username"
                value={legacy.username}
                onChange={(v) => handleLegacyChange("username", v)}
                placeholder="old username"
                required
                error={missingLegacyUsername ? "Please enter the legacy username." : undefined}
                locked={lockedFields.username}
                helper={lockedFields.username ? "Filled from your link and locked for safety." : "The old username from ChitterHaven."}
              />
              <TextField
                label="Legacy password (optional)"
                value={legacy.password}
                onChange={(v) => handleLegacyChange("password", v)}
                placeholder="leave blank if you don’t know it"
                type="password"
                locked={lockedFields.password}
                helper={lockedFields.password ? "Filled from your link and locked for safety." : "Optional. Only used if you choose password replacement later."}
              />
              <TextAreaField
                label="Emails (optional)"
                value={legacy.emails}
                onChange={(v) => handleLegacyChange("emails", v)}
                placeholder="user@example.com, other@example.com"
                helper="Comma or new lines both work."
                rows={3}
              />
              <TextAreaField
                label="Phone numbers (optional)"
                value={legacy.phones}
                onChange={(v) => handleLegacyChange("phones", v)}
                placeholder="+1 555 0100"
                helper="Comma or new lines both work."
                rows={3}
              />
            </div>

            <div className="row">
              <GhostButton type="button" onClick={() => setShowMoreLegacy((v) => !v)}>
                {showMoreLegacy ? "Hide extra fields" : "Show extra fields (optional)"}
              </GhostButton>
            </div>

            {showMoreLegacy ? (
              <div className="grid2">
                <TextField
                  label="Display name (optional)"
                  value={legacy.name}
                  onChange={(v) => handleLegacyChange("name", v)}
                  placeholder="Display name"
                />
                <TextField
                  label="Pronouns (optional)"
                  value={legacy.pronouns}
                  onChange={(v) => handleLegacyChange("pronouns", v)}
                  placeholder="they/them"
                />
                <TextField
                  label="Date of birth (optional)"
                  value={legacy.dob}
                  onChange={(v) => handleLegacyChange("dob", v)}
                  placeholder="YYYY-MM-DD"
                  helper="Leave blank if unknown."
                />
                <TextField
                  label="Website (optional)"
                  value={legacy.website}
                  onChange={(v) => handleLegacyChange("website", v)}
                  placeholder="https://example.com"
                />
                <TextAreaField
                  label="Bio (optional)"
                  value={legacy.bio}
                  onChange={(v) => handleLegacyChange("bio", v)}
                  placeholder="Short description"
                  rows={3}
                />
                <TextAreaField
                  label="Locations (optional)"
                  value={legacy.locations}
                  onChange={(v) => handleLegacyChange("locations", v)}
                  placeholder="City, State / Country"
                  helper="Comma or new lines both work."
                  rows={3}
                />
                <TextField
                  label="Gender (optional)"
                  value={legacy.gender}
                  onChange={(v) => handleLegacyChange("gender", v)}
                  placeholder="optional"
                />
              </div>
            ) : null}
          </StepShell>
        )}

        {step === 3 && operation === "merge" && (
          <StepShell
            stepLabel="Step 3"
            title="Where should we put this legacy data?"
            desc="Enter either the target username OR the login ID."
          >
            {stepErrors.length > 0 ? (
              <Callout tone="warn" title="One more thing">
                {stepErrors[0]}
              </Callout>
            ) : (
              <Callout tone="info" title="Tip">
                If you don’t know the login ID, just use the username.
              </Callout>
            )}

            <div className="grid2">
              <TextField
                label="Target username (optional)"
                value={targetUsername}
                onChange={setTargetUsername}
                placeholder="existing ChitterSync username"
                error={missingTarget ? "Enter a target username OR a login ID." : undefined}
              />
              <TextField
                label="Target login ID (optional)"
                value={targetLoginId}
                onChange={setTargetLoginId}
                placeholder="loginId (if you have it)"
                error={missingTarget ? "Enter a target username OR a login ID." : undefined}
              />
            </div>
          </StepShell>
        )}

        {step === 3 && operation === "create" && (
          <StepShell
            stepLabel="Step 3"
            title="Name the new account"
            desc="Pick a username for the new ChitterSync account."
          >
            {stepErrors.length > 0 ? (
              <Callout tone="warn" title="We need a username">
                {stepErrors[0]}
              </Callout>
            ) : (
              <Callout tone="info" title="Tip">
                Using the same username as your legacy account keeps it simple.
              </Callout>
            )}

            <div className="grid2">
              <TextField
                label="New username"
                value={newUsername}
                onChange={setNewUsername}
                placeholder="new username"
                required
                error={missingNewUsername ? "Please choose a username for the new account." : undefined}
              />
              <TextField
                label="New login ID (optional)"
                value={newLoginId}
                onChange={setNewLoginId}
                placeholder="leave blank unless you use this"
              />
            </div>
          </StepShell>
        )}

        {step === 4 && (
          <StepShell
            stepLabel="Step 4"
            title="Optional settings"
            desc="Most people can skip this. Defaults are safe."
          >
            <Callout tone="info" title="Defaults are safe">
              You only need this if you’re doing a special migration.
            </Callout>

            <div className="row">
              <GhostButton type="button" onClick={() => setShowAdvancedOptions((v) => !v)}>
                {showAdvancedOptions ? "Hide optional settings" : "Show optional settings"}
              </GhostButton>
            </div>

            {showAdvancedOptions ? (
              <div className="stack">
                <CheckboxRow
                  label="Copy profile details"
                  helper="Name, pronouns, bio, website, date of birth."
                  checked={options.copyProfileFields}
                  onChange={(v) => setOptions((p) => ({ ...p, copyProfileFields: v }))}
                />
                <CheckboxRow
                  label="Merge contact info"
                  helper="Emails + phone numbers."
                  checked={options.copyContact}
                  onChange={(v) => setOptions((p) => ({ ...p, copyContact: v }))}
                />
                <CheckboxRow
                  label="Merge locations"
                  helper="Combine any listed locations."
                  checked={options.copyLocation}
                  onChange={(v) => setOptions((p) => ({ ...p, copyLocation: v }))}
                />
                <CheckboxRow
                  label="Replace password with legacy password"
                  helper={!legacy.password.trim() ? "Disabled until you provide a legacy password." : "Only if you provided a legacy password."}
                  checked={options.overwritePassword}
                  onChange={(v) => setOptions((p) => ({ ...p, overwritePassword: v }))}
                  disabled={!legacy.password.trim()}
                />
                <CheckboxRow
                  label="Keep legacy login marked as active"
                  helper="Leaves a breadcrumb in metadata for auditing."
                  checked={options.keepLegacyLoginActive}
                  onChange={(v) => setOptions((p) => ({ ...p, keepLegacyLoginActive: v }))}
                />

                <div className="grid2">
                  <SelectField<MergeOptionsState["legacyDisposition"]>
                    label="What should happen to the legacy login?"
                    value={options.legacyDisposition}
                    onChange={(v) => setOptions((p) => ({ ...p, legacyDisposition: v }))}
                    helper="Preserve is safest if you’re unsure."
                    options={[
                      { value: "preserve", label: "Preserve (recommended)" },
                      { value: "archive", label: "Archive after merge" },
                      { value: "delete", label: "Delete legacy login" },
                    ]}
                  />
                  <TextAreaField
                    label="Internal note (optional)"
                    value={options.note}
                    onChange={(v) => setOptions((p) => ({ ...p, note: v }))}
                    placeholder="Why are we doing this conversion?"
                    helper="Only visible to reviewers/admins."
                    rows={4}
                  />
                </div>
              </div>
            ) : null}
          </StepShell>
        )}

        {step === 5 && (
          <StepShell
            stepLabel="Step 5"
            title="Review & convert"
            desc="Double-check, then confirm."
          >
            <div className="reviewGrid">
              <div className="reviewCard">
                <div className="reviewK">Action</div>
                <div className="reviewV">{operation === "merge" ? "Merge into existing account" : "Create new account"}</div>
              </div>
              <div className="reviewCard">
                <div className="reviewK">Legacy username</div>
                <div className="reviewV">{legacy.username || "—"}</div>
              </div>
              <div className="reviewCard">
                <div className="reviewK">Destination</div>
                <div className="reviewV">
                  {operation === "merge"
                    ? (targetUsername || targetLoginId || "—")
                    : (newUsername || "—")}
                </div>
              </div>
              <div className="reviewCard">
                <div className="reviewK">Contact items</div>
                <div className="reviewV">{toList(legacy.emails).length + toList(legacy.phones).length}</div>
              </div>
            </div>

            {stepErrors.length > 0 ? (
              <Callout tone="warn" title="Fix these before converting">
                <ul className="bullets">
                  {stepErrors.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </Callout>
            ) : (
              <Callout tone="success" title="Looks good">
                If everything above is correct, you’re ready.
              </Callout>
            )}

            <Callout tone="warn" title="Final check">
              Clicking <strong>Convert</strong> will send the request and then redirect you to:
              <div className="url">{redirectUrl}</div>
            </Callout>

            <CheckboxRow
              label="I understand and I want to convert this account now."
              helper="This is the final step."
              checked={confirmConversion}
              onChange={setConfirmConversion}
              tone="danger"
            />

            <div className="row">
              <GhostButton type="button" onClick={() => setShowPreview((v) => !v)}>
                {showPreview ? "Hide technical preview" : "Show technical preview (optional)"}
              </GhostButton>
            </div>

            {showPreview ? <pre className="preview">{payloadPreview}</pre> : null}
          </StepShell>
        )}

        <div className="nav">
          <div className="left">
            <SecondaryButton type="button" onClick={goBack} disabled={step === 1 || busy}>
              Back
            </SecondaryButton>
          </div>
          <div className="right">
            {step < totalSteps ? (
              <PrimaryButton type="button" onClick={goNext} disabled={!canGoNext || busy}>
                Next
              </PrimaryButton>
            ) : (
              <PrimaryButton type="submit" disabled={busy || stepErrors.length > 0}>
                {busy ? "Converting..." : "Convert"}
              </PrimaryButton>
            )}
          </div>
        </div>
      </form>

      {error ? (
        <div className="below">
          <Callout tone="error" title="Something went wrong">
            {error}
          </Callout>
        </div>
      ) : null}

      {result ? (
        <div className="below">
          <Callout tone="success" title="Success">
            <pre className="miniPre">{JSON.stringify(result, null, 2)}</pre>
          </Callout>
        </div>
      ) : null}

      {toast ? (
        <div className="toast" role="status" aria-live="polite">
          <span>{toast}</span>
          <button type="button" className="toastX" onClick={() => setToast(null)} aria-label="Close notification">
            ×
          </button>
        </div>
      ) : null}

      <style jsx>{`
        .page {
          max-width: 980px;
          margin: 0 auto;
          padding: 2rem 1rem 4rem;
          color: #f8fafc;
          background:
            radial-gradient(circle at 10% 0%, rgba(56, 189, 248, 0.12), transparent 55%),
            radial-gradient(circle at 80% 10%, rgba(249, 115, 22, 0.18), transparent 45%),
            linear-gradient(140deg, #05070f 0%, #0a0f1c 45%, #0b1326 100%);
          min-height: 100vh;
        }

        .hero {
          display: grid;
          grid-template-columns: 1.4fr 0.9fr;
          gap: 1rem;
          align-items: start;
          margin-bottom: 1rem;
        }
        @media (max-width: 920px) {
          .hero {
            grid-template-columns: 1fr;
          }
        }

        .heroLeft {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 16px;
          padding: 1.25rem;
          backdrop-filter: blur(12px);
        }
        .heroRight {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .kicker {
          text-transform: uppercase;
          font-size: 0.8rem;
          letter-spacing: 0.18em;
          color: #bfdbfe;
          opacity: 0.9;
          margin-bottom: 0.6rem;
        }
        h1 {
          font-size: 1.9rem;
          line-height: 1.15;
          margin: 0 0 0.5rem;
        }
        .sub {
          margin: 0 0 1rem;
          color: #cbd5e1;
          line-height: 1.45;
        }

        .form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          background: rgba(15, 23, 42, 0.55);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 16px;
          padding: 1rem;
          backdrop-filter: blur(12px);
        }

        .card {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 16px;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
        }

        .cardHead {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 0.9rem;
          align-items: start;
        }

        .badge {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          font-weight: 800;
          color: #bae6fd;
          background: rgba(56, 189, 248, 0.12);
          border: 1px solid rgba(56, 189, 248, 0.28);
        }

        .headText h2 {
          margin: 0;
          font-size: 1.25rem;
        }
        .headText p {
          margin: 0.25rem 0 0;
          color: #9ca3af;
          line-height: 1.4;
        }

        .cardBody {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
        }

        /* Progress */
        .progress {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .progressTop {
          display: flex;
          justify-content: space-between;
          color: #cbd5e1;
          font-size: 0.95rem;
        }
        .pct {
          opacity: 0.9;
        }
        .bar {
          height: 10px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.18);
          overflow: hidden;
        }
        .fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #7c3aed, #6366f1);
        }
        .crumbs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 0.55rem;
          margin-top: 0.25rem;
        }
        .crumb {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          color: #9ca3af;
          font-size: 0.85rem;
        }
        .crumb .dot {
          width: 24px;
          height: 24px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(148, 163, 184, 0.28);
          font-size: 0.75rem;
        }
        .crumb.done .dot,
        .crumb.active .dot {
          border-color: rgba(99, 102, 241, 0.65);
          color: #e2e8f0;
        }
        .crumb.active .txt {
          color: #e5e7eb;
          font-weight: 700;
        }

        /* Choices */
        .choiceGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }
        @media (max-width: 720px) {
          .choiceGrid {
            grid-template-columns: 1fr;
          }
        }
        .choiceCard {
          text-align: left;
          padding: 1rem;
          border-radius: 16px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(2, 6, 23, 0.35);
          cursor: pointer;
          color: #f8fafc;
        }
        .choiceCard.active {
          border-color: rgba(99, 102, 241, 0.7);
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.16);
          background: rgba(99, 102, 241, 0.08);
        }
        .choiceTitle {
          font-weight: 900;
          margin-bottom: 0.25rem;
        }
        .choiceDesc {
          color: #cbd5e1;
          line-height: 1.35;
          font-size: 0.95rem;
        }

        /* Fields */
        .grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.85rem;
        }
        @media (max-width: 720px) {
          .grid2 {
            grid-template-columns: 1fr;
          }
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .fieldTop {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .fieldLabel {
          font-size: 0.95rem;
          font-weight: 750;
          color: #e5e7eb;
        }
        .req {
          color: #fca5a5;
          margin-left: 0.25rem;
        }
        .fieldHelper {
          font-size: 0.87rem;
          color: #9ca3af;
          line-height: 1.35;
        }
        .fieldError {
          font-size: 0.87rem;
          color: #fecaca;
        }

        .input,
        .textarea,
        .select {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(2, 6, 23, 0.55);
          color: #e2e8f0;
          padding: 0.75rem 0.85rem;
          outline: none;
        }
        .textarea {
          resize: vertical;
          min-height: 96px;
        }
        .input:focus,
        .textarea:focus,
        .select:focus {
          border-color: rgba(99, 102, 241, 0.7);
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.18);
        }
        .locked {
          border-style: dashed;
          opacity: 0.9;
          cursor: not-allowed;
        }

        /* Checkbox row */
        .checkRow {
          display: grid;
          grid-template-columns: 18px 1fr;
          gap: 0.7rem;
          align-items: start;
          padding: 0.85rem;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 14px;
          background: rgba(2, 6, 23, 0.35);
          cursor: pointer;
        }
        .checkRow input {
          margin-top: 0.1rem;
          width: 18px;
          height: 18px;
        }
        .checkRow.danger {
          border-color: rgba(248, 113, 113, 0.38);
          background: rgba(127, 29, 29, 0.12);
        }
        .checkRow.disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .checkLabel {
          font-weight: 850;
          color: #e5e7eb;
        }
        .checkHelper {
          margin-top: 0.2rem;
          color: #9ca3af;
          font-size: 0.9rem;
          line-height: 1.35;
        }

        /* Callouts */
        .callout {
          border-radius: 16px;
          padding: 0.85rem 0.95rem;
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(2, 6, 23, 0.35);
        }
        .calloutTitle {
          font-weight: 900;
          margin-bottom: 0.35rem;
        }
        .calloutBody {
          color: #cbd5e1;
          line-height: 1.4;
        }
        .callout.info {
          border-color: rgba(96, 165, 250, 0.25);
          background: rgba(96, 165, 250, 0.06);
        }
        .callout.warn {
          border-color: rgba(251, 191, 36, 0.28);
          background: rgba(251, 191, 36, 0.06);
        }
        .callout.success {
          border-color: rgba(34, 197, 94, 0.26);
          background: rgba(34, 197, 94, 0.06);
        }
        .callout.error {
          border-color: rgba(239, 68, 68, 0.3);
          background: rgba(239, 68, 68, 0.06);
        }

        .row {
          display: flex;
          gap: 0.6rem;
          flex-wrap: wrap;
          align-items: center;
        }
        .stack {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        /* Review */
        .reviewGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.75rem;
        }
        .reviewCard {
          padding: 0.85rem;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(2, 6, 23, 0.35);
        }
        .reviewK {
          font-size: 0.78rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #9ca3af;
        }
        .reviewV {
          margin-top: 0.3rem;
          font-weight: 850;
          color: #e5e7eb;
        }

        .preview {
          max-height: 360px;
          overflow: auto;
          background: rgba(2, 6, 23, 0.55);
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 16px;
          padding: 0.85rem;
          font-size: 0.85rem;
          white-space: pre-wrap;
          color: #cbd5e1;
        }

        .nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0.25rem 0;
        }

        /* Buttons */
        .btn {
          border-radius: 999px;
          padding: 0.78rem 1.15rem;
          font-weight: 900;
          border: 1px solid transparent;
          cursor: pointer;
          user-select: none;
          transition: transform 0.08s ease, opacity 0.2s ease;
        }
        .btn:active {
          transform: scale(0.99);
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn.primary {
          background: linear-gradient(90deg, #7c3aed, #6366f1);
          color: white;
        }
        .btn.secondary {
          background: rgba(2, 6, 23, 0.35);
          border-color: rgba(148, 163, 184, 0.22);
          color: #e5e7eb;
        }
        .btn.ghost {
          background: transparent;
          border-color: rgba(148, 163, 184, 0.22);
          color: #cbd5e1;
        }

        .below {
          margin-top: 1rem;
        }

        .miniPre {
          margin: 0.5rem 0 0;
          background: rgba(2, 6, 23, 0.55);
          border: 1px solid rgba(148, 163, 184, 0.16);
          padding: 0.75rem;
          border-radius: 14px;
          overflow: auto;
          max-height: 240px;
          white-space: pre-wrap;
        }

        .bullets {
          margin: 0;
          padding-left: 1.2rem;
        }

        .mini {
          font-size: 0.95rem;
          color: #cbd5e1;
        }
        .url {
          margin-top: 0.4rem;
          padding: 0.5rem 0.7rem;
          border-radius: 12px;
          background: rgba(2, 6, 23, 0.45);
          border: 1px solid rgba(148, 163, 184, 0.16);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          color: #bfdbfe;
          overflow: auto;
        }

        /* Toast */
        .toast {
          position: fixed;
          bottom: 1rem;
          right: 1rem;
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.65rem 0.9rem;
          border-radius: 999px;
          background: rgba(2, 6, 23, 0.75);
          border: 1px solid rgba(148, 163, 184, 0.22);
          color: #e5e7eb;
          backdrop-filter: blur(10px);
          max-width: min(520px, calc(100vw - 2rem));
        }
        .toastX {
          background: transparent;
          border: none;
          color: inherit;
          font-size: 1.25rem;
          cursor: pointer;
          line-height: 1;
          padding: 0 0.25rem;
        }
      `}</style>
    </div>
  );
}
