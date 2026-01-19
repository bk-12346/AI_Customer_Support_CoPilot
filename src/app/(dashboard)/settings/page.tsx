import ZendeskIntegration from "@/components/settings/ZendeskIntegration";

// For now, use the test organization ID
// In production, this would come from the authenticated user's session
const TEST_ORG_ID = "0a2cf873-9887-4a5c-9544-29b036e8fac5";

export default function SettingsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      <div className="space-y-6 max-w-2xl">
        {/* Zendesk Integration */}
        <ZendeskIntegration organizationId={TEST_ORG_ID} />

        {/* Profile Settings */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                disabled
                placeholder="you@company.com"
              />
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
                placeholder="Your company"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
