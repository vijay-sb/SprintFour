import { useEffect } from "react";
import { useTriageStore } from "@/store/useTriageStore";
import { AdminDashboard } from "@/components/AdminDashboard";
import { TriageWorkspace } from "@/components/TriageWorkspace";

function App() {
  const { fetchQueue, loading, error } = useTriageStore();

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  return (
    <div className="dark min-h-screen bg-slate-950 text-slate-100">
      <AdminDashboard />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {loading && (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center space-y-4">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-400 font-mono">Loading priority queue...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center space-y-4">
              <div className="text-4xl">⚠️</div>
              <p className="text-red-400 font-mono text-sm">{error}</p>
              <button
                onClick={() => fetchQueue()}
                className="px-4 py-2 bg-slate-800 text-cyan-400 border border-cyan-500/30 rounded-lg text-sm font-mono hover:bg-slate-700 transition-colors"
              >
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {!loading && !error && <TriageWorkspace />}
      </main>
    </div>
  );
}

export default App;
