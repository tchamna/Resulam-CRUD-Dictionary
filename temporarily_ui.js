import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const STORAGE_KEY = 'temporary_ui_entry_v1';
const TOKEN_KEY = 'temporary_ui_access_token';
const REFRESH_KEY = 'temporary_ui_refresh_token';
const ONBOARDING_KEY = 'temporary_ui_onboarding_done';
const charKeys = ['A-', 'A~', 'A>', 'EZ', 'N>I?', 'N"I?', 'N<', 'E?', 'E%'];
const POS_OPTIONS = [
  { value: '', label: 'Select POS...' },
  { value: 'noun', label: 'Noun' },
  { value: 'verb', label: 'Verb' },
  { value: 'adjective', label: 'Adjective' },
  { value: 'adverb', label: 'Adverb' },
  { value: 'pronoun', label: 'Pronoun' },
  { value: 'preposition', label: 'Preposition' },
  { value: 'conjunction', label: 'Conjunction' },
  { value: 'interjection', label: 'Interjection' },
  { value: 'determiner', label: 'Determiner' },
  { value: 'numeral', label: 'Numeral' },
  { value: 'particle', label: 'Particle' },
  { value: 'affix', label: 'Affix' },
  { value: 'other', label: 'Other' }
];
const TRANSLATION_LANGS = [
  { value: 'fr', label: 'French (fr)' },
  { value: 'en', label: 'English (en)' }
];

const DEFAULT_RANDOM_LIMIT = 10;
const PASSWORD_RULES_TEXT = 'Password must be at least 5 characters and include a letter and a number.';
const AUTO_SAVE_IDLE_MS = 3 * 60 * 1000;

const createSense = () => ({
  pos: '',
  definition: '',
  examples: [{ text: '', translation: '' }],
  translations: [{ lang: 'fr', text: '' }],
  relations: [{ type: 'synonym', text: '' }]
});

const normalizeExamples = (examples) => {
  const list = Array.isArray(examples) ? examples : [];
  if (!list.length) return [{ text: '', translation: '' }];
  return list.map((ex) => ({
    text: ex?.text || '',
    translation: ex?.translation || ''
  }));
};

const normalizeTranslations = (translations) => {
  const list = Array.isArray(translations) ? translations : [];
  if (!list.length) return [{ lang: 'fr', text: '' }];
  return list.map((tr) => ({
    lang: tr?.lang || 'fr',
    text: tr?.text || ''
  }));
};

const normalizeRelations = (relations) => {
  const list = Array.isArray(relations) ? relations : [];
  if (!list.length) return [{ type: 'synonym', text: '' }];
  return list.map((rel) => ({
    type: rel?.type || 'synonym',
    text: rel?.text || ''
  }));
};

const mapExamplesFromApi = (examples) => {
  const list = Array.isArray(examples) ? examples : [];
  const mapped = list.map((ex) => ({
    text: ex?.example_text || '',
    translation: ex?.translation_fr || ex?.translation_en || ''
  })).filter((ex) => ex.text || ex.translation);
  return mapped.length ? mapped : [{ text: '', translation: '' }];
};

const mapTranslationsFromApi = (translations) => {
  const list = Array.isArray(translations) ? translations : [];
  const mapped = list.map((tr) => ({
    lang: tr?.lang_code || 'fr',
    text: tr?.translation_text || ''
  })).filter((tr) => tr.text);
  return mapped.length ? mapped : [{ lang: 'fr', text: '' }];
};

const mapRelationsFromApi = (relations) => {
  const list = Array.isArray(relations) ? relations : [];
  const mapped = list.map((rel) => ({
    type: rel?.relation_type || 'synonym',
    text: rel?.fallback_text || ''
  })).filter((rel) => rel.text);
  return mapped.length ? mapped : [{ type: 'synonym', text: '' }];
};

const mapWordEntryToDraft = (entry) => {
  const senses = Array.isArray(entry?.senses) ? entry.senses : [];
  const mappedSenses = senses.length
    ? senses.map((sense) => ({
        pos: sense?.pos || '',
        definition: sense?.definition_text || '',
        examples: mapExamplesFromApi(sense?.examples),
        translations: mapTranslationsFromApi(sense?.translations),
        relations: mapRelationsFromApi(sense?.relations)
      }))
    : [createSense()];

  return {
    entryId: entry?.id || null,
    languageId: entry?.language_id ? String(entry.language_id) : '',
    word: entry?.lemma_raw || '',
    pos: entry?.pos || '',
    pronunciation: entry?.pronunciation || '',
    status: entry?.status || 'draft',
    forms: entry?.notes || '',
    senses: mappedSenses
  };
};

const normalizeSense = (sense) => ({
  pos: sense?.pos || '',
  definition: sense?.definition || '',
  examples: normalizeExamples(sense?.examples),
  translations: normalizeTranslations(sense?.translations),
  relations: normalizeRelations(sense?.relations)
});

const normalizeEntry = (draft) => {
  const senses = Array.isArray(draft?.senses) ? draft.senses : [];
  const normalizedSenses = senses.length ? senses.map(normalizeSense) : [createSense()];
  return {
    entryId: draft?.entryId || null,
    languageId: draft?.languageId || '',
    word: draft?.word || '',
    pos: draft?.pos || '',
    pronunciation: draft?.pronunciation || '',
    status: draft?.status || 'draft',
    forms: draft?.forms || '',
    senses: normalizedSenses
  };
};

const reorderArray = (list, fromIndex, toIndex) => {
  if (fromIndex === toIndex) return list;
  const result = [...list];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
};

const buildPayload = (entry) => {
  const senses = entry.senses
    .map((sense, idx) => {
      if (!sense.definition.trim()) {
        return null;
      }

      const examples = sense.examples
        .map((ex, exIndex) => ({
          example_text: ex.text.trim(),
          translation_fr: ex.translation.trim() || null,
          translation_en: null,
          source: null,
          rank: exIndex + 1,
          id: null
        }))
        .filter((ex) => ex.example_text);

      const translations = sense.translations
        .map((tr, trIndex) => ({
          lang_code: tr.lang.trim() || 'fr',
          translation_text: tr.text.trim(),
          rank: trIndex + 1,
          id: null
        }))
        .filter((tr) => tr.translation_text);

      const relations = sense.relations
        .map((rel, relIndex) => ({
          relation_type: rel.type,
          related_word_entry_id: null,
          fallback_text: rel.text.trim(),
          rank: relIndex + 1,
          id: null
        }))
        .filter((rel) => rel.fallback_text);

      return {
        id: null,
        sense_no: idx + 1,
        pos: sense.pos.trim() || null,
        definition_text: sense.definition.trim(),
        register: null,
        domain: null,
        notes: null,
        examples,
        translations,
        relations
      };
    })
    .filter(Boolean);

  return {
    language_id: Number(entry.languageId),
    lemma_raw: entry.word.trim(),
    pos: entry.pos.trim() || null,
    pronunciation: entry.pronunciation.trim() || null,
    notes: entry.forms.trim() || null,
    status: entry.status,
    senses
  };
};

