import { useNavigate } from 'react-router-dom'

export default function Unauthorized() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <p className="text-6xl font-bold text-slate-200">403</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-800">Access denied</h1>
      <p className="mt-1 text-sm text-slate-500">You don't have permission to view this page.</p>
      <button
        onClick={() => navigate(-1)}
        className="mt-6 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        Go back
      </button>
    </div>
  )
}
