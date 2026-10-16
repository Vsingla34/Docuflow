import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssetStore } from '../../store/AssetStore';
import { globalSearch, SearchResult } from '../../lib/globalSearch';
import { PAGE_PATHS } from './nav';
import Icon from '../icons/Icon';

/**
 * One search box that looks across every entity type a user would actually hunt for by name/tag/
 * number — assets, employees, vendors, locations, departments, categories, POs, requisitions,
 * service tickets — instead of each page only filtering its own list. Runs entirely off the
 * already-loaded client state (see lib/globalSearch.ts), so there's no extra round-trip and
 * results appear as you type.
 */
const GlobalSearch: React.FC = () => {
    const { state } = useAssetStore();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const results = globalSearch(state, query);
    const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
        (acc[r.type] = acc[r.type] || []).push(r);
        return acc;
    }, {});

    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
        };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }, []);

    const goTo = (r: SearchResult) => {
        navigate(r.assetId ? `${PAGE_PATHS[r.page]}?asset=${r.assetId}` : PAGE_PATHS[r.page]);
        setOpen(false);
        setQuery('');
    };

    return (
        <div ref={rootRef} className="relative w-full max-w-xs">
            <div className="relative">
                <Icon name="search" className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder="Search assets, people, POs..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                />
            </div>

            {open && query.trim().length >= 2 && (
                <div className="absolute left-0 mt-2 w-96 max-w-[90vw] bg-card border border-border rounded-lg shadow-xl z-30 max-h-[28rem] overflow-y-auto">
                    {results.length === 0 ? (
                        <p className="p-4 text-sm text-text-light">No matches for "{query}".</p>
                    ) : (
                        Object.entries(grouped).map(([type, items]) => (
                            <div key={type}>
                                <div className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-light sticky top-0 bg-card">{type}</div>
                                {items.map(r => (
                                    <button key={`${r.type}-${r.id}`} onClick={() => goTo(r)} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex flex-col">
                                        <span className="text-sm font-medium text-text-main truncate">{r.label}</span>
                                        <span className="text-xs text-text-light truncate">{r.sublabel}</span>
                                    </button>
                                ))}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default GlobalSearch;