// --- STYLES ---
const styles = {
  container: {
    maxWidth: '1200px',
    margin: '40px auto',
    fontFamily: '"Sora", "Space Grotesk", sans-serif',
    color: '#1b1f2a',
    padding: '24px',
    display: 'grid',
    gridTemplateColumns: '260px minmax(460px, 1.2fr) minmax(260px, 0.9fr)',
    gap: '24px',
    alignItems: 'stretch',
    alignContent: 'stretch'
  },
  leftMenu: {
    background: 'rgba(248,250,252,0.98)',
    borderRadius: '16px',
    padding: '18px',
    border: '1px solid rgba(23,26,34,0.12)',
    boxShadow: '0 16px 30px rgba(16,20,30,0.12)',
    minHeight: '100%',
    overflow: 'hidden',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignSelf: 'stretch'
  },
  leftMenuCollapsed: {
    padding: '10px 6px',
    alignItems: 'center',
    justifyContent: 'center'
  },
  leftMenuBody: {
    flex: '0 0 auto',
    overflowY: 'auto',
    display: 'grid',
    gap: '14px',
    paddingRight: '4px',
    alignContent: 'start'
  },
  leftMenuFooter: {
    marginTop: '12px'
  },
  leftMenuCollapsedLabel: {
    writingMode: 'vertical-rl',
    transform: 'rotate(180deg)',
    fontWeight: '600',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontSize: '12px',
    color: '#475569'
  },
  formSide: { flex: 1 },
  previewSide: { position: 'sticky', top: '20px', height: 'fit-content' },
  sideStack: { display: 'grid', gap: '18px' },
  card: {
    background: 'rgba(255,255,255,0.92)',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid rgba(23,26,34,0.12)',
    boxShadow: '0 16px 30px rgba(16,20,30,0.12)',
    marginBottom: '20px',
    boxSizing: 'border-box'
  },
  previewCard: {
    maxHeight: 'calc(100vh - 80px)',
    overflowY: 'auto'
  },
  toolbar: {
    background: 'rgba(255,255,255,0.9)',
    padding: '10px',
    borderRadius: '12px',
    marginBottom: '15px',
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    border: '1px solid rgba(23,26,34,0.12)',
    boxShadow: '0 10px 22px rgba(16,20,30,0.08)'
  },
  charBtn: {
    padding: '4px 8px',
    background: '#fff',
    border: '1px solid rgba(23,26,34,0.18)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  sideMenuHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  sideMenuSection: {
    marginBottom: '14px'
  },
  sectionTitle: { margin: '0 0 12px', fontFamily: '"Fraunces", serif', fontSize: '18px' },
  input: {
    width: '100%',
    padding: '11px 12px',
    marginBottom: '10px',
    borderRadius: '10px',
    border: '1px solid rgba(23,26,34,0.16)',
    fontSize: '15px',
    boxSizing: 'border-box',
    minWidth: 0
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '10px'
  },
  rowWide: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 160px) minmax(0, 1fr) auto',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '10px'
  },
  button: {
    padding: '8px 12px',
    background: '#bb5a2a',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  buttonGhost: {
    padding: '8px 12px',
    background: 'rgba(23,26,34,0.06)',
    color: '#1b1f2a',
    border: '1px solid rgba(23,26,34,0.12)',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  buttonDanger: {
    padding: '8px 12px',
    background: '#b23a2b',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  dragHandle: {
    padding: '4px 8px',
    borderRadius: '8px',
    border: '1px dashed rgba(23,26,34,0.2)',
    background: 'rgba(23,26,34,0.04)',
    fontSize: '12px',
    cursor: 'grab'
  },
  subSection: {
    marginTop: '14px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(23,26,34,0.08)'
  },
  previewEntry: { borderLeft: '4px solid #bb5a2a', paddingLeft: '15px' },
  headword: { fontSize: '26px', fontWeight: '700', color: '#1e293b', margin: 0, fontFamily: '"Fraunces", serif' },
  posTag: { fontStyle: 'italic', color: '#64748b', fontSize: '14px' },
  definition: { fontSize: '16px', margin: '10px 0' },
  exampleBox: {
    background: 'rgba(245,246,248,0.9)',
    padding: '8px',
    borderRadius: '8px',
    fontSize: '14px',
    marginTop: '8px',
    borderLeft: '2px solid #cbd5e1'
  },
  previewSense: {
    marginTop: '14px',
    paddingTop: '12px',
    borderTop: '1px dashed rgba(23,26,34,0.2)'
  },
  statusBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '999px',
    background: '#1f6f78',
    color: '#fff',
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  rowSplit: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '10px'
  },
  randomList: {
    display: 'grid',
    gap: '8px',
    maxHeight: '260px',
    overflowY: 'auto',
    paddingRight: '4px'
  },
  randomRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    borderBottom: '1px dashed rgba(23,26,34,0.15)',
    paddingBottom: '6px',
    minWidth: 0
  },
  randomWord: {
    fontWeight: '600',
    fontSize: '14px',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  randomMeta: { fontSize: '12px', color: '#64748b' },
  statusText: {
    fontSize: '13px',
    color: '#475569',
    marginTop: '8px'
  },
  emptyState: {
    border: '1px dashed rgba(23,26,34,0.18)',
    background: 'rgba(245,246,248,0.9)',
    borderRadius: '12px',
    padding: '10px 12px',
    fontSize: '13px',
    color: '#64748b',
    marginTop: '10px'
  },
  topBar: {
    background: 'rgba(255,255,255,0.92)',
    borderRadius: '16px',
    padding: '12px 16px',
    border: '1px solid rgba(23,26,34,0.12)',
    boxShadow: '0 16px 30px rgba(16,20,30,0.12)',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px'
  },
  topBarGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap'
  },
  onboardingWrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px'
  },
  onboardingCard: {
    width: 'min(520px, 100%)',
    background: 'rgba(255,255,255,0.94)',
    borderRadius: '18px',
    padding: '28px',
    border: '1px solid rgba(23,26,34,0.12)',
    boxShadow: '0 20px 40px rgba(16,20,30,0.15)',
    boxSizing: 'border-box'
  },
  onboardingTitle: {
    fontFamily: '"Fraunces", serif',
    fontSize: '26px',
    margin: '0 0 8px'
  },
  onboardingText: {
    color: '#475569',
    fontSize: '14px',
    marginBottom: '18px'
  }
};

