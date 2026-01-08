export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="absolute top-4 left-4">
        <a href="/" className="text-xl font-bold">
          SupportAI
        </a>
      </div>
      {children}
    </div>
  );
}
