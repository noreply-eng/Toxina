import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_PATHOLOGIES_DATA,
  getPathologyById,
  pathologiesData,
  PATHOLOGIES_UPDATED_EVENT,
  type PathologyData,
} from '../data/pathologyData';
import {
  fetchAllPathologyOverrides,
  getCachedPathologyOverrides,
} from '../services/pathologyProtocols';

export function usePathologies() {
  const [version, setVersion] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, PathologyData>>(() =>
    getCachedPathologyOverrides()
  );
  const [loading, setLoading] = useState(false);

  const syncFromMemory = useCallback(() => {
    setOverrides(getCachedPathologyOverrides());
    setVersion((v) => v + 1);
  }, []);

  const refresh = useCallback(async (force = true) => {
    setLoading(true);
    try {
      const map = await fetchAllPathologyOverrides(force);
      setOverrides(map);
      setVersion((v) => v + 1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchAllPathologyOverrides(false).then((map) => {
      if (mounted) {
        setOverrides(map);
        setVersion((v) => v + 1);
      }
    });

    const handleUpdated = () => {
      if (mounted) syncFromMemory();
    };

    window.addEventListener(PATHOLOGIES_UPDATED_EVENT, handleUpdated);
    return () => {
      mounted = false;
      window.removeEventListener(PATHOLOGIES_UPDATED_EVENT, handleUpdated);
    };
  }, [syncFromMemory]);

  const list = useMemo(() => [...pathologiesData], [version, overrides]);

  const isCustomized = useCallback(
    (id: string) => Boolean(overrides[id]),
    [overrides]
  );

  const isBuiltIn = useCallback(
    (id: string) => DEFAULT_PATHOLOGIES_DATA.some((p) => p.id === id),
    []
  );

  return {
    pathologies: list,
    overrides,
    isCustomized,
    isBuiltIn,
    loading,
    refresh,
  };
}

export function usePathology(id: string | undefined) {
  const { pathologies, isCustomized, isBuiltIn, loading, refresh } = usePathologies();

  const pathology = useMemo(() => {
    if (!id) return undefined;
    return pathologies.find((p) => p.id === id) ?? getPathologyById(id);
  }, [id, pathologies]);

  return {
    pathology,
    isCustomized: id ? isCustomized(id) : false,
    isBuiltIn: id ? isBuiltIn(id) : false,
    loading,
    refresh,
  };
}
