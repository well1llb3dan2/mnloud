import { useCallback, useRef } from 'react';
import { strainsService } from '../services';

const extractMatches = (data) => {
  if (!data) return [];
  const list = Array.isArray(data?.matches)
    ? data.matches
    : Array.isArray(data?.strains)
    ? data.strains
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.data)
    ? data.data
    : [];
  return list
    .map((item) => (typeof item === 'string' ? { name: item } : item))
    .filter((item) => item?.name);
};

export const useStrainGeneration = ({ setIsSearching, toast } = {}) => {
  const searchCacheRef = useRef(new Map());
  const detailsCacheRef = useRef(new Map());

  const searchMatchesInternal = useCallback(
    async (query, limit = 5, options = {}) => {
      const trimmed = String(query || '').trim();
      if (!trimmed || trimmed.length < 2) return [];

      if (!options.forceRefresh && searchCacheRef.current.has(trimmed)) {
        return searchCacheRef.current.get(trimmed)?.list || [];
      }

      if (options.forceRefresh) {
        searchCacheRef.current.delete(trimmed);
      }

      if (setIsSearching) setIsSearching(true);
      try {
        const data = await strainsService.searchAi({
          q: trimmed,
          limit,
          ...(options.forceRefresh ? { forceRefresh: '1' } : {}),
        });
        const normalized = extractMatches(data);
        searchCacheRef.current.set(trimmed, { list: normalized, sample: normalized[0] || null });
        return normalized;
      } catch (error) {
        return [];
      } finally {
        if (setIsSearching) setIsSearching(false);
      }
    },
    [setIsSearching]
  );

  const fetchDetailsInternal = useCallback(
    async (name, options = {}) => {
      const trimmed = String(name || '').trim();
      if (!trimmed) return null;

      if (!options.forceRefresh && detailsCacheRef.current.has(trimmed)) {
        return detailsCacheRef.current.get(trimmed);
      }

      if (options.forceRefresh) {
        detailsCacheRef.current.delete(trimmed);
      }

      if (setIsSearching) setIsSearching(true);
      try {
        const data = await strainsService.detailsAi({
          name: trimmed,
          ...(options.forceRefresh ? { forceRefresh: '1' } : {}),
        });
        const details = data?.strain || data?.item || data;
        if (!details || !details.name) return null;
        detailsCacheRef.current.set(trimmed, details);
        return details;
      } catch (error) {
        if (toast) {
          toast({ title: 'Strain details failed', status: 'error' });
        }
        return null;
      } finally {
        if (setIsSearching) setIsSearching(false);
      }
    },
    [setIsSearching, toast]
  );

  const generateStrainData = useCallback(
    async (input, options = {}) => {
        const {
          mode = 'details',
          selectedName,
          limit = 5,
          forceRefresh = false,
        } = options;

      const query = String(input || '').trim();
      if (!query) {
        return {
          input: query,
          matches: [],
          selectedName: selectedName || '',
          details: null,
        };
      }

      const matches = await searchMatchesInternal(query, limit, { forceRefresh });
      if (mode === 'matches') {
        return {
          input: query,
          matches,
          selectedName: selectedName || matches[0]?.name || query,
          details: null,
        };
      }

      const resolvedName = selectedName || matches[0]?.name || query;
      const details = await fetchDetailsInternal(resolvedName, { forceRefresh });

      return {
        input: query,
        matches,
        selectedName: resolvedName,
        details,
      };
    },
    [searchMatchesInternal, fetchDetailsInternal]
  );

  return {
    generateStrainData,
  };
};
