import React, { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Moon, Sun, Monitor } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { updateNotificationPreferences } from '../lib/firestoreService';
import { Avatar } from '../components/Avatar';
import { FIELD_LIMITS, ThemePreference } from '../types/models';

export function SettingsPage() {
  const { user, profile, privateInfo, updateUserProfileData, resetPassword, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const [displayName, setDisplayName] = useState(
    profile?.displayName || user?.displayName || ''
  );
  const [jobTitle, setJobTitle] = useState(profile?.jobTitle || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || user?.photoURL || '');
  const [themePref, setThemePref] = useState<ThemePreference>(
    profile?.themePreference || theme
  );

  const [notifyAssignments, setNotifyAssignments] = useState(
    privateInfo?.notifyAssignments ?? true
  );
  const [notifyDeadlines, setNotifyDeadlines] = useState(
    privateInfo?.notifyDeadlines ?? true
  );
  const [notifyMentions, setNotifyMentions] = useState(
    privateInfo?.notifyMentions ?? true
  );
  const [notifyComments, setNotifyComments] = useState(
    privateInfo?.notifyComments ?? true
  );

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setJobTitle(profile.jobTitle);
      setBio(profile.bio);
      setPhotoURL(profile.photoURL);
      setThemePref(profile.themePreference);
    }
  }, [profile]);

  useEffect(() => {
    if (privateInfo) {
      setNotifyAssignments(privateInfo.notifyAssignments);
      setNotifyDeadlines(privateInfo.notifyDeadlines);
      setNotifyMentions(privateInfo.notifyMentions);
      setNotifyComments(privateInfo.notifyComments);
    }
  }, [privateInfo]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSavingProfile(true);
    setSavedMsg('');
    try {
      await updateUserProfileData({
        displayName,
        jobTitle,
        bio,
        photoURL,
        themePreference: themePref,
      });
      setTheme(themePref);
      setSavedMsg('Profile and theme preferences saved.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingPrefs(true);
    setSavedMsg('');
    try {
      await updateNotificationPreferences(user.uid, user.email || '', {
        notifyAssignments,
        notifyDeadlines,
        notifyMentions,
        notifyComments,
      });
      setSavedMsg('Notification preferences updated.');
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Manage your profile, appearance, notification preferences, and account security.
        </p>
      </div>

      {savedMsg && (
        <div className="p-3.5 text-xs bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      {/* Profile & Appearance */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5"
      >
        <div className="flex items-center gap-4">
          <Avatar name={displayName || 'User'} photoURL={photoURL} size="lg" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Profile Information
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Visible to teammates inside your shared workspaces.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.DISPLAY_NAME_MAX}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Job Title / Role
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.JOB_TITLE_MAX}
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Staff Product Engineer"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Avatar Image URL (optional)
          </label>
          <input
            type="url"
            maxLength={FIELD_LIMITS.PHOTO_URL_MAX}
            value={photoURL}
            onChange={(e) => setPhotoURL(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Bio
          </label>
          <textarea
            rows={2}
            maxLength={FIELD_LIMITS.BIO_MAX}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Focus areas, timezone, or responsibilities..."
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
            Theme Preference
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'light' as ThemePreference, label: 'Light', icon: Sun },
              { id: 'dark' as ThemePreference, label: 'Dark', icon: Moon },
              { id: 'system' as ThemePreference, label: 'System', icon: Monitor },
            ].map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setThemePref(opt.id);
                    setTheme(opt.id);
                  }}
                  className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    themePref === opt.id
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingProfile}
            className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg"
          >
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>

      {/* Notification Preferences */}
      <form
        onSubmit={handleSaveNotifications}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
      >
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Notification Preferences
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Choose which workspace events generate real-time notifications for your account.
          </p>
        </div>

        <div className="space-y-2.5 text-xs">
          {[
            {
              label: 'Task assignments',
              checked: notifyAssignments,
              onChange: setNotifyAssignments,
            },
            {
              label: 'Upcoming deadlines & overdue alerts',
              checked: notifyDeadlines,
              onChange: setNotifyDeadlines,
            },
            {
              label: '@Mentions in comments and chat',
              checked: notifyMentions,
              onChange: setNotifyMentions,
            },
            {
              label: 'Comments on tasks I follow',
              checked: notifyComments,
              onChange: setNotifyComments,
            },
          ].map((item) => (
            <label key={item.label} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => item.onChange(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-indigo-600"
              />
              <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingPrefs}
            className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg"
          >
            {savingPrefs ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </form>

      {/* Account Settings */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Account & Security
        </h2>
        <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
          <div>
            Email:{' '}
            <span className="font-mono text-slate-900 dark:text-slate-100">{user?.email}</span>
          </div>
          <div>
            Verification status:{' '}
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Verified</span>
          </div>
        </div>

        {resetSent && (
          <div className="p-3 text-xs bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg text-emerald-700 dark:text-emerald-300">
            Password reset link sent to {user?.email}.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {user?.email && (
            <button
              type="button"
              onClick={async () => {
                await resetPassword(user.email!);
                setResetSent(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Send Password Reset Email
            </button>
          )}
          <button
            type="button"
            onClick={() => logout()}
            className="px-3.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
          >
            Sign Out
          </button>
        </div>
      </section>
    </div>
  );
}
