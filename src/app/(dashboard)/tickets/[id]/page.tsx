interface TicketDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TicketDetailPage({ params }: TicketDetailPageProps) {
  const { id } = await params;

  return (
    <div className="p-8">
      <div className="mb-8">
        <a href="/tickets" className="text-sm text-gray-600 hover:text-black">
          ← Back to tickets
        </a>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Ticket conversation */}
        <div className="col-span-2">
          <div className="bg-white rounded-lg border p-6">
            <h1 className="text-xl font-bold mb-4">Ticket #{id}</h1>
            <div className="border-t pt-4">
              <p className="text-gray-500 text-center py-8">
                Ticket conversation will appear here
              </p>
            </div>
          </div>
        </div>

        {/* AI Draft Panel */}
        <div className="col-span-1">
          <div className="bg-white rounded-lg border p-6 sticky top-8">
            <h2 className="font-semibold mb-4">AI Draft</h2>
            <div className="bg-gray-50 rounded-lg p-4 mb-4 min-h-[200px]">
              <p className="text-gray-500 text-sm">
                AI-generated response will appear here
              </p>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition text-sm">
                Generate Draft
              </button>
              <button className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm">
                Regenerate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
