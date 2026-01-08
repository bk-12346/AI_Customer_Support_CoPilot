export default function TicketsPage() {
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Tickets</h1>
        <button className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition">
          Sync from Zendesk
        </button>
      </div>

      {/* Ticket list placeholder */}
      <div className="bg-white rounded-lg border">
        <div className="p-8 text-center text-gray-500">
          <p className="mb-4">No tickets synced yet</p>
          <p className="text-sm">Connect your Zendesk account to start syncing tickets</p>
        </div>
      </div>
    </div>
  );
}
