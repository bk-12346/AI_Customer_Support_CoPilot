"use client";

import ZendeskIntegration from "@/components/settings/ZendeskIntegration";
import { useAuth } from "@/contexts/AuthContext";

export default function SettingsPage() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-32 mb-8"></div>
          <div className="space-y-6 max-w-2xl">
            <div className="bg-white rounded-lg border p-6 h-48"></div>
            <div className="bg-white rounded-lg border p-6 h-48"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Unable to load profile</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      <div className="space-y-6 max-w-2xl">
        {/* Zendesk Integration */}
        <ZendeskIntegration organizationId={profile.organizationId} />

        {/* Profile Settings */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                defaultValue={profile.name}
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                disabled
                value={profile.email}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <span className="inline-block px-3 py-1 bg-gray-100 rounded-full text-sm capitalize">
                {profile.role}
              </span>
            </div>
          </div>
        </div>

        {/* Organization Settings */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold mb-4">Organization</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Organization Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                defaultValue={profile.organizationName}
                readOnly
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
