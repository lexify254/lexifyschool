"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "./portal.module.css";

type ProfileDefaults = {
  publicName: string;
  bio: string;
  startingPrice: string;
  pricingBasis: string;
  services: string[];
};

export function TeacherProfileForm({
  defaults,
}: {
  defaults: ProfileDefaults;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      publicName: String(form.get("publicName") ?? ""),
      bio: String(form.get("bio") ?? ""),
      startingPrice: String(form.get("startingPrice") ?? ""),
      pricingBasis: String(form.get("pricingBasis") ?? ""),
      services: form.get("tuition") === "on" ? ["tuition"] : [],
    };
    try {
      const response = await fetch("/api/teacher/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Your profile could not be saved.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(
        "The profile service could not be reached. Check your connection and try again."
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section
      className="portal-panel"
      aria-labelledby="edit-teacher-profile-title"
    >
      <h2 id="edit-teacher-profile-title">Public teacher profile</h2>
      <p>
        Your listed price is informational. Families contact you directly;
        Lexify School does not take payment or confirm bookings.
      </p>
      <form className={styles.profileForm} onSubmit={submit}>
        <label>
          Public name
          <input
            name="publicName"
            maxLength={120}
            defaultValue={defaults.publicName}
            autoComplete="name"
          />
          <small>Leave blank to use the standard teacher label.</small>
        </label>
        <label>
          Public biography
          <textarea
            name="bio"
            maxLength={1600}
            defaultValue={defaults.bio}
            rows={5}
          />
        </label>
        <div className={styles.profilePriceRow}>
          <label>
            Starting price (KES, optional)
            <input
              name="startingPrice"
              type="number"
              min="1"
              max="10000000"
              step="0.01"
              defaultValue={defaults.startingPrice}
              placeholder="Not listed"
            />
          </label>
          <label>
            Price basis
            <select name="pricingBasis" defaultValue={defaults.pricingBasis}>
              <option value="">No starting price listed</option>
              <option value="lesson_bundle">Per lesson bundle</option>
              <option value="weekly">Per week</option>
              <option value="monthly">Per month</option>
            </select>
          </label>
        </div>
        <fieldset className={styles.profileServices}>
          <legend>Services offered</legend>
          <label>
            <input
              type="checkbox"
              name="tuition"
              defaultChecked={defaults.services.includes("tuition")}
            />
            Tuition
          </label>
          <small>
            Only services currently supported by Lexify School can be selected.
          </small>
        </fieldset>
        {error ? (
          <p className={styles.profileError} role="alert">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className={styles.profileSuccess} role="status">
            Profile saved.
          </p>
        ) : null}
        <button className="button button--blue" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save public profile"}
        </button>
      </form>
    </section>
  );
}
