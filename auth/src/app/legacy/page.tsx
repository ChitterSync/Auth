"use client";

import { useMemo, useState } from "react";

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
  const [showPreview, setShowPreview] = useState(false);
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
  const requirementErrors = [
    missingLegacyUsername && "Legacy username is required.",
    missingTarget && "Provide a target username or login ID.",
    missingNewUsername && "Choose a username for the new account.",
  ].filter(Boolean) as string[];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setToast(null);
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
      if (!response.ok) {
        throw new Error(data?.error || "Merge failed.");
      }
      setResult(data);
      setToast(operation === "merge" ? "Legacy account merged successfully." : "New account created from legacy data.");
    } catch (err: any) {
      setError(err?.message || "Merge failed.");
    } finally {
      setBusy(false);
    }
  };

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
      setToast("Legacy JSON imported.");
    } catch {
      setError("Could not parse that JSON. Make sure it is valid.");
    }
  };

  const renderTextInput = (
    label: string,
    field: keyof typeof legacy,
    placeholder?: string,
    type = "text",
  ) => (
    <label className="legacy-field">
      <span>{label}</span>
      <input
        type={type}
        value={legacy[field]}
        onChange={(e) => handleLegacyChange(field, e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );

  const renderTextArea = (label: string, field: keyof typeof legacy, placeholder?: string) => (
    <label className="legacy-field">
      <span>{label}</span>
      <textarea
        value={legacy[field]}
        onChange={(e) => handleLegacyChange(field, e.target.value)}
        placeholder={placeholder}
        rows={3}
      />
    </label>
  );

  return (
    <div className="legacy-page">
      <header className="hero">
        <div>
          <p className="eyebrow">Migration console</p>
          <h1>Legacy Account Control</h1>
          <p className="intro">
            Follow these guided steps to move a ChitterHaven profile into the new ChitterSync Auth platform.
          </p>
        </div>
        <div className="tip-card">
          <p className="tip-title">Workflow overview</p>
          <ol>
            <li>Paste/import legacy data.</li>
            <li>Select merge or create behavior.</li>
            <li>Choose how duplicates behave.</li>
            <li>Submit and review the JSON payload.</li>
          </ol>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="legacy-form">
        <section className="card">
          <div className="section-heading">
            <h2>Step 1 · Choose action</h2>
            <p>Decide whether you&apos;re merging into an active account or creating a fresh one.</p>
          </div>
          <div className="option-grid">
            <label>
              <input
                type="radio"
                name="operation"
                value="merge"
                checked={operation === "merge"}
                onChange={() => setOperation("merge")}
              />
              Merge into an existing account
            </label>
            <label>
              <input
                type="radio"
                name="operation"
                value="create"
                checked={operation === "create"}
                onChange={() => setOperation("create")}
              />
              Create a brand-new account
            </label>
          </div>
          <div className="import-json">
            <textarea
              placeholder='Optional: paste legacy JSON { "username": "alice", ... }'
              value={rawLegacyJson}
              onChange={(e) => setRawLegacyJson(e.target.value)}
              rows={3}
            />
            <button type="button" className="pill" onClick={handleLegacyJsonImport}>
              Fill fields from JSON
            </button>
          </div>
        </section>

        <section className="card">
          <div className="section-heading">
            <h2>Step 2 · Legacy data</h2>
            <p>Fill out everything you know about the legacy account.</p>
          </div>
          <div className="legacy-grid">
            {renderTextInput("Legacy username", "username", "old username")}
            {renderTextInput("Legacy password", "password", "leave blank to skip", "text")}
            {renderTextArea("Emails (comma or newline)", "emails", "user@example.com")}
            {renderTextArea("Phone numbers", "phones", "+1 555 0100")}
            {renderTextInput("Display name", "name", "Display name")}
            {renderTextInput("Gender", "gender", "optional")}
            {renderTextInput("Date of birth", "dob", "YYYY-MM-DD")}
            {renderTextArea("Locations", "locations", "Country, city...")}
            {renderTextInput("Pronouns", "pronouns", "they/them")}
            {renderTextArea("Bio", "bio", "Short description")}
            {renderTextInput("Website", "website", "https://example.com")}
          </div>
        </section>

        {operation === "merge" ? (
          <section className="card">
            <div className="section-heading">
              <h2>Step 3 · Destination account</h2>
              <p>Provide a username or login ID for the cloud account that should receive this data.</p>
            </div>
            <div className="target-grid">
              <label>
                <span>Target username</span>
                <input value={targetUsername} onChange={(e) => setTargetUsername(e.target.value)} />
              </label>
              <label>
                <span>Target login ID</span>
                <input value={targetLoginId} onChange={(e) => setTargetLoginId(e.target.value)} />
              </label>
            </div>
          </section>
        ) : (
          <section className="card">
            <div className="section-heading">
              <h2>Step 3 · New account details</h2>
              <p>Name the new cloud account. Matching the legacy username keeps things recognizable.</p>
            </div>
            <div className="target-grid">
              <label>
                <span>New username</span>
                <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
              </label>
              <label>
                <span>New login ID</span>
                <input value={newLoginId} onChange={(e) => setNewLoginId(e.target.value)} />
              </label>
            </div>
          </section>
        )}

        <section className="card">
          <div className="section-heading">
            <h2>Step 4 · Merge options</h2>
            <p>Fine-tune how duplicate fields behave and what happens to the legacy record afterward.</p>
          </div>
          <div className="options-grid">
            <label>
              <input
                type="checkbox"
                checked={options.copyProfileFields}
                onChange={(e) => setOptions((prev) => ({ ...prev, copyProfileFields: e.target.checked }))}
              />
              Copy profile fields (name, pronouns, bio, website, dob)
            </label>
            <label>
              <input
                type="checkbox"
                checked={options.copyContact}
                onChange={(e) => setOptions((prev) => ({ ...prev, copyContact: e.target.checked }))}
              />
              Merge emails and phone numbers
            </label>
            <label>
              <input
                type="checkbox"
                checked={options.copyLocation}
                onChange={(e) => setOptions((prev) => ({ ...prev, copyLocation: e.target.checked }))}
              />
              Merge locations
            </label>
            <label>
              <input
                type="checkbox"
                checked={options.overwritePassword}
                onChange={(e) => setOptions((prev) => ({ ...prev, overwritePassword: e.target.checked }))}
              />
              Replace password with legacy password
            </label>
            <label>
              <input
                type="checkbox"
                checked={options.keepLegacyLoginActive}
                onChange={(e) => setOptions((prev) => ({ ...prev, keepLegacyLoginActive: e.target.checked }))}
              />
              Keep legacy login marked as active in metadata
            </label>
          </div>
          <label className="legacy-field">
            <span>Legacy disposition</span>
            <select
              value={options.legacyDisposition}
              onChange={(e) =>
                setOptions((prev) => ({ ...prev, legacyDisposition: e.target.value as MergeOptionsState["legacyDisposition"] }))
              }
            >
              <option value="preserve">Preserve for auditing</option>
              <option value="archive">Archive after merge</option>
              <option value="delete">Delete the legacy login</option>
            </select>
          </label>
          <label className="legacy-field">
            <span>Internal note</span>
            <textarea
              rows={3}
              value={options.note}
              onChange={(e) => setOptions((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Add context for reviewers."
            />
          </label>
        </section>

        <section className="card">
          <div className="preview-header">
            <div>
              <h2>Preview payload</h2>
              <p>Expand to review the JSON we&apos;ll POST to /api/legacy/merge.</p>
            </div>
            <button type="button" className="pill" onClick={() => setShowPreview((prev) => !prev)}>
              {showPreview ? "Hide preview" : "Show preview"}
            </button>
          </div>
          {showPreview && <pre className="preview">{payloadPreview}</pre>}
        </section>

        {requirementErrors.length > 0 && (
          <div className="alert error">
            <strong>Complete the missing pieces:</strong>
            <ul>
              {requirementErrors.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="actions">
          <button type="submit" disabled={busy || requirementErrors.length > 0}>
            {busy ? "Processing..." : operation === "merge" ? "Merge legacy account" : "Create new account"}
          </button>
        </div>
      </form>

      {error && (
        <div className="alert error">
          <strong>Failed:</strong> {error}
        </div>
      )}

      {result && (
        <div className="alert success">
          <strong>Success!</strong>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      {toast && (
        <div className="toast">
          {toast}
          <button type="button" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      )}

      <style jsx>{`
        .legacy-page {
          max-width: 960px;
          margin: 0 auto;
          padding: 2rem 1rem 4rem;
          color: #f8fafc;
        }
        .hero {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .eyebrow {
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.2em;
          color: #60a5fa;
        }
        h1 {
          font-size: 2.1rem;
          margin: 0 0 0.5rem;
        }
        .intro {
          color: #94a3b8;
          line-height: 1.5;
        }
        .tip-card {
          flex: 1;
          min-width: 220px;
          background: rgba(96, 165, 250, 0.08);
          border: 1px solid rgba(96, 165, 250, 0.3);
          border-radius: 16px;
          padding: 1rem;
        }
        .tip-title {
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.2em;
          color: #bfdbfe;
          margin-bottom: 0.5rem;
        }
        .tip-card ol {
          margin: 0;
          padding-left: 1.2rem;
          color: #cbd5f5;
        }
        .legacy-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid #1f2937;
          border-radius: 16px;
          padding: 1.5rem;
          backdrop-filter: blur(12px);
        }
        .card {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
          background: rgba(15, 23, 42, 0.6);
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.15);
          padding: 1rem;
        }
        .section-heading p {
          color: #9ca3af;
          font-size: 0.9rem;
        }
        .option-grid,
        .options-grid {
          display: grid;
          gap: 0.5rem;
        }
        .options-grid label,
        .option-grid label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.95rem;
        }
        .legacy-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 0.75rem;
        }
        .legacy-field {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.9rem;
          color: #cbd5f5;
        }
        input,
        textarea,
        select {
          width: 100%;
          border-radius: 8px;
          border: 1px solid #1e293b;
          background: #0f172a;
          color: #e2e8f0;
          padding: 0.6rem 0.75rem;
        }
        textarea {
          resize: vertical;
        }
        .import-json {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .target-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.75rem;
        }
        .preview {
          max-height: 320px;
          overflow: auto;
          background: #0b1120;
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 0.75rem;
          font-size: 0.85rem;
        }
        .actions {
          display: flex;
          justify-content: flex-end;
        }
        button {
          background: linear-gradient(90deg, #7c3aed, #6366f1);
          border: none;
          border-radius: 999px;
          padding: 0.75rem 1.5rem;
          font-weight: 600;
          color: white;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .alert {
          margin-top: 1.5rem;
          padding: 1rem;
          border-radius: 12px;
          border: 1px solid;
          color: #f8fafc;
        }
        .alert.success {
          background: rgba(16, 185, 129, 0.1);
          border-color: #34d399;
        }
        .alert.error {
          background: rgba(239, 68, 68, 0.1);
          border-color: #f87171;
        }
        .alert pre {
          margin-top: 0.5rem;
          white-space: pre-wrap;
          overflow-x: auto;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          border-radius: 999px;
          border: 1px solid #475569;
          padding: 0.35rem 0.9rem;
          background: transparent;
          color: #f8fafc;
          font-size: 0.85rem;
          cursor: pointer;
        }
        .preview-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .toast {
          position: fixed;
          bottom: 1rem;
          right: 1rem;
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.4);
          color: #bbf7d0;
          border-radius: 999px;
          padding: 0.5rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .toast button {
          background: none;
          border: none;
          color: inherit;
          font-size: 1.1rem;
          cursor: pointer;
        }
        @media (max-width: 640px) {
          .legacy-form {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
