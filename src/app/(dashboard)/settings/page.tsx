export default function SettingsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      <div className="space-y-6 max-w-2xl">
        {/* Zendesk Integration */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold mb-4">Zendesk Integration</h2>
          <p className="text-gray-500 text-sm mb-4">
            Connect your Zendesk account to sync tickets and help center articles
          </p>
          <button className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition">
            Connect Zendesk
          </button>
        </div>

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
