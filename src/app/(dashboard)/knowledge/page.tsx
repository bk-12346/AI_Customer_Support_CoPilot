export default function KnowledgePage() {
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Knowledge Base</h1>
        <button className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition">
          Upload Document
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Zendesk Help Center */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold mb-4">Zendesk Help Center</h2>
          <p className="text-gray-500 text-sm mb-4">
            Articles synced from your Zendesk Help Center
          </p>
          <div className="text-center py-8 text-gray-400">
            <p>No articles synced</p>
          </div>
        </div>

        {/* Uploaded Documents */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold mb-4">Uploaded Documents</h2>
          <p className="text-gray-500 text-sm mb-4">
            Additional documents (PDF, TXT) for context
          </p>
          <div className="text-center py-8 text-gray-400">
            <p>No documents uploaded</p>
          </div>
        </div>
      </div>
    </div>
  );
}
