"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

type Team = { id: string; name: string; code: string };

export function ChampionSelect({
  teams,
  defaultValue,
  defaultLabel,
  disabled,
  className,
}: {
  teams: Team[];
  defaultValue?: string | null;
  defaultLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(defaultValue ?? null);
  const [selectedLabel, setSelectedLabel] = useState(defaultLabel ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered =
    query.trim() === ""
      ? teams
      : teams.filter(
          (t) =>
            t.name.toLowerCase().includes(query.toLowerCase()) ||
            t.code.toLowerCase().includes(query.toLowerCase())
        );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input type="hidden" name="champion_team_id" value={selectedId ?? ""} />
      <input
        type="text"
        value={open ? query : selectedLabel || query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
          if (selectedId) {
            setSelectedId(null);
            setSelectedLabel("");
          }
        }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        placeholder="Buscar time (nome ou sigla)..."
        className="w-full rounded-lg border border-white/10 bg-primary px-3 py-2 text-foreground placeholder:text-foreground/50 focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green disabled:opacity-50"
        autoComplete="off"
      />
      {open && !disabled && (
        <ul
          className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-white/10 bg-card py-1 shadow-lg"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-foreground/60">Nenhum time encontrado</li>
          ) : (
            filtered.map((team) => (
              <li
                key={team.id}
                role="option"
                aria-selected={selectedId === team.id}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-white/10"
                onClick={() => {
                  setSelectedId(team.id);
                  setSelectedLabel(`${team.name} (${team.code})`);
                  setQuery("");
                  setOpen(false);
                }}
              >
                {team.name} ({team.code})
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
