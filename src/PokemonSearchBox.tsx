import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  fetchPokemonNames,
  fetchPokemonSuggestions,
  findPokemonMatches,
  formatName,
  normalizeSuggestionQuery,
} from "./pokemon";

interface PokemonSearchBoxProps {
  id: string;
  label: string;
  placeholder: string;
  onSelect: (name: string) => void;
  buttonLabel?: string;
  compact?: boolean;
}

export function PokemonSearchBox({
  id,
  label,
  placeholder,
  onSelect,
  buttonLabel = "Search",
  compact = false,
}: PokemonSearchBoxProps) {
  const [query, setQuery] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [namesError, setNamesError] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [prefixResult, setPrefixResult] = useState<{ query: string; matches: string[] }>({ query: "", matches: [] });
  const normalizedQuery = normalizeSuggestionQuery(query);
  const fuzzyMatches = useMemo(() => findPokemonMatches(query, names), [query, names]);
  // Trie prefix results first (fast); fall back to fuzzy matching for typos
  const prefixMatches = prefixResult.query === normalizedQuery ? prefixResult.matches : [];
  const suggestions = prefixMatches.length > 0 ? prefixMatches : fuzzyMatches;

  useEffect(() => {
    if (!normalizedQuery) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchPokemonSuggestions(normalizedQuery, controller.signal)
        .then((matches) => setPrefixResult({ query: normalizedQuery, matches }))
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setPrefixResult({ query: normalizedQuery, matches: [] });
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedQuery]);

  useEffect(() => {
    if (!query.trim()) {
      setNamesError(false);
      return;
    }

    let active = true;
    fetchPokemonNames()
      .then((pokemonNames) => {
        if (active) {
          setNames(pokemonNames);
          setNamesError(false);
        }
      })
      .catch(() => {
        if (active) setNamesError(true);
      });

    return () => { active = false; };
  }, [query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setSuggestionsOpen(false);
    onSelect(value);
  }

  function choose(name: string) {
    setQuery(formatName(name));
    setSuggestionsOpen(false);
    onSelect(name);
  }

  return (
    <form className={`pokemon-search ${compact ? "pokemon-search-compact" : ""}`} onSubmit={submit} role="search">
      <label className="sr-only" htmlFor={id}>{label}</label>
      <span className="search-icon" aria-hidden="true">⌕</span>
      <input
        id={id}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSuggestionsOpen(true);
        }}
        onFocus={() => setSuggestionsOpen(true)}
        onBlur={() => setSuggestionsOpen(false)}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={suggestionsOpen && suggestions.length > 0}
        aria-controls={`${id}-suggestions`}
      />
      <button type="submit">{buttonLabel}<span aria-hidden="true">↗</span></button>
      {suggestionsOpen && suggestions.length > 0 && (
        <ul className="search-suggestions" id={`${id}-suggestions`} role="listbox">
          {suggestions.map((name) => (
            <li key={name} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected="false"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(name)}
              >
                <span>{formatName(name)}</span>
                <small>{name}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {namesError && query.trim() && <span className="search-index-error">Suggestions unavailable</span>}
    </form>
  );
}