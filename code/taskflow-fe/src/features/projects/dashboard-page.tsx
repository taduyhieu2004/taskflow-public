import { useQuery } from '@tanstack/react-query';
import { Clock, Filter, Folder, LayoutGrid, List, Plus, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CreateProjectDialog } from '@/features/projects/create-project-dialog';
import { ProjectCard } from '@/features/projects/project-card';
import { projectsApi } from '@/features/projects/projects-api';
import { extractErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const projects = projectsQuery.data ?? [];
  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.key && p.key.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-8">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm text-gray-500">Xin chào, {user?.full_name ?? user?.username}</div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Project của bạn</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setFilterOpen(!filterOpen);
              if (filterOpen) setSearchQuery('');
            }}
            className={cn(
              'px-3 py-2 text-sm border rounded-lg flex items-center gap-2 transition',
              filterOpen
                ? 'bg-primary-50 border-primary-300 text-primary-700 font-medium'
                : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-700',
            )}
          >
            <Filter className="w-4 h-4" /> Lọc
            {searchQuery && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary-600" />
            )}
          </button>
          <div className="bg-white border border-gray-300 rounded-lg p-0.5 flex">
            <button
              className={cn(
                'p-1.5 rounded transition',
                view === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700',
              )}
              onClick={() => setView('grid')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              className={cn(
                'p-1.5 rounded transition',
                view === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700',
              )}
              onClick={() => setView('list')}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <StatCard label="Tổng project" value={projects.length} icon={<Folder className="w-5 h-5" />} color="primary" />
        <StatCard label="Task được giao" value={0} icon={<UserCheck className="w-5 h-5" />} color="amber" />
        <StatCard label="Sắp hết hạn" value={0} icon={<Clock className="w-5 h-5" />} color="rose" />
      </div>

      {filterOpen && (
        <div className="mt-8 mb-4 max-w-md transition-all duration-200">
          <input
            type="text"
            placeholder="Tìm kiếm project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition shadow-sm"
            autoFocus
          />
        </div>
      )}

      <div className="flex items-baseline justify-between mt-10 mb-4">
        <h2 className="text-base font-semibold text-gray-900">Project gần đây</h2>
        {projectsQuery.isFetching && <span className="text-xs text-gray-400">Đang tải…</span>}
      </div>

      {projectsQuery.isError && (
        <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          {extractErrorMessage(projectsQuery.error)}
        </div>
      )}

      {projectsQuery.isLoading ? (
        <SkeletonGrid />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
          {filteredProjects.length === 0 && searchQuery && (
            <div className="col-span-full py-8 text-center text-sm text-gray-400">
              Không tìm thấy project nào khớp với từ khoá.
            </div>
          )}
          <button
            onClick={() => setCreateOpen(true)}
            className="rounded-xl border-2 border-dashed border-gray-300 hover:border-primary-500 hover:bg-primary-50/30 transition p-5 flex flex-col items-center justify-center text-gray-500 hover:text-primary-600 min-h-[180px]"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <span className="mt-3 font-medium">Tạo project mới</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/75 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-3.5">Mã dự án</th>
                  <th className="px-6 py-3.5">Tên dự án</th>
                  <th className="px-6 py-3.5">Mô tả</th>
                  <th className="px-6 py-3.5">Loại</th>
                  <th className="px-6 py-3.5 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProjects.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold bg-primary-50 text-primary-700 uppercase tracking-wider">
                        {p.key ?? p.name.substring(0, 3)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link to={`/projects/${p.id}`} className="text-sm font-semibold text-gray-900 hover:text-primary-600 transition">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate text-sm text-gray-500">
                      {p.description || <span className="text-gray-300 italic">Không có mô tả</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 uppercase">
                        {p.type ?? 'SOFTWARE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link 
                        to={`/projects/${p.id}`}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700 transition"
                      >
                        Vào bảng &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
                {filteredProjects.length === 0 && searchQuery && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                      Không tìm thấy project nào khớp với từ khoá.
                    </td>
                  </tr>
                )}
                <tr>
                  <td colSpan={5} className="px-6 py-4">
                    <button
                      onClick={() => setCreateOpen(true)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-primary-600 transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tạo project mới</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'primary' | 'amber' | 'rose';
}) {
  const bg = { primary: 'bg-primary-50 text-primary-600', amber: 'bg-amber-50 text-amber-600', rose: 'bg-rose-50 text-rose-600' }[color];
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">{label}</div>
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', bg)}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-gray-900 mt-2">{value}</div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
          <div className="w-10 h-10 rounded-lg bg-gray-200" />
          <div className="h-5 bg-gray-200 rounded w-3/4 mt-3" />
          <div className="h-4 bg-gray-100 rounded w-full mt-2" />
          <div className="h-4 bg-gray-100 rounded w-2/3 mt-1" />
          <div className="h-4 bg-gray-100 rounded w-full mt-4" />
        </div>
      ))}
    </div>
  );
}
