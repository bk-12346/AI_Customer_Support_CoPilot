export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold mb-4">SupportAI</h1>
        <p className="text-xl text-gray-600 mb-8">
          AI-powered co-pilot that helps customer support agents respond faster and more accurately
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/login"
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition"
          >
            Login
          </a>
          <a
            href="/signup"
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Sign Up
          </a>
        </div>
      </div>
    </main>
  );
}