const DictionaryApp = () => {
  const [entry, setEntry] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return normalizeEntry(raw ? JSON.parse(raw) : null);
    } catch {
      return normalizeEntry(null);
    }
  });
  const [languages, setLanguages] = useState([]);
  const [accessToken, setAccessToken] = useState(() => {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('access_token') || '';
  });
  const [refreshToken, setRefreshToken] = useState(() => {
    return localStorage.getItem(REFRESH_KEY) || localStorage.getItem('refresh_token') || '';
  });
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirm, setAuthConfirm] = useState('');
  const [authStatus, setAuthStatus] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem(ONBOARDING_KEY) !== 'true';
  });
  const [saveStatus, setSaveStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastFocused, setLastFocused] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [randomWords, setRandomWords] = useState([]);
  const [randomLimit, setRandomLimit] = useState(DEFAULT_RANDOM_LIMIT);
  const [randomLoading, setRandomLoading] = useState(false);
  const [randomError, setRandomError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchStatus, setSearchStatus] = useState('all');
  const [searchLimit, setSearchLimit] = useState(20);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [languageHasEntries, setLanguageHasEntries] = useState(null);
  const [exactMatch, setExactMatch] = useState(false);
  const [leftMenuCollapsed, setLeftMenuCollapsed] = useState(false);
  const [clafricaEnabled, setClafricaEnabled] = useState(true);
  const [clafricaStatus, setClafricaStatus] = useState('');
  const [leftMenuMinHeight, setLeftMenuMinHeight] = useState(null);
  const clafricaMapRef = useRef({});
  const clafricaMaxLenRef = useRef(0);
  const clafricaPrefixesRef = useRef(new Set());
  const formSideRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    } catch {
      // Ignore storage failures (private mode, quota, etc.)
    }
  }, [entry]);

  useEffect(() => {
    if (accessToken) {
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem('access_token', accessToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('access_token');
    }
  }, [accessToken]);

  useEffect(() => {
    if (refreshToken) {
      localStorage.setItem(REFRESH_KEY, refreshToken);
      localStorage.setItem('refresh_token', refreshToken);
    } else {
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem('refresh_token');
    }
  }, [refreshToken]);

  useEffect(() => {
    fetch('/dictionary/clafrica-map')
      .then((res) => res.json())
      .then((data) => {
        if (!data || typeof data !== 'object') {
          setClafricaStatus('Unable to load Clafrica map.');
          return;
        }
        const keys = Object.keys(data).sort((a, b) => b.length - a.length);
        const prefixes = new Set();
        keys.forEach((key) => {
          for (let i = 1; i < key.length; i += 1) {
            prefixes.add(key.slice(0, i));
          }
        });
        clafricaMapRef.current = data;
        clafricaMaxLenRef.current = keys.length ? keys[0].length : 0;
        clafricaPrefixesRef.current = prefixes;
        setClafricaStatus('');
      })
      .catch(() => {
        setClafricaStatus('Unable to load Clafrica map.');
      });
  }, []);

  const loadCurrentUser = async (token) => {
    if (!token) {
      setCurrentUserEmail('');
      return;
    }
    try {
      const response = await fetch('/users/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.email) {
        setCurrentUserEmail(data.email);
      } else {
        setCurrentUserEmail('');
      }
    } catch {
      setCurrentUserEmail('');
    }
  };

  useEffect(() => {
    loadCurrentUser(accessToken);
  }, [accessToken]);

  const markOnboardingDone = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
  };

  const openOnboarding = () => {
    setShowOnboarding(true);
  };

  const clearAutoSaveTimer = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  };

  const scheduleAutoSave = () => {
    clearAutoSaveTimer();
    autoSaveTimerRef.current = setTimeout(async () => {
      if (!dirtyRef.current || isSaving) {
        return;
      }
      const saved = await saveEntry({ auto: true });
      if (saved) {
        await goToNextRandomSuggestion();
      }
    }, AUTO_SAVE_IDLE_MS);
  };

  const markDirty = () => {
    dirtyRef.current = true;
    scheduleAutoSave();
  };

  const resolveRandomLimit = (value) => {
    const rawValue = parseInt(value, 10);
    if (!Number.isFinite(rawValue) || rawValue < 1) {
      return DEFAULT_RANDOM_LIMIT;
    }
    return Math.min(rawValue, 200);
  };

  const resolveSearchLimit = (value) => {
    const rawValue = parseInt(value, 10);
    if (!Number.isFinite(rawValue) || rawValue < 1) {
      return 20;
    }
    return Math.min(rawValue, 200);
  };

  const fetchRandomWords = async (limitOverride) => {
    if (!entry.languageId) {
      setRandomError('Select a language to load suggestions.');
      setRandomWords([]);
      return [];
    }
    const limit = resolveRandomLimit(limitOverride ?? randomLimit);
    setRandomLoading(true);
    setRandomError('');
    try {
      const response = await fetch(`/dictionary/random?language_id=${entry.languageId}&limit=${limit}`);
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        const detail = data?.detail || `Error ${response.status}.`;
        setRandomError(detail);
        setRandomWords([]);
        return [];
      } else if (Array.isArray(data)) {
        setRandomWords(data);
        return data;
      } else {
        setRandomWords([]);
        return [];
      }
    } catch (error) {
      setRandomError(error?.message || 'Failed to load suggestions.');
      setRandomWords([]);
      return [];
    } finally {
      setRandomLoading(false);
    }
  };

  useEffect(() => {
    fetch('/dictionary/languages')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setLanguages(data);
          if (!entry.languageId && data.length) {
            setEntry((prev) => ({ ...prev, languageId: String(data[0].id) }));
          }
        }
      })
      .catch(() => {
        setSaveStatus('Unable to load languages.');
      });
  }, []);

  useEffect(() => {
    if (entry.languageId) {
      setLanguageHasEntries(null);
      fetchRandomWords();
      fetchWordEntries();
    }
  }, [entry.languageId]);

  useEffect(() => {
    if (!formSideRef.current || typeof ResizeObserver === 'undefined') {
      return;
    }
    const updateHeight = () => {
      if (!formSideRef.current) return;
      const height = formSideRef.current.getBoundingClientRect().height;
      if (height && Math.abs((leftMenuMinHeight || 0) - height) > 1) {
        setLeftMenuMinHeight(height);
      }
    };
    const observer = new ResizeObserver(updateHeight);
    observer.observe(formSideRef.current);
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [leftMenuCollapsed, leftMenuMinHeight]);

  const fetchWordEntries = async (options = {}) => {
    if (!entry.languageId) {
      setSearchError('Select a language to search.');
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    setSearchError('');
    const limit = resolveSearchLimit(options.limit ?? searchLimit);
    const params = new URLSearchParams({
      language_id: String(entry.languageId),
      limit: String(limit),
      offset: '0'
    });
    const termValue = options.term ?? searchTerm;
    const trimmedTerm = termValue ? termValue.trim() : '';
    if (trimmedTerm) {
      params.set('search', trimmedTerm);
    }
    const statusValue = options.status ?? searchStatus;
    if (statusValue && statusValue !== 'all') {
      params.set('status', statusValue);
    }
    try {
      const response = await fetch(`/dictionary/word-entries?${params.toString()}`);
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        const detail = data?.detail || `Error ${response.status}.`;
        setSearchError(detail);
        setSearchResults([]);
        setLanguageHasEntries(null);
      } else if (Array.isArray(data)) {
        let list = data;
        const term = trimmedTerm;
        if (exactMatch && term) {
          list = list.filter((row) => row && row.lemma_raw === term);
        }
        setSearchResults(list);
        if (!term && (statusValue === 'all')) {
          setLanguageHasEntries(list.length > 0);
        }
      } else {
        setSearchResults([]);
        setLanguageHasEntries(null);
      }
    } catch (error) {
      setSearchError(error?.message || 'Search failed.');
      setSearchResults([]);
      setLanguageHasEntries(null);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (!entry.languageId) {
      return;
    }
    const timer = setTimeout(() => {
      fetchWordEntries({
        term: searchTerm,
        status: searchStatus,
        limit: searchLimit
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [entry.languageId, searchTerm, searchStatus, searchLimit, exactMatch]);

  const loadWordEntry = async (entryId) => {
    if (!entryId) return;
    setSearchLoading(true);
    setSearchError('');
    try {
      const response = await fetch(`/dictionary/word-entries/${entryId}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        const detail = data?.detail || `Error ${response.status}.`;
        setSearchError(detail);
        return;
      }
      setEntry(mapWordEntryToDraft(data));
      dirtyRef.current = false;
      clearAutoSaveTimer();
    } catch (error) {
      setSearchError(error?.message || 'Failed to load entry.');
    } finally {
      setSearchLoading(false);
    }
  };

  const updateEntryField = (field, value) => {
    markDirty();
    setEntry((prev) => ({ ...prev, [field]: value }));
  };

  const updateSense = (senseIndex, updater) => {
    markDirty();
    setEntry((prev) => {
      const senses = prev.senses.map((sense, idx) => (idx === senseIndex ? updater(sense) : sense));
      return { ...prev, senses };
    });
  };

  const updateExample = (senseIndex, exampleIndex, field, value) => {
    updateSense(senseIndex, (sense) => {
      const examples = sense.examples.map((ex, idx) => (idx === exampleIndex ? { ...ex, [field]: value } : ex));
      return { ...sense, examples };
    });
  };

  const updateTranslation = (senseIndex, translationIndex, field, value) => {
    updateSense(senseIndex, (sense) => {
      const translations = sense.translations.map((tr, idx) =>
        idx === translationIndex ? { ...tr, [field]: value } : tr
      );
      return { ...sense, translations };
    });
  };

  const updateRelation = (senseIndex, relationIndex, field, value) => {
    updateSense(senseIndex, (sense) => {
      const relations = sense.relations.map((rel, idx) =>
        idx === relationIndex ? { ...rel, [field]: value } : rel
      );
      return { ...sense, relations };
    });
  };

  const addSense = () => {
    markDirty();
    setEntry((prev) => ({ ...prev, senses: [...prev.senses, createSense()] }));
  };

  const removeSense = (senseIndex) => {
    markDirty();
    setEntry((prev) => {
      if (prev.senses.length === 1) return prev;
      const senses = prev.senses.filter((_, idx) => idx !== senseIndex);
      return { ...prev, senses };
    });
  };

  const addExample = (senseIndex) => {
    updateSense(senseIndex, (sense) => ({
      ...sense,
      examples: [...sense.examples, { text: '', translation: '' }]
    }));
  };

  const removeExample = (senseIndex, exampleIndex) => {
    updateSense(senseIndex, (sense) => {
      const examples = sense.examples.filter((_, idx) => idx !== exampleIndex);
      return { ...sense, examples: examples.length ? examples : [{ text: '', translation: '' }] };
    });
  };

  const addTranslation = (senseIndex) => {
    updateSense(senseIndex, (sense) => ({
      ...sense,
      translations: [...sense.translations, { lang: 'en', text: '' }]
    }));
  };

  const removeTranslation = (senseIndex, translationIndex) => {
    updateSense(senseIndex, (sense) => {
      const translations = sense.translations.filter((_, idx) => idx !== translationIndex);
      return { ...sense, translations: translations.length ? translations : [{ lang: 'fr', text: '' }] };
    });
  };

  const addRelation = (senseIndex) => {
    updateSense(senseIndex, (sense) => ({
      ...sense,
      relations: [...sense.relations, { type: 'synonym', text: '' }]
    }));
  };

  const removeRelation = (senseIndex, relationIndex) => {
    updateSense(senseIndex, (sense) => {
      const relations = sense.relations.filter((_, idx) => idx !== relationIndex);
      return { ...sense, relations: relations.length ? relations : [{ type: 'synonym', text: '' }] };
    });
  };

  const storeFocus = (payload) => (event) => {
    setLastFocused({ el: event.target, ...payload });
  };

  const applyFocusedValue = (value) => {
    if (!lastFocused) return;
    if (lastFocused.kind === 'entry') {
      updateEntryField(lastFocused.field, value);
    } else if (lastFocused.kind === 'sense') {
      updateSense(lastFocused.senseIndex, (sense) => ({ ...sense, [lastFocused.field]: value }));
    } else if (lastFocused.kind === 'example') {
      updateExample(lastFocused.senseIndex, lastFocused.exampleIndex, lastFocused.field, value);
    } else if (lastFocused.kind === 'translation') {
      updateTranslation(lastFocused.senseIndex, lastFocused.translationIndex, lastFocused.field, value);
    } else if (lastFocused.kind === 'relation') {
      updateRelation(lastFocused.senseIndex, lastFocused.relationIndex, lastFocused.field, value);
    }
  };

  const insertChar = (char) => {
    if (!lastFocused || !lastFocused.el) return;
    const el = lastFocused.el;
    const start = Number.isFinite(el.selectionStart) ? el.selectionStart : el.value.length;
    const end = Number.isFinite(el.selectionEnd) ? el.selectionEnd : el.value.length;
    const newValue = `${el.value.slice(0, start)}${char}${el.value.slice(end)}`;
    applyFocusedValue(newValue);
    setTimeout(() => {
      if (el.setSelectionRange) {
        const pos = start + char.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const updateFieldFromPayload = (payload, value) => {
    if (payload.kind === 'entry') {
      updateEntryField(payload.field, value);
      return;
    }
    if (payload.kind === 'sense') {
      updateSense(payload.senseIndex, (sense) => ({ ...sense, [payload.field]: value }));
      return;
    }
    if (payload.kind === 'example') {
      updateExample(payload.senseIndex, payload.exampleIndex, payload.field, value);
      return;
    }
    if (payload.kind === 'translation') {
      updateTranslation(payload.senseIndex, payload.translationIndex, payload.field, value);
      return;
    }
    if (payload.kind === 'relation') {
      updateRelation(payload.senseIndex, payload.relationIndex, payload.field, value);
      return;
    }
    if (payload.kind === 'search') {
      setSearchTerm(value);
    }
  };

  const applyClafricaToken = (token, allowPartialAtEnd) => {
    const map = clafricaMapRef.current || {};
    const maxLen = clafricaMaxLenRef.current || 0;
    if (!maxLen) {
      return token;
    }
    let output = '';
    let i = 0;
    const prefixes = clafricaPrefixesRef.current || new Set();
    while (i < token.length) {
      let matched = false;
      const maxSlice = Math.min(maxLen, token.length - i);
      for (let len = maxSlice; len > 0; len -= 1) {
        const chunk = token.slice(i, i + len);
        const replacement = map[chunk];
        if (replacement) {
          if (allowPartialAtEnd && i + len === token.length && prefixes.has(chunk)) {
            break;
          }
          output += replacement;
          i += len;
          matched = true;
          break;
        }
      }
      if (!matched) {
        output += token[i];
        i += 1;
      }
    }
    return output;
  };

  const applyClafricaOnInputValue = (value, cursor) => {
    if (!clafricaEnabled) {
      return null;
    }
    const safeCursor = Number.isFinite(cursor) ? cursor : value.length;
    const left = value.slice(0, safeCursor);
    const right = value.slice(safeCursor);
    const match = left.match(/(\S+)$/);
    if (!match) {
      return null;
    }
    const token = match[1];
    const replacement = applyClafricaToken(token, true);
    if (!replacement || replacement === token) {
      return null;
    }
    const newLeft = left.slice(0, -token.length) + replacement;
    return { value: newLeft + right, cursor: newLeft.length };
  };

  const applyClafricaOnSpaceValue = (value, cursor) => {
    if (!clafricaEnabled) {
      return null;
    }
    const safeCursor = Number.isFinite(cursor) ? cursor : value.length;
    const before = value.slice(0, safeCursor);
    const after = value.slice(safeCursor);
    const match = before.match(/(\S+)$/);
    if (!match) {
      return null;
    }
    const token = match[1];
    const replacement = applyClafricaToken(token, false);
    if (!replacement || replacement === token) {
      return null;
    }
    const newBefore = before.slice(0, -token.length) + replacement + ' ';
    return { value: newBefore + after, cursor: newBefore.length };
  };

  const handleTextKeyDown = (payload) => (event) => {
    if (!clafricaEnabled || event.key !== ' ') {
      return;
    }
    const target = event.target;
    const replacement = applyClafricaOnSpaceValue(target.value, target.selectionStart);
    if (!replacement) {
      return;
    }
    event.preventDefault();
    updateFieldFromPayload(payload, replacement.value);
    setTimeout(() => {
      if (target.setSelectionRange) {
        target.setSelectionRange(replacement.cursor, replacement.cursor);
      }
    }, 0);
  };

  const handleTextChange = (payload) => (event) => {
    const target = event.target;
    const rawValue = target.value;
    const replacement = applyClafricaOnInputValue(rawValue, target.selectionStart);
    if (replacement) {
      updateFieldFromPayload(payload, replacement.value);
      setTimeout(() => {
        if (target.setSelectionRange) {
          target.setSelectionRange(replacement.cursor, replacement.cursor);
        }
      }, 0);
      return;
    }
    updateFieldFromPayload(payload, rawValue);
  };

  const handleDragStart = (payload) => (event) => {
    event.dataTransfer.effectAllowed = 'move';
    setDragState(payload);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnd = () => {
    setDragState(null);
  };

  const handleDropSense = (targetIndex) => (event) => {
    event.preventDefault();
    if (!dragState || dragState.type !== 'sense') return;
    markDirty();
    setEntry((prev) => ({ ...prev, senses: reorderArray(prev.senses, dragState.senseIndex, targetIndex) }));
    setDragState(null);
  };

  const handleDropExample = (senseIndex, targetIndex) => (event) => {
    event.preventDefault();
    if (!dragState || dragState.type !== 'example' || dragState.senseIndex !== senseIndex) return;
    markDirty();
    updateSense(senseIndex, (sense) => ({
      ...sense,
      examples: reorderArray(sense.examples, dragState.itemIndex, targetIndex)
    }));
    setDragState(null);
  };

  const handleDropTranslation = (senseIndex, targetIndex) => (event) => {
    event.preventDefault();
    if (!dragState || dragState.type !== 'translation' || dragState.senseIndex !== senseIndex) return;
    markDirty();
    updateSense(senseIndex, (sense) => ({
      ...sense,
      translations: reorderArray(sense.translations, dragState.itemIndex, targetIndex)
    }));
    setDragState(null);
  };

  const handleDropRelation = (senseIndex, targetIndex) => (event) => {
    event.preventDefault();
    if (!dragState || dragState.type !== 'relation' || dragState.senseIndex !== senseIndex) return;
    markDirty();
    updateSense(senseIndex, (sense) => ({
      ...sense,
      relations: reorderArray(sense.relations, dragState.itemIndex, targetIndex)
    }));
    setDragState(null);
  };

  const resetEntryForLemma = (lemma) => {
    dirtyRef.current = false;
    clearAutoSaveTimer();
    setEntry((prev) => ({
      entryId: null,
      languageId: prev.languageId,
      word: lemma,
      pos: '',
      pronunciation: '',
      status: 'draft',
      forms: '',
      senses: [createSense()]
    }));
  };

  const lookupWordEntryId = async (lemma, languageId) => {
    if (!lemma || !languageId) {
      return null;
    }
    try {
      const params = new URLSearchParams({
        language_id: String(languageId),
        search: lemma,
        limit: '20',
        offset: '0'
      });
      const response = await fetch(`/dictionary/word-entries?${params.toString()}`);
      const data = await response.json().catch(() => []);
      if (response.ok && Array.isArray(data)) {
        const exact = data.find((row) => row.lemma_raw === lemma);
        return exact?.id || null;
      }
    } catch {
      return null;
    }
    return null;
  };

  const applyRandomWord = async (wordRow) => {
    const lemma = (wordRow?.word || '').trim();
    if (!lemma) {
      return;
    }
    resetEntryForLemma(lemma);
    const entryId = await lookupWordEntryId(lemma, entry.languageId);
    if (entryId) {
      setEntry((prev) => ({ ...prev, entryId }));
    }
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    if (!authEmail.trim() || !authPassword) {
      setAuthStatus('Email and password are required.');
      return;
    }
    if (authMode === 'register' && authPassword !== authConfirm) {
      setAuthStatus('Passwords do not match.');
      return;
    }
    setAuthBusy(true);
    setAuthStatus('');
    try {
      const endpoint = authMode === 'register' ? '/auth/register' : '/auth/login';
      const payload = authMode === 'register'
        ? { email: authEmail.trim(), password: authPassword, confirm_password: authConfirm }
        : { email: authEmail.trim(), password: authPassword };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = data?.detail || `Auth failed (${response.status}).`;
        setAuthStatus(detail);
        return;
      }
      if (authMode === 'register') {
        setAuthStatus('Account created. You can log in now.');
        setAuthMode('login');
        setAuthPassword('');
        setAuthConfirm('');
        return;
      }
      setAccessToken(data.access_token || '');
      setRefreshToken(data.refresh_token || '');
      markOnboardingDone();
      setAuthPassword('');
      setAuthConfirm('');
      setAuthStatus('Logged in.');
    } catch (error) {
      setAuthStatus(error?.message || 'Auth failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = () => {
    setAccessToken('');
    setRefreshToken('');
    setCurrentUserEmail('');
    setAuthStatus('Logged out. You can still contribute anonymously.');
  };

  const handleContinueAnonymous = () => {
    markOnboardingDone();
    setAuthStatus('');
  };

  const goToNextRandomSuggestion = async () => {
    if (!entry.languageId) {
      return;
    }
    let nextRow = null;
    if (randomWords.length) {
      nextRow = randomWords.find((row) => row.word !== entry.word) || randomWords[0];
      setRandomWords((prev) => prev.filter((row) => row.id !== nextRow.id));
    }
    if (!nextRow) {
      const fetched = await fetchRandomWords(1);
      if (!Array.isArray(fetched) || !fetched.length) {
        return;
      }
      nextRow = fetched[0];
    }
    await applyRandomWord(nextRow);
  };

  const saveEntry = async (options = {}) => {
    const auto = Boolean(options.auto);
    if (!entry.languageId) {
      if (!auto) {
        setSaveStatus('Select a language before saving.');
      }
      return false;
    }
    if (!entry.word.trim()) {
      if (!auto) {
        setSaveStatus('Lemma is required before saving.');
      }
      return false;
    }

    const sensesWithDefs = entry.senses.filter((sense) => sense.definition.trim());
    if (!sensesWithDefs.length) {
      if (!auto) {
        setSaveStatus('Add at least one sense with a definition.');
      }
      return false;
    }

    const payload = buildPayload(entry);
    if (!payload.senses.length) {
      if (!auto) {
        setSaveStatus('Add at least one sense with a definition.');
      }
      return false;
    }

    setIsSaving(true);
    setSaveStatus(auto ? 'Auto-saving...' : 'Saving...');

    const headers = {
      'Content-Type': 'application/json'
    };
    const token = accessToken || localStorage.getItem('access_token') || '';
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const attemptSave = async (url, method) => {
      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      return { response, data };
    };

    try {
      let url = '/dictionary/word-entries';
      let method = 'POST';
      let saved = false;

      if (entry.entryId) {
        url = `/dictionary/word-entries/${entry.entryId}`;
        method = 'PUT';
      }

      let result = await attemptSave(url, method);

      if (result.response.status === 409) {
        const searchParams = new URLSearchParams({
          language_id: entry.languageId,
          search: entry.word.trim(),
          limit: '10',
          offset: '0'
        });
        const lookup = await fetch(`/dictionary/word-entries?${searchParams.toString()}`);
        const lookupData = await lookup.json().catch(() => []);
        if (Array.isArray(lookupData)) {
          const exact = lookupData.find((row) => row.lemma_raw === entry.word.trim());
          if (exact) {
            result = await attemptSave(`/dictionary/word-entries/${exact.id}`, 'PUT');
          }
        }
      }

      if (!result.response.ok) {
        const detail = result.data?.detail || result.data?.message || `Save failed (${result.response.status}).`;
        setSaveStatus(detail);
      } else {
        setSaveStatus(auto ? 'Auto-saved.' : 'Saved to database.');
        setEntry((prev) => ({ ...prev, entryId: result.data.id || prev.entryId }));
        dirtyRef.current = false;
        clearAutoSaveTimer();
        saved = true;
        if (!auto) {
          await goToNextRandomSuggestion();
        }
      }
      return saved;
    } catch (error) {
      setSaveStatus(error.message || 'Save failed.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const noSearchResults = !searchLoading && !searchError && searchResults.length === 0;
  const noRandomResults = !randomLoading && !randomError && randomWords.length === 0;
  const noSeedList = languageHasEntries === false;
  const searchEmptyMessage = searchTerm
    ? 'No matches found.'
    : (noSeedList ? 'No word list seeded for this language yet.' : 'No entries found.');
  const randomEmptyMessage = noSeedList
    ? 'No word list seeded for this language yet.'
    : 'No undefined words found.';

  const containerStyle = leftMenuCollapsed
    ? { ...styles.container, gridTemplateColumns: '60px minmax(0, 1.6fr) minmax(220px, 0.6fr)' }
    : styles.container;

  const handleFormSideClick = () => {
    if (!leftMenuCollapsed) {
      setLeftMenuCollapsed(true);
    }
  };

  if (showOnboarding) {
    return (
      <div style={styles.onboardingWrap}>
        <div style={styles.onboardingCard}>
          <h1 style={styles.onboardingTitle}>Welcome</h1>
          <p style={styles.onboardingText}>
            You can contribute without logging in. Create an account to track your contributions.
          </p>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <button style={styles.button} onClick={handleContinueAnonymous}>
              Continue without account
            </button>
            <button style={styles.buttonGhost} onClick={() => setAuthMode('login')}>
              Log in
            </button>
            <button style={styles.buttonGhost} onClick={() => setAuthMode('register')}>
              Sign up
            </button>
          </div>
          <form onSubmit={handleAuthSubmit}>
            <input
              style={styles.input}
              type="email"
              placeholder="Email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
            />
            <input
              style={styles.input}
              type="password"
              placeholder="Password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
            />
            <div style={styles.statusText}>{PASSWORD_RULES_TEXT}</div>
            {authMode === 'register' && (
              <input
                style={styles.input}
                type="password"
                placeholder="Confirm password"
                value={authConfirm}
                onChange={(e) => setAuthConfirm(e.target.value)}
              />
            )}
            <button style={styles.button} type="submit" disabled={authBusy}>
              {authBusy ? 'Please wait...' : authMode === 'register' ? 'Create account' : 'Log in'}
            </button>
            {authStatus && <div style={styles.statusText}>{authStatus}</div>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div
        style={{
          ...styles.leftMenu,
          ...(leftMenuMinHeight ? { minHeight: `${leftMenuMinHeight}px` } : {}),
          ...(leftMenuCollapsed ? styles.leftMenuCollapsed : {})
        }}
        onClick={() => {
          if (leftMenuCollapsed) {
            setLeftMenuCollapsed(false);
          }
        }}
      >
        {leftMenuCollapsed ? (
          <div style={styles.leftMenuCollapsedLabel}>Tools</div>
        ) : (
          <>
            <div style={styles.sideMenuHeader}>
              <strong>Tools</strong>
            </div>
            <div style={styles.leftMenuBody}>
              <div style={styles.sideMenuSection}>
                <h3 style={styles.sectionTitle}>Language</h3>
                <select
                  style={styles.input}
                  value={entry.languageId}
                  onChange={(e) => updateEntryField('languageId', e.target.value)}
                >
                  <option value="">Select language...</option>
                  {languages.map((lang) => (
                    <option key={lang.id} value={String(lang.id)}>{lang.name}</option>
                  ))}
                </select>
              </div>
              <div style={styles.sideMenuSection}>
                <label style={styles.randomMeta}>
                  <input
                    type="checkbox"
                    checked={clafricaEnabled}
                    onChange={(e) => setClafricaEnabled(e.target.checked)}
                  />{' '}
                  Enable Clafrica input
                </label>
                {clafricaStatus && <div style={styles.statusText}>{clafricaStatus}</div>}
              </div>
              {noSeedList ? (
                <div style={styles.emptyState}>
                  This language has no seeded word list yet. You can still add new entries from the editor.
                </div>
              ) : (
                <>
                  <div style={styles.sideMenuSection}>
                    <h3 style={styles.sectionTitle}>Search and list</h3>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <p style={{ ...styles.randomMeta, margin: 0 }}>Find entries and load them into the editor.</p>
                      <label style={{ ...styles.randomMeta, margin: 0, whiteSpace: 'nowrap' }}>
                        <input
                          type="checkbox"
                          checked={exactMatch}
                          onChange={(e) => setExactMatch(e.target.checked)}
                        />{' '}
                        Exact match
                      </label>
                    </div>
                    <input
                      style={styles.input}
                      placeholder="Search lemma"
                      value={searchTerm}
                      onKeyDown={handleTextKeyDown({ kind: 'search' })}
                      onChange={handleTextChange({ kind: 'search' })}
                    />
                    <select
                      style={styles.input}
                      value={searchStatus}
                      onChange={(e) => setSearchStatus(e.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                    </select>
                    <input
                      type="number"
                      min="1"
                      max="200"
                      style={styles.input}
                      value={searchLimit}
                      onChange={(e) => setSearchLimit(resolveSearchLimit(e.target.value))}
                    />
                    {searchError && <div style={styles.statusText}>{searchError}</div>}
                    {noSearchResults && (
                      <div style={styles.emptyState}>
                        {searchEmptyMessage}
                        {searchTerm ? (
                          <button
                            style={{ ...styles.buttonGhost, marginLeft: '8px' }}
                            onClick={() => resetEntryForLemma(searchTerm)}
                          >
                            Create entry
                          </button>
                        ) : null}
                      </div>
                    )}
                    {searchResults.length > 0 && (
                      <div style={styles.randomList}>
                        {searchResults.map((row) => {
                          const senses = Array.isArray(row.senses) ? row.senses : [];
                          const definedCount = senses.filter((sense) => {
                            const text = sense && sense.definition_text ? String(sense.definition_text).trim() : '';
                            return text.length > 0;
                          }).length;
                          const metaText = definedCount
                            ? `defined, ${definedCount} sense${definedCount === 1 ? '' : 's'}`
                            : 'not defined';
                          const normalized = Math.min(definedCount, 6) / 6;
                          const lightness = Math.round(85 - normalized * 35);
                          const openStyle = definedCount
                            ? {
                                ...styles.buttonGhost,
                                background: `hsl(140, 45%, ${lightness}%)`,
                                borderColor: `hsl(140, 35%, ${Math.max(lightness - 10, 35)}%)`,
                                color: '#0f2d1c'
                              }
                            : styles.buttonGhost;
                          const actionLabel = definedCount ? 'Modify' : 'Define';
                          return (
                            <div key={`entry-${row.id}`} style={styles.randomRow}>
                              <div>
                                <div style={styles.randomWord}>{row.lemma_raw}</div>
                                <div style={styles.randomMeta}>{metaText}</div>
                              </div>
                              <button style={openStyle} onClick={() => loadWordEntry(row.id)}>{actionLabel}</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div style={styles.sideMenuSection}>
                    <h3 style={styles.sectionTitle}>Random suggestions</h3>
                    <p style={styles.randomMeta}>Pick a word and start defining it.</p>
                    <div style={styles.rowSplit}>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        style={styles.input}
                        value={randomLimit}
                        onChange={(e) => setRandomLimit(resolveRandomLimit(e.target.value))}
                      />
                      <button style={styles.buttonGhost} onClick={() => fetchRandomWords()}>
                        {randomLoading ? 'Loading...' : `Next ${resolveRandomLimit(randomLimit)}`}
                      </button>
                    </div>
                    {randomError && <div style={styles.statusText}>{randomError}</div>}
                    {noRandomResults && (
                      <div style={styles.emptyState}>{randomEmptyMessage}</div>
                    )}
                    {randomWords.length > 0 && (
                      <div style={styles.randomList}>
                        {randomWords.map((row) => (
                          <div key={`random-${row.id}`} style={styles.randomRow}>
                            <span style={styles.randomWord}>{row.word}</span>
                            <button style={styles.buttonGhost} onClick={() => applyRandomWord(row)}>Define</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div style={styles.leftMenuFooter}>
              <input
                type="password"
                name="token"
                style={styles.input}
                placeholder="Access token (optional)"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
            </div>
          </>
        )}
      </div>
      <div style={styles.formSide} onClick={handleFormSideClick} ref={formSideRef}>
        <div style={styles.topBar}>
          <div style={styles.topBarGroup}>
            <span style={styles.randomMeta}>
              {currentUserEmail ? `Signed in as ${currentUserEmail}` : 'Anonymous'}
            </span>
            {currentUserEmail ? (
              <button style={styles.buttonGhost} onClick={handleLogout}>Log out</button>
            ) : (
              <button style={styles.buttonGhost} onClick={openOnboarding}>Log in / Sign up</button>
            )}
          </div>
        </div>
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Word Entry</h3>
          <input
            name="word"
            style={styles.input}
            placeholder="Lemma / Headword"
            value={entry.word}
            onFocus={storeFocus({ kind: 'entry', field: 'word' })}
            onKeyDown={handleTextKeyDown({ kind: 'entry', field: 'word' })}
            onChange={handleTextChange({ kind: 'entry', field: 'word' })}
          />
          <select
            style={styles.input}
            value={entry.pos}
            onChange={(e) => updateEntryField('pos', e.target.value)}
          >
            {POS_OPTIONS.map((option) => (
              <option key={`entry-pos-${option.value}`} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input
            name="pronunciation"
            style={styles.input}
            placeholder="Pronunciation"
            value={entry.pronunciation}
            onFocus={storeFocus({ kind: 'entry', field: 'pronunciation' })}
            onKeyDown={handleTextKeyDown({ kind: 'entry', field: 'pronunciation' })}
            onChange={handleTextChange({ kind: 'entry', field: 'pronunciation' })}
          />
          <select
            style={styles.input}
            value={entry.status}
            onChange={(e) => updateEntryField('status', e.target.value)}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          <input
            name="forms"
            style={styles.input}
            placeholder="Other forms (plural, variant, alt spelling)"
            value={entry.forms}
            onFocus={storeFocus({ kind: 'entry', field: 'forms' })}
            onKeyDown={handleTextKeyDown({ kind: 'entry', field: 'forms' })}
            onChange={handleTextChange({ kind: 'entry', field: 'forms' })}
          />
        </div>

        {entry.senses.map((sense, senseIndex) => (
          <div
            key={`sense-${senseIndex}`}
            style={styles.card}
            onDragOver={handleDragOver}
            onDrop={handleDropSense(senseIndex)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={styles.dragHandle}
                  draggable
                  onDragStart={handleDragStart({ type: 'sense', senseIndex })}
                  onDragEnd={handleDragEnd}
                >
                  Drag
                </span>
                <h3 style={styles.sectionTitle}>Sense {senseIndex + 1}</h3>
              </div>
              <button style={styles.buttonDanger} onClick={() => removeSense(senseIndex)} disabled={entry.senses.length === 1}>Remove</button>
            </div>
            <select
              style={styles.input}
              value={sense.pos}
              onChange={(e) => updateSense(senseIndex, (prev) => ({ ...prev, pos: e.target.value }))}
            >
              {POS_OPTIONS.map((option) => (
                <option key={`sense-${senseIndex}-pos-${option.value}`} value={option.value}>{option.label}</option>
              ))}
            </select>
            <textarea
              style={{ ...styles.input, minHeight: '70px' }}
              placeholder="Definition"
              value={sense.definition}
              onFocus={storeFocus({ kind: 'sense', senseIndex, field: 'definition' })}
              onKeyDown={handleTextKeyDown({ kind: 'sense', senseIndex, field: 'definition' })}
              onChange={handleTextChange({ kind: 'sense', senseIndex, field: 'definition' })}
            />

            <div style={styles.subSection}>
              <h4 style={{ margin: '0 0 10px' }}>Examples (drag to reorder)</h4>
              {sense.examples.map((ex, exIndex) => (
                <div
                  key={`ex-${senseIndex}-${exIndex}`}
                  style={styles.row}
                  draggable
                  onDragStart={handleDragStart({ type: 'example', senseIndex, itemIndex: exIndex })}
                  onDragOver={handleDragOver}
                  onDrop={handleDropExample(senseIndex, exIndex)}
                  onDragEnd={handleDragEnd}
                >
                  <input
                    style={styles.input}
                    placeholder="Example"
                    value={ex.text}
                    onFocus={storeFocus({ kind: 'example', senseIndex, exampleIndex: exIndex, field: 'text' })}
                    onKeyDown={handleTextKeyDown({ kind: 'example', senseIndex, exampleIndex: exIndex, field: 'text' })}
                    onChange={handleTextChange({ kind: 'example', senseIndex, exampleIndex: exIndex, field: 'text' })}
                  />
                  <input
                    style={styles.input}
                    placeholder="Example translation"
                    value={ex.translation}
                    onFocus={storeFocus({ kind: 'example', senseIndex, exampleIndex: exIndex, field: 'translation' })}
                    onKeyDown={handleTextKeyDown({ kind: 'example', senseIndex, exampleIndex: exIndex, field: 'translation' })}
                    onChange={handleTextChange({ kind: 'example', senseIndex, exampleIndex: exIndex, field: 'translation' })}
                  />
                  <button style={styles.buttonGhost} onClick={() => removeExample(senseIndex, exIndex)}>Remove</button>
                </div>
              ))}
              <button style={styles.button} onClick={() => addExample(senseIndex)}>+ Add Example</button>
            </div>

            <div style={styles.subSection}>
              <h4 style={{ margin: '0 0 10px' }}>Translations (drag to reorder)</h4>
              {sense.translations.map((tr, trIndex) => (
                <div
                  key={`tr-${senseIndex}-${trIndex}`}
                  style={styles.row}
                  draggable
                  onDragStart={handleDragStart({ type: 'translation', senseIndex, itemIndex: trIndex })}
                  onDragOver={handleDragOver}
                  onDrop={handleDropTranslation(senseIndex, trIndex)}
                  onDragEnd={handleDragEnd}
                >
                  <select
                    style={styles.input}
                    value={tr.lang}
                    onChange={(e) => updateTranslation(senseIndex, trIndex, 'lang', e.target.value)}
                  >
                    {TRANSLATION_LANGS.map((lang) => (
                      <option key={`sense-${senseIndex}-lang-${trIndex}-${lang.value}`} value={lang.value}>{lang.label}</option>
                    ))}
                  </select>
                  <input
                    style={styles.input}
                    placeholder="Translation"
                    value={tr.text}
                    onFocus={storeFocus({ kind: 'translation', senseIndex, translationIndex: trIndex, field: 'text' })}
                    onKeyDown={handleTextKeyDown({ kind: 'translation', senseIndex, translationIndex: trIndex, field: 'text' })}
                    onChange={handleTextChange({ kind: 'translation', senseIndex, translationIndex: trIndex, field: 'text' })}
                  />
                  <button style={styles.buttonGhost} onClick={() => removeTranslation(senseIndex, trIndex)}>Remove</button>
                </div>
              ))}
              <button style={styles.button} onClick={() => addTranslation(senseIndex)}>+ Add Translation</button>
            </div>

            <div style={styles.subSection}>
              <h4 style={{ margin: '0 0 10px' }}>Relations (drag to reorder)</h4>
              {sense.relations.map((rel, relIndex) => (
                <div
                  key={`rel-${senseIndex}-${relIndex}`}
                  style={styles.rowWide}
                  draggable
                  onDragStart={handleDragStart({ type: 'relation', senseIndex, itemIndex: relIndex })}
                  onDragOver={handleDragOver}
                  onDrop={handleDropRelation(senseIndex, relIndex)}
                  onDragEnd={handleDragEnd}
                >
                  <select
                    style={styles.input}
                    value={rel.type}
                    onChange={(e) => updateRelation(senseIndex, relIndex, 'type', e.target.value)}
                  >
                    <option value="synonym">Synonym</option>
                    <option value="antonym">Antonym</option>
                    <option value="homonym">Homonym</option>
                    <option value="variant">Variant</option>
                    <option value="hypernym">Hypernym</option>
                    <option value="hyponym">Hyponym</option>
                  </select>
                  <input
                    style={styles.input}
                    placeholder="Related word"
                    value={rel.text}
                    onFocus={storeFocus({ kind: 'relation', senseIndex, relationIndex: relIndex, field: 'text' })}
                    onKeyDown={handleTextKeyDown({ kind: 'relation', senseIndex, relationIndex: relIndex, field: 'text' })}
                    onChange={handleTextChange({ kind: 'relation', senseIndex, relationIndex: relIndex, field: 'text' })}
                  />
                  <button style={styles.buttonGhost} onClick={() => removeRelation(senseIndex, relIndex)}>Remove</button>
                </div>
              ))}
              <button style={styles.button} onClick={() => addRelation(senseIndex)}>+ Add Relation</button>
            </div>
          </div>
        ))}

        <div style={styles.card}>
          <button style={styles.button} onClick={addSense}>+ Add Sense</button>
          <button style={{ ...styles.buttonGhost, marginLeft: '10px' }} onClick={saveEntry} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Entry'}
          </button>
          {saveStatus && <div style={styles.statusText}>{saveStatus}</div>}
        </div>
      </div>

      <div style={styles.previewSide}>
        <div style={{ ...styles.card, ...styles.previewCard }}>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            Visitor View Preview
          </p>
          <div style={styles.previewEntry}>
            <h2 style={styles.headword}>{entry.word || '---'}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '6px 0' }}>
              <span style={styles.posTag}>{entry.pos || 'pos'}</span>
              <span style={styles.statusBadge}>{entry.status || 'draft'}</span>
            </div>
            {entry.pronunciation && (
              <p style={{ color: '#64748b', fontSize: '14px', margin: '6px 0' }}>/{entry.pronunciation}/</p>
            )}
            {entry.forms && (
              <p style={{ color: '#475569', fontSize: '14px', margin: '6px 0' }}>
                <strong>Forms:</strong> {entry.forms}
              </p>
            )}

            {entry.senses.map((sense, senseIndex) => (
              <div key={`preview-${senseIndex}`} style={styles.previewSense}>
                <div style={{ fontWeight: '600', marginBottom: '6px' }}>
                  Sense {senseIndex + 1}{sense.pos ? ` - ${sense.pos}` : ''}
                </div>
                <p style={styles.definition}>{sense.definition || 'No definition yet...'}</p>

                {sense.translations.filter((tr) => tr.text).length > 0 && (
                  <p style={{ margin: '6px 0', color: '#1f6f78', fontWeight: '600' }}>
                    {sense.translations
                      .filter((tr) => tr.text)
                      .map((tr) => `${tr.lang || 'lang'}: ${tr.text}`)
                      .join(' | ')}
                  </p>
                )}

                {sense.examples.map((ex, exIndex) =>
                  ex.text ? (
                    <div key={`preview-ex-${senseIndex}-${exIndex}`} style={styles.exampleBox}>
                      <strong>Ex:</strong> {ex.text} <br />
                      {ex.translation && <span style={{ color: '#64748b' }}>{'->'} {ex.translation}</span>}
                    </div>
                  ) : null
                )}

                {sense.relations.filter((rel) => rel.text).length > 0 && (
                  <p style={{ marginTop: '10px', fontSize: '14px' }}>
                    <strong>Relations:</strong>{' '}
                    {sense.relations
                      .filter((rel) => rel.text)
                      .map((rel) => `${rel.type}: ${rel.text}`)
                      .join(' | ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const rootEl = document.getElementById('temporary-root');
if (rootEl) {
  createRoot(rootEl).render(<DictionaryApp />);
}
