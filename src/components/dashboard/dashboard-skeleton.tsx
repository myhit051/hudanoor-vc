"use client";

/** Skeleton loading screen — replaces the centered spinner */
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header skeleton */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="skeleton h-7 w-40 rounded-md" />
              <div className="skeleton h-4 w-56 rounded-md" />
            </div>
            <div className="flex items-center gap-3">
              <div className="skeleton h-8 w-20 rounded-md" />
              <div className="skeleton h-8 w-8 rounded-full" />
              <div className="skeleton h-8 w-64 rounded-md hidden md:block" />
              <div className="skeleton h-9 w-28 rounded-md hidden md:flex" />
            </div>
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <main className="container mx-auto px-4 py-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-white dark:bg-gray-900 p-5 space-y-3">
              <div className="skeleton h-10 w-10 rounded-lg" />
              <div className="skeleton h-7 w-28 rounded-md" />
              <div className="skeleton h-4 w-20 rounded-md" />
            </div>
          ))}
        </div>

        {/* Monthly chart */}
        <div className="mb-6 rounded-xl border bg-white dark:bg-gray-900 p-6">
          <div className="skeleton h-5 w-40 rounded-md mb-4" />
          <div className="skeleton h-48 w-full rounded-md" />
        </div>

        {/* Sales target */}
        <div className="mb-6 rounded-xl border bg-white dark:bg-gray-900 p-6 flex items-center gap-6">
          <div className="skeleton h-48 w-48 rounded-full" />
          <div className="flex-1 space-y-3">
            <div className="skeleton h-5 w-32 rounded-md" />
            <div className="skeleton h-8 w-40 rounded-md" />
            <div className="skeleton h-4 w-24 rounded-md" />
          </div>
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-white dark:bg-gray-900 p-6">
              <div className="skeleton h-5 w-36 rounded-md mb-4" />
              <div className="skeleton h-48 w-full rounded-md" />
            </div>
          ))}
        </div>

        {/* Recent transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-white dark:bg-gray-900 p-6 space-y-4">
              <div className="skeleton h-5 w-32 rounded-md" />
              {[...Array(5)].map((_, j) => (
                <div key={j} className="flex justify-between items-center py-1">
                  <div className="space-y-1.5">
                    <div className="skeleton h-4 w-36 rounded-md" />
                    <div className="skeleton h-3 w-24 rounded-md" />
                  </div>
                  <div className="space-y-1.5 text-right">
                    <div className="skeleton h-4 w-20 rounded-md" />
                    <div className="skeleton h-3 w-12 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
