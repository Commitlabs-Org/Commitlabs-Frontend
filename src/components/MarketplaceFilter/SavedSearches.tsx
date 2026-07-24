'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Save } from 'lucide-react';
import type { Filters } from '@/hooks/useMarketplaceFilters';
import { useWallet } from '@/hooks/useWallet';

interface SavedSearch {
  id: string;
  name: string;
  filters: Filters;
  createdAt: string;
}

interface SavedSearchesProps {
  filters: Filters;
  onApplyFilters: (filters: Filters) => void;
}

export default function SavedSearches({ filters, onApplyFilters }: SavedSearchesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const { address } = useWallet();

  const loadSavedSearches = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem('sessionToken') || `session_${address}_${Date.now()}`;
      const res = await fetch('/api/user/preferences', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setSavedSearches(data?.data?.preferences?.savedMarketplaceSearches || []);
      }
    } catch (err) {
      console.error('Failed to load saved searches:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadSavedSearches();
  }, [loadSavedSearches]);

  const handleSaveSearch = useCallback(async () => {
    if (!address || !searchName.trim()) return;

    setIsSaving(true);
    try {
      const newSearch: SavedSearch = {
        id: Date.now().toString(),
        name: searchName.trim(),
        filters,
        createdAt: new Date().toISOString(),
      };

      // Check for duplicates - overwrite if name exists
      const existingIndex = savedSearches.findIndex((s) => s.name === searchName.trim());
      let updatedSearches: SavedSearch[];
      if (existingIndex !== -1) {
        updatedSearches = [...savedSearches];
        updatedSearches[existingIndex] = newSearch;
      } else {
        updatedSearches = [...savedSearches, newSearch];
      }

      const token = localStorage.getItem('sessionToken') || `session_${address}_${Date.now()}`;
      await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ savedMarketplaceSearches: updatedSearches }),
      });

      setSavedSearches(updatedSearches);
      setSearchName('');
      setShowSaveInput(false);
    } catch (err) {
      console.error('Failed to save search:', err);
    } finally {
      setIsSaving(false);
    }
  }, [address, searchName, filters, savedSearches]);

  const handleDeleteSearch = useCallback(async (searchId: string) => {
    if (!address) return;

    try {
      const updatedSearches = savedSearches.filter((s) => s.id !== searchId);

      const token = localStorage.getItem('sessionToken') || `session_${address}_${Date.now()}`;
      await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ savedMarketplaceSearches: updatedSearches }),
      });

      setSavedSearches(updatedSearches);
    } catch (err) {
      console.error('Failed to delete search:', err);
    }
  }, [address, savedSearches]);

  return (
    <div className="mb-4 border-b border-white/5 pb-3">
      <button
        type="button"
        className="flex w-full items-center justify-between cursor-pointer py-1.5 bg-transparent border-0 text-left text-white text-sm font-medium"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>Saved Searches</span>
        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {/* Save New Search */}
          {showSaveInput ? (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Search name..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="focus-ring w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-[#51A2FF]/50"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveSearch();
                  if (e.key === 'Escape') {
                    setShowSaveInput(false);
                    setSearchName('');
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveSearch}
                  disabled={isSaving || !searchName.trim()}
                  className="flex-1 flex items-center justify-center gap-1 rounded-md bg-[#51A2FF]/20 border border-[#51A2FF]/40 px-3 py-1.5 text-sm text-[#51A2FF] hover:bg-[#51A2FF]/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <Save size={14} />
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSaveInput(false);
                    setSearchName('');
                  }}
                  className="px-3 py-1.5 text-sm text-white/60 hover:text-white transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSaveInput(true)}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-white/5 border border-white/20 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition"
            >
              <Plus size={16} />
              Save this search
            </button>
          )}

          {/* Saved Searches List */}
          {isLoading ? (
            <div className="text-sm text-white/50 py-2">Loading...</div>
          ) : savedSearches.length === 0 ? (
            <div className="text-sm text-white/50 py-2">No saved searches yet</div>
          ) : (
            <div className="space-y-1">
              {savedSearches.map((search) => (
                <div
                  key={search.id}
                  className="flex items-center justify-between rounded-md hover:bg-white/5 transition"
                >
                  <button
                    type="button"
                    onClick={() => onApplyFilters(search.filters)}
                    className="flex-1 text-left px-2 py-1.5 text-sm text-white/80 hover:text-white transition"
                  >
                    {search.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSearch(search.id)}
                    className="p-1.5 text-white/40 hover:text-red-400 transition"
                    aria-label="Delete search"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
