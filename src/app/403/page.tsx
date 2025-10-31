// src/app/403/page.tsx
export default function Forbidden() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl text-center space-y-3">
        <h1 className="text-2xl font-semibold">Forbidden</h1>
        <p>You’re signed in, but your account doesn’t have admin access.</p>
      </div>
    </div>
  )
}
