import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { listArcoRequests, listAuditLogs, resolveArcoRequest } from '../services/superAdminService';
import type { ArcoRequestRow, AuditLogRow } from '../types';

const AuditLogPanel: React.FC<{ onDataChanged?: () => void }> = ({ onDataChanged }) => {
  const [subTab, setSubTab] = useState<'audit' | 'arco'>('audit');
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [arco, setArco] = useState<ArcoRequestRow[]>([]);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [l, a] = await Promise.all([listAuditLogs(150), listArcoRequests()]);
      setLogs(l);
      setArco(a);
    } catch (err: any) {
      setError(err?.message || 'Error cargando auditoría.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) =>
      `${l.actor_email || ''} ${l.actor_name || ''} ${l.action} ${l.entity_type} ${JSON.stringify(l.new_values || {})}`
        .toLowerCase()
        .includes(q)
    );
  }, [logs, search]);

  const handleResolveArco = async (id: string, status: ArcoRequestRow['status']) => {
    try {
      await resolveArcoRequest(id, status);
      await load();
      onDataChanged?.();
    } catch (err: any) {
      setError(err?.message || 'Error actualizando solicitud ARCO.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSubTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
              subTab === 'audit'
                ? 'bg-primary text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Auditoría Inmutable ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('arco')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
              subTab === 'arco'
                ? 'bg-primary text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Solicitudes ARCO / LFPDPPP ({arco.filter((a) => a.status === 'pending').length} pendientes)
          </button>
        </div>

        {subTab === 'audit' && (
          <div className="relative flex-1 max-w-xs min-w-[200px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">
              search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar acción, actor o entidad..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/70 p-3 text-xs font-bold text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-slate-400 text-sm">Cargando registros...</div>
      ) : subTab === 'audit' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[10px] font-black uppercase text-slate-400">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-3">Actor</th>
                  <th className="py-3 px-3">Acción</th>
                  <th className="py-3 px-3">Entidad</th>
                  <th className="py-3 px-4">Detalle (clic para expandir)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      Sin eventos de auditoría encontrados.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isOpen = expandedId === log.id;
                    return (
                      <React.Fragment key={log.id}>
                        <tr
                          onClick={() => setExpandedId(isOpen ? null : log.id)}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('es-MX')}
                          </td>
                          <td className="py-2.5 px-3 font-semibold">
                            {log.actor_email || log.actor_name || 'Sistema'}
                          </td>
                          <td className="py-2.5 px-3">
                            <code className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-[11px] text-primary">
                              {log.action}
                            </code>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{log.entity_type}</td>
                          <td className="py-2.5 px-4 max-w-xs truncate text-slate-400 font-mono text-[10px]">
                            {log.new_values ? JSON.stringify(log.new_values) : '—'}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-slate-50/70 dark:bg-slate-950/60">
                            <td colSpan={5} className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                                {log.old_values && (
                                  <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
                                    <p className="font-sans text-[10px] font-black uppercase text-slate-400 mb-1">
                                      Antes (old_values)
                                    </p>
                                    <pre className="whitespace-pre-wrap break-all text-slate-500 max-h-56 overflow-y-auto">
                                      {JSON.stringify(log.old_values, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                <div
                                  className={`rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 ${
                                    !log.old_values ? 'md:col-span-2' : ''
                                  }`}
                                >
                                  <p className="font-sans text-[10px] font-black uppercase text-emerald-500 mb-1">
                                    Después (new_values)
                                  </p>
                                  <pre className="whitespace-pre-wrap break-all text-slate-700 dark:text-slate-200 max-h-56 overflow-y-auto">
                                    {JSON.stringify(log.new_values || {}, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {arco.length === 0 ? (
            <p className="p-8 text-center text-slate-400">No hay solicitudes ARCO registradas.</p>
          ) : (
            arco.map((req) => (
              <div key={req.id} className="p-4 flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 font-black uppercase text-[10px]">
                      {req.request_type}
                    </span>
                    <span className="font-bold">{req.user_name || req.user_email}</span>
                    <span className="text-slate-400">
                      {new Date(req.created_at).toLocaleDateString('es-MX')}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{req.description}</p>
                </div>
                <select
                  value={req.status}
                  onChange={(e) => handleResolveArco(req.id, e.target.value as any)}
                  className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 font-bold"
                >
                  <option value="pending">Pendiente</option>
                  <option value="in_progress">En proceso</option>
                  <option value="resolved">Resuelta</option>
                  <option value="rejected">Rechazada</option>
                </select>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AuditLogPanel;
