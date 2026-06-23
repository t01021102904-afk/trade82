"use client";

import { FormEvent, useEffect, useState } from "react";

import { SingleImageUploader } from "@/components/image-uploader";
import { useI18n } from "@/components/i18n-provider";
import type { UploadedListingImage } from "@/lib/marketplace";

type ProfessionalProfile = {
  displayName: string;
  email: string;
  avatarOriginalUrl: string;
  avatarUrl: string;
  companyAffiliation: string;
  jobTitle: string;
  department: string;
  bio: string;
  phoneNumber: string;
  linkedinUrl: string;
  country: string;
  city: string;
  preferredLanguage: "en" | "ko";
};

const emptyProfile: ProfessionalProfile = {
  displayName: "",
  email: "",
  avatarOriginalUrl: "",
  avatarUrl: "",
  companyAffiliation: "",
  jobTitle: "",
  department: "",
  bio: "",
  phoneNumber: "",
  linkedinUrl: "",
  country: "",
  city: "",
  preferredLanguage: "en",
};

export function ContactProfileSettings() {
  const { t } = useI18n();
  const [profile, setProfile] = useState(emptyProfile);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/account/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((value: Partial<ProfessionalProfile> | null) => {
        if (value) {
          setProfile({ ...emptyProfile, ...value });
        }
        setLoaded(true);
      });
  }, []);

  function update<K extends keyof ProfessionalProfile>(
    key: K,
    value: ProfessionalProfile[K],
  ) {
    setProfile((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch("/api/account/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaved(response.ok);
    if (!response.ok) setError(t("settings.profileSaveError"));
    setSaving(false);
  }

  function updateAvatar(image: UploadedListingImage) {
    setProfile((current) => ({
      ...current,
      avatarOriginalUrl: image.originalUrl,
      avatarUrl: image.mainUrl,
    }));
    setSaved(false);
  }

  if (!loaded) {
    return <p className="text-sm text-zinc-600">{t("common.loading")}</p>;
  }

  return (
    <form onSubmit={submit} className="grid max-w-3xl gap-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <SingleImageUploader
          kind="profile_avatar"
          imageUrl={profile.avatarUrl}
          label={t("settings.avatarUpload")}
          onUploaded={updateAvatar}
          onUploadingChange={setUploading}
        />
      </section>
      <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 sm:grid-cols-2">
        <Field label={t("settings.displayName")} value={profile.displayName} onChange={(value) => update("displayName", value)} />
        <Field label={t("contact.email")} value={profile.email} disabled onChange={() => undefined} />
        <Field label={t("settings.companyAffiliation")} value={profile.companyAffiliation} onChange={(value) => update("companyAffiliation", value)} />
        <Field label={t("settings.jobTitle")} value={profile.jobTitle} onChange={(value) => update("jobTitle", value)} />
        <Field label={t("settings.department")} value={profile.department} onChange={(value) => update("department", value)} />
        <Field label={t("settings.phoneNumber")} type="tel" value={profile.phoneNumber} onChange={(value) => update("phoneNumber", value)} />
        <Field label={t("settings.linkedinUrl")} type="url" value={profile.linkedinUrl} onChange={(value) => update("linkedinUrl", value)} />
        <Field label={t("settings.country")} value={profile.country} onChange={(value) => update("country", value)} />
        <Field label={t("settings.city")} value={profile.city} onChange={(value) => update("city", value)} />
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-700">{t("settings.preferredLanguage")}</span>
          <select
            value={profile.preferredLanguage}
            onChange={(event) => update("preferredLanguage", event.target.value as "en" | "ko")}
            className="h-10 rounded-md border border-zinc-200 bg-white px-3"
          >
            <option value="en">English</option>
            <option value="ko">한국어</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-zinc-700">{t("settings.bio")}</span>
          <textarea
            rows={5}
            value={profile.bio}
            onChange={(event) => update("bio", event.target.value)}
            className="rounded-md border border-zinc-200 px-3 py-2"
          />
        </label>
      </section>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={uploading || saving}
          className="rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? t("settings.saving") : t("settings.saveProfile")}
        </button>
        {saved ? (
          <span className="text-sm text-emerald-700">{t("settings.saved")}</span>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "url" | "tel";
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-zinc-700">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-zinc-200 px-3 disabled:bg-zinc-100"
      />
    </label>
  );
}
