export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-8">
          Sign in to SupportAI
        </h1>
        <form className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              placeholder="you@company.com"
              required
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition"
          >
            Sign In
          </button>
        </form>
        <p className="text-center mt-4 text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="text-black underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
