import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const APP_VERSION = 'v1.0.22';
const STORAGE_KEY = 'artpay_persistent_data';
const LEGACY_STORAGE_KEYS = [
  'artpay_data_v17',
  'artpay_data_v16',
  'artpay_data_v15',
  'artpay_data_v14',
  'artpay_data_v13',
  'artpay_data_v12',
  'artpay_data_v11',
  'artpay_data_v10',
  'artpay_data_v9',
  'artpay_data_v8',
  'artpay_data_v7',
];

const DEFAULT_DATA = {
  userName: '',
  theme: 'dark', // 'dark' | 'light' | 'system'
  currency: 'COP', // 'COP' | 'USD' | 'EUR' | 'MXN' | 'GBP'
  accounts: [],
  categories: [],
  debts: [],
  transactions: [],
  wishes: [],
  subscriptions: [],
  quickAmounts: [],
  firstOpenedAt: null,
  lastBackupAt: null,
  onboardingDismissed: false,
  skipCategoryDeleteConfirm: false,
  skipAccountDeleteConfirm: false,
  skipDebtDeleteConfirm: false,
};

const CURRENCY_OPTIONS = [
  { code: 'COP', label: 'COP — Peso colombiano' },
  { code: 'USD', label: 'USD — Dólar estadounidense' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'MXN', label: 'MXN — Peso mexicano' },
  { code: 'GBP', label: 'GBP — Libra esterlina' },
];

const ICON_OPTIONS = [
  { id: 'none', label: 'Sin ícono' },
  { id: 'car', label: 'Carro' },
  { id: 'food', label: 'Comida / Almuerzo' },
  { id: 'home', label: 'Casa' },
  { id: 'phone', label: 'Teléfono' },
  { id: 'gift', label: 'Regalo' },
];

const ALLOWED_ICON_IDS = new Set(ICON_OPTIONS.map((i) => i.id));

const CategoryGlyph = ({ iconId, size = 16, color = 'currentColor' }) => {
  if (!iconId || iconId === 'none' || !ALLOWED_ICON_IDS.has(iconId)) return null;

  switch (iconId) {
    case 'car':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 17h14v-5l-2-5H7L5 12v5z" />
          <circle cx="7.5" cy="17" r="1.5" />
          <circle cx="16.5" cy="17" r="1.5" />
          <path d="M5 12h14" />
        </svg>
      );
    case 'food':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 2v20" />
          <path d="M4 2v6a3 3 0 0 0 6 0V2" />
          <path d="M17 2v20" />
          <path d="M17 2c2.5 0 4 2 4 5s-1.5 5-4 5" />
        </svg>
      );
    case 'home':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.5L12 3l9 7.5" />
          <path d="M5 9.5V20h14V9.5" />
          <path d="M10 20v-6h4v6" />
        </svg>
      );
    case 'phone':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="2" width="12" height="20" rx="2.5" />
          <line x1="11" y1="18" x2="13" y2="18" />
        </svg>
      );
    case 'gift':
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="8" width="18" height="4" rx="1" />
          <path d="M12 8v13" />
          <path d="M19 12v9H5v-9" />
          <path d="M12 8c0-2.5-2-4-4-4s-3 1.2-3 2.5S6.5 8 12 8z" />
          <path d="M12 8c0-2.5 2-4 4-4s3 1.2 3 2.5S17.5 8 12 8z" />
        </svg>
      );
  }
};

const formatMoneyByCurrency = (value, currency = 'COP') => {
  const num = Number(value) || 0;
  const localeMap = {
    COP: 'es-CO',
    USD: 'en-US',
    EUR: 'es-ES',
    MXN: 'es-MX',
    GBP: 'en-GB',
  };
  return new Intl.NumberFormat(localeMap[currency] || 'es-CO', {
    style: 'currency',
    currency: currency || 'COP',
    maximumFractionDigits: currency === 'COP' || currency === 'MXN' ? 0 : 2,
  }).format(num);
};

const parseMoneyInput = (str) => {
  const cleaned = String(str).replace(/[^\d]/g, '');
  return cleaned ? Number(cleaned) : 0;
};

const formatMoneyInput = (str) => {
  const cleaned = String(str).replace(/[^\d]/g, '');
  if (!cleaned) return '';
  return Number(cleaned).toLocaleString('es-CO');
};

const getLocalDayKey = (dateObj = new Date()) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getBackupStampFilePart = (dateObj = new Date()) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const mm = String(dateObj.getMinutes()).padStart(2, '0');
  const ss = String(dateObj.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}_${hh}-${mm}-${ss}`;
};

const formatDayHeading = (isoOrKey) => {
  if (!isoOrKey) return 'Fecha desconocida';
  const datePart = isoOrKey.length === 10 ? isoOrKey : isoOrKey.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return datePart;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const formatDateTimeLabel = (isoStr) => {
  if (!isoStr) return '';
  const dt = new Date(isoStr);
  if (Number.isNaN(dt.getTime())) return '';
  const datePart = dt.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timePart = dt.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} • ${timePart}`;
};

const getStatsPeriodSubtitle = (period, dayKey) => {
  const [y, m, d] = String(dayKey || '').split('-').map(Number);
  const baseDate = y && m && d ? new Date(y, m - 1, d) : new Date();

  if (period === 'dia') {
    const dayStr = baseDate.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'long',
    });
    return `Hoy ${dayStr}`;
  }

  if (period === 'semana') {
    const startWeek = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 6);
    const startStr = startWeek.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
    const endStr = baseDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
    return `Semana del ${startStr} al ${endStr}`;
  }

  const monthName = baseDate.toLocaleDateString('es-CO', { month: 'long' });
  return `Mes de ${monthName}`;
};

const getNextBillingDate = (billingDay, nowDate = new Date()) => {
  const safeDay = Math.max(1, Math.min(31, Number(billingDay) || 1));
  const year = nowDate.getFullYear();
  const month = nowDate.getMonth();
  const maxDayInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const dayThisMonth = Math.min(safeDay, maxDayInCurrentMonth);

  const candidate = new Date(year, month, dayThisMonth, 23, 59, 59);
  const todayStart = new Date(year, month, nowDate.getDate(), 0, 0, 0);

  if (candidate >= todayStart) {
    return new Date(year, month, dayThisMonth);
  }
  const nextMonthMaxDay = new Date(year, month + 2, 0).getDate();
  return new Date(year, month + 1, Math.min(safeDay, nextMonthMaxDay));
};

const getNextMonthCycleDate = (billingDay, fromDate = new Date()) => {
  const safeDay = Math.max(1, Math.min(31, Number(billingDay) || 1));
  const year = fromDate.getFullYear();
  const nextMonth = fromDate.getMonth() + 1;
  const maxDayNext = new Date(year, nextMonth + 1, 0).getDate();
  return new Date(year, nextMonth, Math.min(safeDay, maxDayNext));
};

const normalizeStoredData = (parsed) => ({
  ...DEFAULT_DATA,
  ...parsed,
  currency: parsed.currency || 'COP',
  firstOpenedAt: parsed.firstOpenedAt || new Date().toISOString(),
  lastBackupAt: parsed.lastBackupAt || null,
  onboardingDismissed: Boolean(parsed.onboardingDismissed),
  accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
  debts: Array.isArray(parsed.debts) ? parsed.debts : [],
  transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
  wishes: Array.isArray(parsed.wishes) ? parsed.wishes : [],
  subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
  quickAmounts: Array.isArray(parsed.quickAmounts)
    ? parsed.quickAmounts
        .map((n) => Number(n) || 0)
        .filter((n) => n > 0)
        .slice(0, 5)
    : [],
  categories: Array.isArray(parsed.categories)
    ? parsed.categories.map((c) => {
        if (typeof c === 'string') {
          return { id: c, name: c, icon: 'none', subcategories: [] };
        }
        const iconId = ALLOWED_ICON_IDS.has(c.icon) ? c.icon : 'none';
        const subs = Array.isArray(c.subcategories)
          ? c.subcategories.filter((s) => typeof s === 'string' && s.trim())
          : [];
        return {
          id: c.id || String(Date.now()),
          name: c.name,
          icon: iconId,
          subcategories: subs,
        };
      })
    : [],
});

const getNativeMapHref = (lat, lng) => {
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || '';
    const isApple = /iPhone|iPad|iPod|Macintosh/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    if (isApple) {
      return `maps://?ll=${lat},${lng}&q=${lat},${lng}`;
    }
    if (isAndroid) {
      return `geo:${lat},${lng}?q=${lat},${lng}`;
    }
  }
  return `https://www.google.com/maps?q=${lat},${lng}`;
};

const buildMiniMapEmbedUrl = (lat, lng) => {
  const delta = 0.0045;
  const minLng = (lng - delta).toFixed(6);
  const minLat = (lat - delta).toFixed(6);
  const maxLng = (lng + delta).toFixed(6);
  const maxLat = (lat + delta).toFixed(6);
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${lat}%2C${lng}`;
};

const captureCurrentLocation = () =>
  new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ ok: false, error: 'Tu navegador no soporta geolocalización.' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        const embedUrl = buildMiniMapEmbedUrl(lat, lng);
        let placeLabel = '';

        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 3500);
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
            { signal: ctrl.signal }
          );
          clearTimeout(timer);
          if (resp.ok) {
            const geoJson = await resp.json();
            const addr = geoJson.address || {};
            const parts = [
              addr.amenity || addr.shop || addr.building || addr.road,
              addr.suburb || addr.neighbourhood || addr.city_district,
              addr.city || addr.town || addr.village,
            ].filter(Boolean);
            placeLabel = parts.slice(0, 3).join(', ');
          }
        } catch {
          // Si no hay red o falla el geocoding inverso, se conservan las coordenadas y el mapa
        }

        resolve({
          ok: true,
          location: {
            lat,
            lng,
            label: placeLabel || `${lat}, ${lng}`,
            mapUrl,
            embedUrl,
          },
        });
      },
      (err) => {
        let msg = 'No se pudo obtener la ubicación.';
        if (err && err.code === 1) {
          msg = 'Permiso de ubicación denegado. Actívalo en el navegador si deseas guardarla.';
        } else if (err && err.code === 3) {
          msg = 'Se agotó el tiempo al buscar la ubicación.';
        }
        resolve({ ok: false, error: msg });
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      }
    );
  });

export default function App() {
  const [data, setData] = useState(() => {
    try {
      const directSaved = localStorage.getItem(STORAGE_KEY);
      if (directSaved) {
        return normalizeStoredData(JSON.parse(directSaved));
      }
      for (let i = 0; i < LEGACY_STORAGE_KEYS.length; i += 1) {
        const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEYS[i]);
        if (legacyRaw) {
          const migrated = normalizeStoredData(JSON.parse(legacyRaw));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return { ...DEFAULT_DATA, firstOpenedAt: new Date().toISOString() };
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystemPrefersDark(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    } else {
      mq.addListener(onChange);
      return () => mq.removeListener(onChange);
    }
  }, []);

  // Control del día actual para reiniciar a las 12:00 a. m. (00:00)
  const [currentDayKey, setCurrentDayKey] = useState(() => getLocalDayKey(new Date()));

  useEffect(() => {
    const syncMidnight = () => {
      const nowKey = getLocalDayKey(new Date());
      setCurrentDayKey((prev) => (prev !== nowKey ? nowKey : prev));
    };
    const interval = setInterval(syncMidnight, 30000);
    return () => clearInterval(interval);
  }, []);

  // Pestañas: 'inicio' | 'movimientos' | 'estadisticas' | 'suscripciones' | 'deseos' | 'config'
  const [activeTab, setActiveTab] = useState('inicio');
  const [hideBalances, setHideBalances] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountsExpanded, setAccountsExpanded] = useState(true);

  // Transferencias entre cuentas
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferError, setTransferError] = useState('');

  // Filtros en Todos los movimientos
  const [txFilterType, setTxFilterType] = useState('todos'); // 'todos' | 'ingreso' | 'gasto'
  const [txFilterAccountId, setTxFilterAccountId] = useState('todas');

  // Detalle de movimiento al tocarlo
  const [selectedTxDetail, setSelectedTxDetail] = useState(null);

  // Apartado/modal dedicado de Deudas + selección de deuda para abonar al tocarla
  const [showDebtSectionModal, setShowDebtSectionModal] = useState(false);
  const [selectedDebtForPayment, setSelectedDebtForPayment] = useState(null);
  const [debtPayInput, setDebtPayInput] = useState('');
  const [debtPayAccountId, setDebtPayAccountId] = useState('');
  const [debtPayFeedback, setDebtPayFeedback] = useState('');

  // Vista/modal de PDF con botón para regresar
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);

  const [celebrationBanner, setCelebrationBanner] = useState('');
  const [noAccountAlert, setNoAccountAlert] = useState(false);

  // Confirmaciones obligatorias
  const [txToDelete, setTxToDelete] = useState(null);
  const [subToDelete, setSubToDelete] = useState(null);
  const [subToChargeConfirm, setSubToChargeConfirm] = useState(null);
  const [wishToDelete, setWishToDelete] = useState(null);

  // Filtro de rango en Estadísticas: 'dia' | 'semana' | 'mes'
  const [statsPeriod, setStatsPeriod] = useState('dia');

  // Gestos de deslizamiento horizontal para abrir/cerrar menú lateral
  const swipeStartX = useRef(null);
  const swipeStartY = useRef(null);

  const handleScreenTouchStart = (e) => {
    const t = e.touches[0];
    swipeStartX.current = t.clientX;
    swipeStartY.current = t.clientY;
  };

  const handleScreenTouchEnd = (e) => {
    if (swipeStartX.current === null || swipeStartY.current === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipeStartX.current;
    const dy = Math.abs(t.clientY - swipeStartY.current);
    const startX = swipeStartX.current;
    swipeStartX.current = null;
    swipeStartY.current = null;

    if (dy < 60) {
      if (!drawerOpen && dx > 75 && startX < 65) {
        setDrawerOpen(true);
      } else if (drawerOpen && dx < -70) {
        setDrawerOpen(false);
      }
    }
  };

  // Modal de nuevo movimiento (con subcategoría opcional y ubicación opcional)
  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState('gasto');
  const [txAmount, setTxAmount] = useState('');
  const [txAccount, setTxAccount] = useState('');
  const [txCategoryId, setTxCategoryId] = useState('');
  const [txCategoryName, setTxCategoryName] = useState('');
  const [txCategoryIcon, setTxCategoryIcon] = useState('none');
  const [txSubcategoryName, setTxSubcategoryName] = useState('');
  const [txSaveLocation, setTxSaveLocation] = useState(false);
  const [txLocationStatus, setTxLocationStatus] = useState('');
  const [txSavingLocation, setTxSavingLocation] = useState(false);
  const [txNote, setTxNote] = useState('');
  const [txError, setTxError] = useState('');

  // Secciones en Configuración: solo Perfil y moneda y Apariencia abiertas por defecto
  const [openSections, setOpenSections] = useState({
    perfil: true,
    apariencia: true,
    cuentas: false,
    categorias: false,
    deudas: false,
    editarSuscripciones: false,
    editarDeseos: false,
  });

  // Secciones en Estadísticas: abiertas por defecto
  const [openStats, setOpenStats] = useState({
    gastosCat: true,
    ingresosCat: true,
  });

  // Inputs y avisos de validación en Configuración y Deseos
  const [newAccName, setNewAccName] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [accFormAlert, setAccFormAlert] = useState('');
  const [newQuickAmount, setNewQuickAmount] = useState('');
  const [quickAmountAlert, setQuickAmountAlert] = useState('');

  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('none');
  const [catFormAlert, setCatFormAlert] = useState('');
  const [subcatDraftByCatId, setSubcatDraftByCatId] = useState({});

  const [newDebtName, setNewDebtName] = useState('');
  const [newDebtAmount, setNewDebtAmount] = useState('');
  const [debtFormAlert, setDebtFormAlert] = useState('');

  const [configNotice, setConfigNotice] = useState('');

  // Confirmaciones de borrado en Configuración
  const [catToDelete, setCatToDelete] = useState(null);
  const [showReenableCatPrompt, setShowReenableCatPrompt] = useState(false);
  const [accToDelete, setAccToDelete] = useState(null);
  const [showReenableAccPrompt, setShowReenableAccPrompt] = useState(false);
  const [debtToDelete, setDebtToDelete] = useState(null);
  const [showReenableDebtPrompt, setShowReenableDebtPrompt] = useState(false);

  // Suscripciones
  const [subName, setSubName] = useState('');
  const [subPrice, setSubPrice] = useState('');
  const [subBillingDay, setSubBillingDay] = useState('12');
  const [subAccountId, setSubAccountId] = useState('');
  const [subError, setSubError] = useState('');

  // Inputs y reordenamiento de Deseos
  const [wishName, setWishName] = useState('');
  const [wishPrice, setWishPrice] = useState('');
  const [wishFormAlert, setWishFormAlert] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const touchStartY = useRef(0);
  const touchIndex = useRef(null);
  const importInputRef = useRef(null);

  useEffect(() => {
    try {
      if (!data.firstOpenedAt) {
        setData((prev) => ({ ...prev, firstOpenedAt: new Date().toISOString() }));
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error(e);
    }
  }, [data]);

  useEffect(() => {
    if (data.accounts.length > 0) {
      if (!subAccountId) setSubAccountId(data.accounts[0].id);
      if (!debtPayAccountId) setDebtPayAccountId(data.accounts[0].id);
      if (!transferFromId) setTransferFromId(data.accounts[0].id);
      if (!transferToId) {
        const second = data.accounts[1] || data.accounts[0];
        setTransferToId(second.id);
      }
    }
  }, [data.accounts, subAccountId, debtPayAccountId, transferFromId, transferToId]);

  const isDark = data.theme === 'system' ? systemPrefersDark : data.theme === 'dark';
  const currency = data.currency || 'COP';

  useEffect(() => {
    const rootBg = isDark ? '#040507' : '#F4F6F9';
    document.documentElement.style.backgroundColor = rootBg;
    document.body.style.backgroundColor = rootBg;
    document.body.style.margin = '0';

    const themeMeta = document.getElementById('theme-color-meta');
    const appleMeta = document.getElementById('apple-status-bar-meta');
    if (themeMeta) {
      themeMeta.setAttribute('content', rootBg);
    }
    if (appleMeta) {
      appleMeta.setAttribute('content', isDark ? 'black-translucent' : 'default');
    }
  }, [isDark]);

  const needsWeeklyBackupReminder = useMemo(() => {
    const referenceDate = data.lastBackupAt || data.firstOpenedAt;
    if (!referenceDate) return false;
    const refTime = new Date(referenceDate).getTime();
    if (Number.isNaN(refTime)) return false;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - refTime >= sevenDaysMs;
  }, [data.lastBackupAt, data.firstOpenedAt]);

  const { totalAvailable, totalDebts, todayIncome, todayExpense } = useMemo(() => {
    const avail = data.accounts.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);
    const debts = data.debts.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
    let inc = 0;
    let exp = 0;
    for (let i = 0; i < data.transactions.length; i += 1) {
      const t = data.transactions[i];
      if (t.date && getLocalDayKey(new Date(t.date)) === currentDayKey) {
        if (t.type === 'ingreso') inc += Number(t.amount) || 0;
        else if (t.type === 'gasto') exp += Number(t.amount) || 0;
      }
    }
    return { totalAvailable: avail, totalDebts: debts, todayIncome: inc, todayExpense: exp };
  }, [data.accounts, data.debts, data.transactions, currentDayKey]);

  const toggleSection = useCallback((key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleStat = useCallback((key) => {
    setOpenStats((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const openOnlySectionInConfig = (targetKey) => {
    setSelectedDebtForPayment(null);
    setShowDebtSectionModal(false);
    setActiveTab('config');
    setOpenSections({
      perfil: false,
      apariencia: false,
      cuentas: false,
      categorias: false,
      deudas: false,
      editarSuscripciones: false,
      editarDeseos: false,
      [targetKey]: true,
    });
  };

  const goToAddCategory = () => {
    setShowTxModal(false);
    setDrawerOpen(false);
    openOnlySectionInConfig('categorias');
  };

  const goToAddAccount = () => {
    setNoAccountAlert(false);
    setDrawerOpen(false);
    openOnlySectionInConfig('cuentas');
  };

  // --- Transferencias entre cuentas ---
  const openTransferDialog = () => {
    if (data.accounts.length < 2) {
      setTransferError('Necesitas al menos 2 cuentas creadas para transferir entre ellas.');
      setTransferAmount('');
      setShowTransferModal(true);
      return;
    }
    const firstId = data.accounts[0].id;
    const secondId = data.accounts[1].id;
    setTransferFromId(firstId);
    setTransferToId(secondId);
    setTransferAmount('');
    setTransferError('');
    setShowTransferModal(true);
  };

  const handleExecuteTransfer = (e) => {
    e.preventDefault();
    setTransferError('');
    if (data.accounts.length < 2) {
      setTransferError('Agrega otra cuenta en Configuración para realizar transferencias.');
      return;
    }
    if (!transferFromId || !transferToId || transferFromId === transferToId) {
      setTransferError('Elige una cuenta de origen y una cuenta de destino diferentes.');
      return;
    }
    const amt = parseMoneyInput(transferAmount);
    if (!amt || amt <= 0) {
      setTransferError('Escribe un valor mayor a 0 para transferir.');
      return;
    }
    const fromAcc = data.accounts.find((a) => a.id === transferFromId);
    const toAcc = data.accounts.find((a) => a.id === transferToId);
    if (!fromAcc || !toAcc) return;

    if (amt > (Number(fromAcc.balance) || 0)) {
      setTransferError(
        `No hay saldo suficiente en ${fromAcc.name} (${formatMoneyByCurrency(fromAcc.balance, currency)}).`
      );
      return;
    }

    const updatedAccounts = data.accounts.map((a) => {
      if (a.id === fromAcc.id) {
        return { ...a, balance: Math.max(0, (Number(a.balance) || 0) - amt) };
      }
      if (a.id === toAcc.id) {
        return { ...a, balance: (Number(a.balance) || 0) + amt };
      }
      return a;
    });

    const transferTx = {
      id: Date.now().toString(),
      type: 'transferencia',
      amount: amt,
      accountId: fromAcc.id,
      accountName: `${fromAcc.name} → ${toAcc.name}`,
      categoryName: 'Transferencia entre cuentas',
      subcategoryName: '',
      categoryIcon: 'none',
      note: `De ${fromAcc.name} a ${toAcc.name}`,
      location: null,
      date: new Date().toISOString(),
    };

    setData((prev) => ({
      ...prev,
      accounts: updatedAccounts,
      transactions: [transferTx, ...prev.transactions],
    }));
    setShowTransferModal(false);
  };

  // --- Abonar tocando una deuda ---
  const openPayForDebt = (debt) => {
    if (selectedDebtForPayment?.id === debt.id) {
      setSelectedDebtForPayment(null);
      setDebtPayFeedback('');
      return;
    }
    setSelectedDebtForPayment(debt);
    setDebtPayInput('');
    setDebtPayAccountId(data.accounts[0]?.id || '');
    setDebtPayFeedback('');
  };

  const handleConfirmDebtPayment = (e) => {
    e.preventDefault();
    if (!selectedDebtForPayment) return;
    setDebtPayFeedback('');

    const payVal = parseMoneyInput(debtPayInput);
    if (!payVal || payVal <= 0) {
      setDebtPayFeedback('Escribe cuánto vas a abonar.');
      return;
    }

    const chosenAcc = data.accounts.find((a) => a.id === debtPayAccountId) || data.accounts[0];
    if (!chosenAcc) {
      setDebtPayFeedback('Agrega una cuenta en Configuración para descontar el abono.');
      return;
    }

    const accBal = Number(chosenAcc.balance) || 0;
    if (payVal > accBal) {
      setDebtPayFeedback(
        `No alcanza el saldo en ${chosenAcc.name} (${formatMoneyByCurrency(accBal, currency)}).`
      );
      return;
    }

    const currentDebtAmt = Number(selectedDebtForPayment.amount) || 0;
    const actualPaid = Math.min(currentDebtAmt, payVal);
    const remainingDebt = Math.max(0, currentDebtAmt - actualPaid);

    const updatedAccounts = data.accounts.map((a) =>
      a.id === chosenAcc.id ? { ...a, balance: Math.max(0, accBal - actualPaid) } : a
    );

    const newTx = {
      id: Date.now().toString(),
      type: 'gasto',
      amount: actualPaid,
      accountId: chosenAcc.id,
      accountName: chosenAcc.name,
      categoryName: `Abono deuda: ${selectedDebtForPayment.name}`,
      subcategoryName: '',
      categoryIcon: 'none',
      note: remainingDebt === 0 ? 'Deuda saldada' : 'Abono a deuda',
      location: null,
      date: new Date().toISOString(),
    };

    const nextDebts =
      remainingDebt === 0
        ? data.debts.filter((d) => d.id !== selectedDebtForPayment.id)
        : data.debts.map((d) => (d.id === selectedDebtForPayment.id ? { ...d, amount: remainingDebt } : d));

    setData((prev) => ({
      ...prev,
      accounts: updatedAccounts,
      debts: nextDebts,
      transactions: [newTx, ...prev.transactions],
    }));

    const paidDebtName = selectedDebtForPayment.name;
    setSelectedDebtForPayment(null);
    setDebtPayInput('');
    setDebtPayFeedback('');

    if (remainingDebt === 0) {
      setShowDebtSectionModal(false);
      setCelebrationBanner(`¡Bien hecho! Una deuda menos: "${paidDebtName}" quedó saldada.`);
      setTimeout(() => setCelebrationBanner(''), 4500);
    }
  };

  // --- Cuentas ---
  const handleAddAccount = (e) => {
    e.preventDefault();
    setAccFormAlert('');
    if (!newAccName.trim()) {
      setAccFormAlert('Debes escribir el nombre de la cuenta para poder agregarla.');
      return;
    }
    const balance = parseMoneyInput(newAccBalance);
    const created = {
      id: Date.now().toString(),
      name: newAccName.trim(),
      balance,
    };
    setData((prev) => ({ ...prev, accounts: [...prev.accounts, created] }));
    setNewAccName('');
    setNewAccBalance('');
  };

  const handleUpdateAccountBalance = (id, rawVal) => {
    const balance = parseMoneyInput(rawVal);
    setData((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) => (a.id === id ? { ...a, balance } : a)),
    }));
  };

  const handleAddQuickAmount = (e) => {
    e.preventDefault();
    setQuickAmountAlert('');
    const current = Array.isArray(data.quickAmounts) ? data.quickAmounts : [];
    if (current.length >= 5) {
      setQuickAmountAlert('Máximo 5 precios predeterminados.');
      return;
    }
    const val = parseMoneyInput(newQuickAmount);
    if (!val || val <= 0) {
      setQuickAmountAlert('Escribe un precio mayor a 0.');
      return;
    }
    if (current.includes(val)) {
      setQuickAmountAlert('Ese precio ya está en tu lista.');
      return;
    }
    setData((prev) => ({
      ...prev,
      quickAmounts: [...(prev.quickAmounts || []), val].slice(0, 5),
    }));
    setNewQuickAmount('');
  };

  const handleRemoveQuickAmount = (valToRemove) => {
    setQuickAmountAlert('');
    setData((prev) => ({
      ...prev,
      quickAmounts: (prev.quickAmounts || []).filter((v) => v !== valToRemove),
    }));
  };

  const requestDeleteAccount = (acc) => {
    if (data.skipAccountDeleteConfirm) {
      setData((prev) => ({
        ...prev,
        accounts: prev.accounts.filter((a) => a.id !== acc.id),
      }));
    } else {
      setAccToDelete(acc);
    }
  };

  const confirmDeleteAccount = (disableFutureConfirm = false) => {
    if (!accToDelete) return;
    setData((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== accToDelete.id),
      skipAccountDeleteConfirm: disableFutureConfirm ? true : prev.skipAccountDeleteConfirm,
    }));
    setAccToDelete(null);
  };

  // --- Categorías y Subcategorías ---
  const handleAddCategory = (e) => {
    e.preventDefault();
    setCatFormAlert('');
    if (!newCatName.trim()) {
      setCatFormAlert('Debes escribir un nombre de categoría para poder agregarla.');
      return;
    }
    const created = {
      id: Date.now().toString(),
      name: newCatName.trim(),
      icon: ALLOWED_ICON_IDS.has(newCatIcon) ? newCatIcon : 'none',
      subcategories: [],
    };
    setData((prev) => ({ ...prev, categories: [...prev.categories, created] }));
    setNewCatName('');
    setNewCatIcon('none');
  };

  const handleAddSubcategory = (catId) => {
    const raw = (subcatDraftByCatId[catId] || '').trim();
    if (!raw) return;
    setData((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => {
        if (c.id !== catId) return c;
        const existing = Array.isArray(c.subcategories) ? c.subcategories : [];
        if (existing.some((s) => s.toLowerCase() === raw.toLowerCase())) return c;
        return { ...c, subcategories: [...existing, raw] };
      }),
    }));
    setSubcatDraftByCatId((prev) => ({ ...prev, [catId]: '' }));
  };

  const handleRemoveSubcategory = (catId, subName) => {
    setData((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => {
        if (c.id !== catId) return c;
        const existing = Array.isArray(c.subcategories) ? c.subcategories : [];
        return { ...c, subcategories: existing.filter((s) => s !== subName) };
      }),
    }));
  };

  const requestDeleteCategory = (cat) => {
    if (data.skipCategoryDeleteConfirm) {
      setData((prev) => ({
        ...prev,
        categories: prev.categories.filter((c) => c.id !== cat.id),
      }));
    } else {
      setCatToDelete(cat);
    }
  };

  const confirmDeleteCategory = (disableFutureConfirm = false) => {
    if (!catToDelete) return;
    setData((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== catToDelete.id),
      skipCategoryDeleteConfirm: disableFutureConfirm ? true : prev.skipCategoryDeleteConfirm,
    }));
    setCatToDelete(null);
  };

  // --- Deudas ---
  const handleAddDebt = (e) => {
    e.preventDefault();
    setDebtFormAlert('');
    if (!newDebtName.trim()) {
      setDebtFormAlert('Debes escribir el nombre de la deuda para poder agregarla.');
      return;
    }
    const amount = parseMoneyInput(newDebtAmount);
    if (!amount || amount <= 0) {
      setDebtFormAlert('Debes escribir el valor de la deuda para poder agregarla.');
      return;
    }
    const created = {
      id: Date.now().toString(),
      name: newDebtName.trim(),
      amount,
    };
    setData((prev) => ({ ...prev, debts: [...prev.debts, created] }));
    setNewDebtName('');
    setNewDebtAmount('');
  };

  const handleUpdateDebtName = (id, nameVal) => {
    setData((prev) => ({
      ...prev,
      debts: prev.debts.map((d) => (d.id === id ? { ...d, name: nameVal } : d)),
    }));
  };

  const handleUpdateDebtAmount = (id, rawVal) => {
    const amount = parseMoneyInput(rawVal);
    setData((prev) => ({
      ...prev,
      debts: prev.debts.map((d) => (d.id === id ? { ...d, amount } : d)),
    }));
  };

  const reorderDebts = (fromIdx, toIdx) => {
    if (fromIdx === null || toIdx === null || fromIdx === toIdx) return;
    if (toIdx < 0 || toIdx >= data.debts.length) return;
    setData((prev) => {
      const updated = [...prev.debts];
      const [moved] = updated.splice(fromIdx, 1);
      updated.splice(toIdx, 0, moved);
      return { ...prev, debts: updated };
    });
  };

  const requestDeleteDebt = (debt) => {
    if (data.skipDebtDeleteConfirm) {
      setData((prev) => ({
        ...prev,
        debts: prev.debts.filter((d) => d.id !== debt.id),
      }));
    } else {
      setDebtToDelete(debt);
    }
  };

  const confirmDeleteDebt = (disableFutureConfirm = false) => {
    if (!debtToDelete) return;
    setData((prev) => ({
      ...prev,
      debts: prev.debts.filter((d) => d.id !== debtToDelete.id),
      skipDebtDeleteConfirm: disableFutureConfirm ? true : prev.skipDebtDeleteConfirm,
    }));
    setDebtToDelete(null);
  };

  // --- Suscripciones ---
  const currentMonthKey = currentDayKey.slice(0, 7);

  const handleAddSubscription = (e) => {
    e.preventDefault();
    setSubError('');
    if (!subName.trim()) {
      setSubError('Escribe el nombre de la suscripción.');
      return;
    }
    const price = parseMoneyInput(subPrice);
    if (!price || price <= 0) {
      setSubError('Escribe cuánto vale la suscripción.');
      return;
    }
    const dayNum = Math.max(1, Math.min(31, Number(subBillingDay) || 1));
    const chosenAcc = data.accounts.find((a) => a.id === subAccountId) || data.accounts[0];
    if (!chosenAcc) {
      setSubError('Primero agrega una cuenta en Configuración para elegir de dónde saldrá la plata.');
      return;
    }

    const created = {
      id: Date.now().toString(),
      name: subName.trim(),
      price,
      billingDay: dayNum,
      accountId: chosenAcc.id,
      accountName: chosenAcc.name,
      lastChargedMonth: '',
    };

    setData((prev) => ({
      ...prev,
      subscriptions: [...prev.subscriptions, created],
    }));
    setSubName('');
    setSubPrice('');
    setSubBillingDay('12');
  };

  const handleUpdateSubscription = (id, patch) => {
    setData((prev) => ({
      ...prev,
      subscriptions: prev.subscriptions.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...patch };
        if (patch.accountId) {
          const accObj = prev.accounts.find((a) => a.id === patch.accountId);
          if (accObj) next.accountName = accObj.name;
        }
        return next;
      }),
    }));
  };

  const handleMoveSubscriptionToDebt = (sub) => {
    if (!sub) return;
    const price = Number(sub.price) || 0;
    const newDebt = {
      id: Date.now().toString(),
      name: `Suscripción: ${sub.name}`,
      amount: price,
    };
    const updatedSubs = data.subscriptions.map((s) =>
      s.id === sub.id ? { ...s, lastChargedMonth: currentMonthKey } : s
    );

    setData((prev) => ({
      ...prev,
      debts: [newDebt, ...prev.debts],
      subscriptions: updatedSubs,
    }));
    setSubToChargeConfirm(null);
    setSubError('');
    setCelebrationBanner(`"${sub.name}" pasó a Deudas por ${formatMoneyByCurrency(price, currency)}.`);
    setTimeout(() => setCelebrationBanner(''), 4500);
  };

  const executeChargeSubscription = (sub) => {
    if (!sub) return;
    setSubError('');
    const price = Number(sub.price) || 0;
    const accObj = data.accounts.find((a) => a.id === sub.accountId);
    if (!accObj) {
      setSubError(`La cuenta vinculada a "${sub.name}" ya no existe.`);
      setSubToChargeConfirm(null);
      return;
    }
    if (price > (Number(accObj.balance) || 0)) {
      setSubError(
        `No alcanza la plata en ${accObj.name} (${formatMoneyByCurrency(accObj.balance, currency)}) para cobrar "${sub.name}". Puedes enviarla a Deudas.`
      );
      setSubToChargeConfirm(null);
      return;
    }

    const updatedAccounts = data.accounts.map((a) =>
      a.id === accObj.id ? { ...a, balance: Math.max(0, (Number(a.balance) || 0) - price) } : a
    );

    const newTx = {
      id: Date.now().toString(),
      type: 'gasto',
      amount: price,
      accountId: accObj.id,
      accountName: accObj.name,
      categoryName: `Suscripción: ${sub.name}`,
      subcategoryName: '',
      categoryIcon: 'none',
      note: `Cobro día ${sub.billingDay}`,
      location: null,
      date: new Date().toISOString(),
    };

    const updatedSubs = data.subscriptions.map((s) =>
      s.id === sub.id ? { ...s, lastChargedMonth: currentMonthKey } : s
    );

    setData((prev) => ({
      ...prev,
      accounts: updatedAccounts,
      transactions: [newTx, ...prev.transactions],
      subscriptions: updatedSubs,
    }));
    setSubToChargeConfirm(null);
  };

  const confirmDeleteSubscription = () => {
    if (!subToDelete) return;
    setData((prev) => ({
      ...prev,
      subscriptions: prev.subscriptions.filter((s) => s.id !== subToDelete.id),
    }));
    setSubToDelete(null);
  };

  const computedSubscriptions = useMemo(() => {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msPerDay = 1000 * 60 * 60 * 24;

    return data.subscriptions
      .map((sub) => {
        const chargedThisMonth = sub.lastChargedMonth === currentMonthKey;
        const safeDay = Math.max(1, Math.min(31, Number(sub.billingDay) || 1));
        const maxDayThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const dueThisMonthDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          Math.min(safeDay, maxDayThisMonth)
        );

        const targetDate = chargedThisMonth
          ? getNextMonthCycleDate(sub.billingDay, now)
          : dueThisMonthDate;

        const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const diffDays = Math.round((targetMidnight - todayMidnight) / msPerDay);
        const isOverdue = !chargedThisMonth && diffDays < 0;
        const isDueToday = !chargedThisMonth && diffDays === 0;
        const daysLeft = Math.max(0, diffDays);

        const linkedAcc = data.accounts.find((a) => a.id === sub.accountId);
        const accBal = linkedAcc ? Number(linkedAcc.balance) || 0 : 0;

        let badgeText = chargedThisMonth
          ? `Pagada • Próx. ${daysLeft}d`
          : isOverdue
          ? Math.abs(diffDays) === 1
            ? 'Vencida hace 1 día'
            : `Vencida hace ${Math.abs(diffDays)} días`
          : isDueToday
          ? 'Hoy es el cobro'
          : daysLeft === 1
          ? 'Falta 1 día'
          : `Faltan ${daysLeft} días`;

        let badgeColor = '#60A5FA';
        let badgeBg = 'rgba(37, 99, 235, 0.18)';

        if (isOverdue) {
          badgeColor = '#F87171';
          badgeBg = 'rgba(239, 68, 68, 0.2)';
        } else if (isDueToday) {
          badgeColor = '#FACC15';
          badgeBg = 'rgba(234, 179, 8, 0.22)';
        }

        const dateLabel = targetDate.toLocaleDateString('es-CO', {
          day: 'numeric',
          month: 'long',
        });

        return {
          ...sub,
          chargedThisMonth,
          daysLeft,
          diffDays,
          isOverdue,
          isDueToday,
          dateLabel,
          badgeText,
          badgeColor,
          badgeBg,
          accountBal: accBal,
        };
      })
      .sort((a, b) => {
        if (a.chargedThisMonth !== b.chargedThisMonth) {
          return a.chargedThisMonth ? 1 : -1;
        }
        return a.diffDays - b.diffDays;
      });
  }, [data.subscriptions, data.accounts, currentMonthKey]);

  const subAlertStatus = useMemo(() => {
    const activeAlerts = computedSubscriptions.filter((s) => !s.chargedThisMonth && (s.isDueToday || s.isOverdue));
    if (activeAlerts.length === 0) return null;
    const hasOverdue = activeAlerts.some((s) => s.isOverdue);
    return {
      count: activeAlerts.length,
      color: hasOverdue ? '#EF4444' : '#FACC15',
      textColor: hasOverdue ? '#FFFFFF' : '#090B0E',
    };
  }, [computedSubscriptions]);

  // --- Movimientos ---
  const openTransactionModal = () => {
    if (data.accounts.length === 0) {
      setNoAccountAlert(true);
      return;
    }
    setTxType('gasto');
    setTxAmount('');
    setTxAccount(data.accounts[0]?.id || '');
    setTxCategoryId('');
    setTxCategoryName('');
    setTxCategoryIcon('none');
    setTxSubcategoryName('');
    setTxSaveLocation(false);
    setTxLocationStatus('');
    setTxSavingLocation(false);
    setTxNote('');
    setTxError('');
    setShowTxModal(true);
  };

  const selectedCategoryObject = useMemo(
    () => data.categories.find((c) => c.id === txCategoryId) || null,
    [data.categories, txCategoryId]
  );

  const handleToggleLocationOption = (wantLocation) => {
    setTxSaveLocation(wantLocation);
    if (wantLocation) {
      setTxLocationStatus('Se pedirá permiso de ubicación al guardar el movimiento.');
    } else {
      setTxLocationStatus('');
    }
  };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (txSavingLocation) return;
    setTxError('');

    const amount = parseMoneyInput(txAmount);
    if (!amount || amount <= 0) {
      setTxError('Escribe un valor mayor a 0.');
      return;
    }

    const accountObj = data.accounts.find((a) => a.id === txAccount);

    if (txType === 'gasto' && accountObj) {
      const currentAccBal = Number(accountObj.balance) || 0;
      if (amount > currentAccBal) {
        setTxError(
          `No puedes gastar ${formatMoneyByCurrency(amount, currency)} en ${accountObj.name}: solo tienes ${formatMoneyByCurrency(currentAccBal, currency)} disponibles.`
        );
        return;
      }
    }

    const snapType = txType;
    const snapAccountId = txAccount;
    const snapCategoryName = txCategoryName.trim() || 'General';
    const snapSubcategoryName = txSubcategoryName.trim();
    const snapCategoryIcon = ALLOWED_ICON_IDS.has(txCategoryIcon) ? txCategoryIcon : 'none';
    const snapNote = txNote.trim();
    const snapWantLoc = txSaveLocation;

    let capturedLoc = null;
    if (snapWantLoc) {
      setTxSavingLocation(true);
      setTxLocationStatus('Obteniendo ubicación...');
      const geoRes = await captureCurrentLocation();
      if (geoRes.ok) {
        capturedLoc = geoRes.location;
      } else {
        setCelebrationBanner(`${geoRes.error} El movimiento se guardó sin ubicación.`);
        setTimeout(() => setCelebrationBanner(''), 4500);
      }
    }

    setData((prev) => {
      const targetAcc = prev.accounts.find((a) => a.id === snapAccountId) || prev.accounts[0];
      const newTx = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: snapType,
        amount,
        accountId: targetAcc?.id || '',
        accountName: targetAcc?.name || 'Sin cuenta',
        categoryName: snapCategoryName,
        subcategoryName: snapSubcategoryName,
        categoryIcon: snapCategoryIcon,
        note: snapNote,
        location: capturedLoc,
        date: new Date().toISOString(),
      };

      const updatedAccounts = prev.accounts.map((acc) => {
        if (acc.id !== (targetAcc?.id || snapAccountId)) return acc;
        const delta = snapType === 'ingreso' ? amount : -amount;
        return { ...acc, balance: Math.max(0, (Number(acc.balance) || 0) + delta) };
      });

      return {
        ...prev,
        accounts: updatedAccounts,
        transactions: [newTx, ...prev.transactions],
      };
    });

    setTxSavingLocation(false);
    setTxLocationStatus('');
    setShowTxModal(false);
  };

  const confirmDeleteTransaction = () => {
    if (!txToDelete) return;
    const tx = txToDelete;
    const restoredAccounts = data.accounts.map((acc) => {
      if (acc.id !== tx.accountId) return acc;
      const delta = tx.type === 'ingreso' ? -Number(tx.amount) : Number(tx.amount);
      return { ...acc, balance: Math.max(0, (Number(acc.balance) || 0) + delta) };
    });

    setData((prev) => ({
      ...prev,
      accounts: restoredAccounts,
      transactions: prev.transactions.filter((t) => t.id !== tx.id),
    }));
    if (selectedTxDetail?.id === tx.id) {
      setSelectedTxDetail(null);
    }
    setTxToDelete(null);
  };

  const groupTransactionsByDay = useCallback((txList) => {
    const groups = [];
    const indexByDay = new Map();

    for (let i = 0; i < txList.length; i += 1) {
      const tx = txList[i];
      const dayKey = tx.date ? getLocalDayKey(new Date(tx.date)) : 'sin-fecha';
      if (!indexByDay.has(dayKey)) {
        indexByDay.set(dayKey, groups.length);
        groups.push({ dayKey, label: formatDayHeading(dayKey), items: [tx] });
      } else {
        groups[indexByDay.get(dayKey)].items.push(tx);
      }
    }
    return groups;
  }, []);

  const filteredAllTransactions = useMemo(() => {
    return data.transactions.filter((tx) => {
      if (txFilterType !== 'todos' && tx.type !== txFilterType) return false;
      if (txFilterAccountId !== 'todas' && tx.accountId !== txFilterAccountId) return false;
      return true;
    });
  }, [data.transactions, txFilterType, txFilterAccountId]);

  const recentGroupedTransactions = useMemo(
    () => groupTransactionsByDay(data.transactions.slice(0, 6)),
    [data.transactions, groupTransactionsByDay]
  );

  const filteredGroupedTransactions = useMemo(
    () => groupTransactionsByDay(filteredAllTransactions),
    [filteredAllTransactions, groupTransactionsByDay]
  );

  // --- Exportar / Importar / Guardar PDF ---
  const handleExportData = () => {
    const nowIso = new Date().toISOString();
    const stamp = getBackupStampFilePart(new Date());
    const payload = { ...data, lastBackupAt: nowIso };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `artpay-respaldo-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setData((prev) => ({ ...prev, lastBackupAt: nowIso }));
    setConfigNotice(`Respaldo guardado (${stamp.replace('_', ' ')}).`);
    setTimeout(() => setConfigNotice(''), 3000);
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        setData((prev) => normalizeStoredData({ ...prev, ...parsed }));
        setConfigNotice('Información importada correctamente.');
      } catch {
        setConfigNotice('El archivo seleccionado no es un respaldo válido.');
      }
      setTimeout(() => setConfigNotice(''), 3000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleTriggerSavePDF = async () => {
    const sanitizeAscii = (str) =>
      String(str || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^ -~]/g, ' ')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');

    const linesToDraw = [];
    linesToDraw.push({ text: `ArtPay - Reporte Financiero (${currency})`, bold: true, size: 15 });
    linesToDraw.push({
      text: `${data.userName ? `Usuario: ${data.userName} | ` : ''}Fecha: ${new Date().toLocaleDateString('es-CO')} | ${APP_VERSION}`,
      bold: false,
      size: 9,
    });
    linesToDraw.push({ text: ' ', bold: false, size: 8 });
    linesToDraw.push({
      text: `Plata disponible: ${formatMoneyByCurrency(totalAvailable, currency)} ${currency}`,
      bold: true,
      size: 11,
    });
    linesToDraw.push({
      text: `Deudas totales: ${formatMoneyByCurrency(totalDebts, currency)} ${currency}`,
      bold: true,
      size: 11,
    });
    linesToDraw.push({ text: ' ', bold: false, size: 8 });
    linesToDraw.push({ text: `CUENTAS (${data.accounts.length})`, bold: true, size: 11 });
    if (data.accounts.length === 0) {
      linesToDraw.push({ text: '  - Sin cuentas registradas', bold: false, size: 10 });
    } else {
      data.accounts.forEach((acc) => {
        linesToDraw.push({
          text: `  - ${acc.name}: ${formatMoneyByCurrency(acc.balance, currency)}`,
          bold: false,
          size: 10,
        });
      });
    }

    linesToDraw.push({ text: ' ', bold: false, size: 8 });
    linesToDraw.push({ text: `TODOS LOS MOVIMIENTOS (${data.transactions.length})`, bold: true, size: 11 });
    if (data.transactions.length === 0) {
      linesToDraw.push({ text: '  - Sin movimientos registrados', bold: false, size: 10 });
    } else {
      data.transactions.forEach((tx) => {
        const sign = tx.type === 'ingreso' ? '+' : tx.type === 'gasto' ? '-' : '<-> ';
        const subPart = tx.subcategoryName ? ` (${tx.subcategoryName})` : '';
        const notePart = tx.note && tx.type !== 'transferencia' ? ` | Nota: ${tx.note}` : '';
        linesToDraw.push({
          text: `  * ${tx.categoryName}${subPart} [${tx.accountName}]: ${sign}${formatMoneyByCurrency(tx.amount, currency)}`,
          bold: true,
          size: 9.5,
        });
        linesToDraw.push({
          text: `    ${formatDateTimeLabel(tx.date)}${notePart}`,
          bold: false,
          size: 8.5,
        });
        if (tx.location?.label) {
          linesToDraw.push({
            text: `    Ubicacion: ${tx.location.label} (${tx.location.lat}, ${tx.location.lng})`,
            bold: false,
            size: 8,
          });
        }
      });
    }

    const pages = [];
    let currentOps = [];
    let cursorY = 795;

    linesToDraw.forEach((item) => {
      const lineHeight = item.size + 5;
      if (cursorY < 48) {
        pages.push(currentOps.join('\n'));
        currentOps = [];
        cursorY = 795;
      }
      const fontTag = item.bold ? '/F2' : '/F1';
      const safe = sanitizeAscii(item.text);
      currentOps.push(`BT ${fontTag} ${item.size} Tf 42 ${cursorY} Td (${safe}) Tj ET`);
      cursorY -= lineHeight;
    });
    if (currentOps.length > 0) {
      pages.push(currentOps.join('\n'));
    }

    const totalPages = Math.max(1, pages.length);
    const objects = [];
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    const pageObjIds = [];
    for (let p = 0; p < totalPages; p += 1) {
      pageObjIds.push(5 + p * 2);
    }
    objects[2] = `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${totalPages} >>`;
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

    for (let p = 0; p < totalPages; p += 1) {
      const pageId = 5 + p * 2;
      const contentId = 6 + p * 2;
      const streamData = pages[p] || '';
      objects[pageId] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
      objects[contentId] = `<< /Length ${streamData.length} >>
stream
${streamData}
endstream`;
    }

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (let id = 1; id < objects.length; id += 1) {
      offsets[id] = pdf.length;
      pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xrefPos = pdf.length;
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id += 1) {
      pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i += 1) {
      bytes[i] = pdf.charCodeAt(i) & 0xff;
    }

    const fileName = `ArtPay-Reporte-${getBackupStampFilePart(new Date())}.pdf`;
    const pdfBlob = new Blob([bytes], { type: 'application/pdf' });

    try {
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [pdfFile] })
      ) {
        await navigator.share({
          files: [pdfFile],
          title: 'ArtPay Reporte PDF',
        });
        return;
      }
    } catch (shareErr) {
      if (shareErr && shareErr.name === 'AbortError') return;
    }

    const blobUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      window.open(blobUrl, '_blank');
    }, 150);
  };

  // --- Deseos ---
  const handleAddWish = (e) => {
    e.preventDefault();
    setWishFormAlert('');
    if (!wishName.trim()) {
      setWishFormAlert('Debes escribir el nombre del deseo para poder agregarlo.');
      return;
    }
    const price = parseMoneyInput(wishPrice);
    if (!price || price <= 0) {
      setWishFormAlert('Debes escribir cuánto cuesta el deseo para poder agregarlo.');
      return;
    }
    const created = {
      id: Date.now().toString(),
      name: wishName.trim(),
      price,
    };
    setData((prev) => ({ ...prev, wishes: [...prev.wishes, created] }));
    setWishName('');
    setWishPrice('');
  };

  const handleUpdateWish = (id, patch) => {
    setData((prev) => ({
      ...prev,
      wishes: prev.wishes.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));
  };

  const confirmDeleteWish = () => {
    if (!wishToDelete) return;
    setData((prev) => ({
      ...prev,
      wishes: prev.wishes.filter((w) => w.id !== wishToDelete.id),
    }));
    setWishToDelete(null);
  };

  const reorderWishes = (fromIdx, toIdx) => {
    if (fromIdx === null || toIdx === null || fromIdx === toIdx) return;
    if (toIdx < 0 || toIdx >= data.wishes.length) return;
    setData((prev) => {
      const updated = [...prev.wishes];
      const [moved] = updated.splice(fromIdx, 1);
      updated.splice(toIdx, 0, moved);
      return { ...prev, wishes: updated };
    });
  };

  const handleTouchStartGrip = (index, e) => {
    touchIndex.current = index;
    touchStartY.current = e.touches[0].clientY;
    setDragIndex(index);
  };

  const handleTouchMoveGrip = (e) => {
    if (touchIndex.current === null) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    const stepHeight = 68;
    const stepsMoved = Math.round(diff / stepHeight);
    if (stepsMoved !== 0) {
      const target = Math.max(0, Math.min(data.wishes.length - 1, touchIndex.current + stepsMoved));
      if (target !== touchIndex.current) {
        reorderWishes(touchIndex.current, target);
        touchIndex.current = target;
        touchStartY.current = currentY;
        setDragIndex(target);
      }
    }
  };

  const handleTouchEndGrip = () => {
    touchIndex.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const iosEase = 'cubic-bezier(0.22, 1, 0.36, 1)';

  const theme = useMemo(
    () =>
      isDark
        ? {
            bg: '#040507',
            headerBg: '#040507',
            card: 'linear-gradient(180deg, #16191f 0%, #090b0e 100%)',
            availableCard: 'linear-gradient(180deg, #434C5E 0%, #252B37 100%)',
            availableBorder: 'rgba(241, 245, 249, 0.72)',
            availableShadow: '0 14px 34px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(226, 232, 240, 0.35)',
            availableLabelColor: '#E2E8F0',
            availableSubCardBg: 'rgba(15, 19, 26, 0.68)',
            availableSubCardBorder: 'rgba(226, 232, 240, 0.22)',
            availableMutedColor: '#CBD5E1',
            cardSolid: '#0c0e12',
            cardSubtle: '#12151b',
            border: 'rgba(255, 255, 255, 0.11)',
            borderStrong: 'rgba(255, 255, 255, 0.28)',
            textPrimary: '#FFFFFF',
            textSecondary: '#C2C9D4',
            textMuted: '#828B99',
            silverGradient: 'linear-gradient(180deg, #FFFFFF 0%, #E2E8F0 55%, #94A3B8 100%)',
            accentBlue: '#2563EB',
            accentBlueSoft: 'rgba(37, 99, 235, 0.18)',
            accentBlueText: '#60A5FA',
            iconCircleBg: 'linear-gradient(145deg, #F1F5F9 0%, #94A3B8 100%)',
            iconCircleColor: '#090B0E',
            iconCircleBorder: '1.5px solid #FFFFFF',
            inputBg: '#080A0D',
            navBg: '#06080B',
            danger: '#F87171',
            dangerBg: 'rgba(239, 68, 68, 0.14)',
            success: '#34D399',
            successBg: 'rgba(16, 185, 129, 0.14)',
            warning: '#FBBF24',
            warningBg: 'rgba(245, 158, 11, 0.14)',
          }
        : {
            bg: '#F4F6F9',
            headerBg: '#F4F6F9',
            card: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
            availableCard: 'linear-gradient(180deg, #1E232C 0%, #090B0F 100%)',
            availableBorder: 'rgba(148, 163, 184, 0.55)',
            availableShadow: '0 12px 28px rgba(15, 23, 42, 0.22)',
            availableLabelColor: '#CBD5E1',
            availableSubCardBg: 'rgba(255, 255, 255, 0.06)',
            availableSubCardBorder: 'rgba(226, 232, 240, 0.14)',
            availableMutedColor: '#94A3B8',
            cardSolid: '#FFFFFF',
            cardSubtle: '#EEF2F6',
            border: 'rgba(15, 23, 42, 0.09)',
            borderStrong: 'rgba(15, 23, 42, 0.18)',
            textPrimary: '#0B0D11',
            textSecondary: '#475569',
            textMuted: '#64748B',
            silverGradient: 'linear-gradient(180deg, #FFFFFF 0%, #CBD5E1 65%, #94A3B8 100%)',
            accentBlue: '#2563EB',
            accentBlueSoft: 'rgba(37, 99, 235, 0.12)',
            accentBlueText: '#2563EB',
            iconCircleBg: 'linear-gradient(160deg, #272B33 0%, #090B0F 100%)',
            iconCircleColor: '#E2E8F0',
            iconCircleBorder: '1.5px solid #94A3B8',
            inputBg: '#F8FAFC',
            navBg: '#FFFFFF',
            danger: '#DC2626',
            dangerBg: 'rgba(220, 38, 38, 0.1)',
            success: '#059669',
            successBg: 'rgba(5, 150, 105, 0.1)',
            warning: '#B45309',
            warningBg: 'rgba(217, 119, 6, 0.12)',
          },
    [isDark]
  );

  const baseInputStyle = {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    backgroundColor: theme.inputBg,
    border: `1px solid ${theme.border}`,
    borderRadius: '10px',
    padding: '10px 11px',
    color: theme.textPrimary,
    fontSize: '13px',
    outline: 'none',
    transition: `border-color 0.2s ${iosEase}, background-color 0.25s ${iosEase}`,
  };

  const renderMoney = (val) => (hideBalances ? '••••••' : formatMoneyByCurrency(val, currency));

  const renderBigCurrencyAmount = (val, mainFontPx, colorStyle = null) => {
    if (hideBalances) {
      return <span style={{ fontSize: `${mainFontPx}px`, fontWeight: 800 }}>••••••</span>;
    }
    const formatted = formatMoneyByCurrency(val, currency);
    const codeFontPx = Math.max(8, Math.round(mainFontPx / 4));
    return (
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '5px' }}>
        <span
          style={
            colorStyle || {
              fontSize: `${mainFontPx}px`,
              fontWeight: 800,
              letterSpacing: '-0.8px',
              background: theme.silverGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }
          }
        >
          {formatted}
        </span>
        <span
          style={{
            fontSize: `${codeFontPx}px`,
            fontWeight: 700,
            letterSpacing: '0.4px',
            color: colorStyle ? colorStyle.color : theme.availableLabelColor,
            opacity: 0.9,
          }}
        >
          {currency}
        </span>
      </span>
    );
  };

  const { expenseByCategory, incomeByCategory, totalAllExpenses, totalAllIncomes, totalCompare } = useMemo(() => {
    const expCat = {};
    const incCat = {};
    let expSum = 0;
    let incSum = 0;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    for (let i = 0; i < data.transactions.length; i += 1) {
      const t = data.transactions[i];
      if (!t.date) continue;
      const txTime = new Date(t.date).getTime();
      if (Number.isNaN(txTime)) continue;

      const isSameDay = getLocalDayKey(new Date(t.date)) === currentDayKey;
      const inRange =
        statsPeriod === 'dia'
          ? isSameDay
          : statsPeriod === 'semana'
          ? txTime >= startOfWeek
          : txTime >= startOfMonth;

      if (!inRange) continue;

      const amt = Number(t.amount) || 0;
      const cat = t.categoryName || 'General';

      if (t.type === 'gasto') {
        expCat[cat] = (expCat[cat] || 0) + amt;
        expSum += amt;
      } else if (t.type === 'ingreso') {
        incCat[cat] = (incCat[cat] || 0) + amt;
        incSum += amt;
      }
    }

    return {
      expenseByCategory: expCat,
      incomeByCategory: incCat,
      totalAllExpenses: expSum,
      totalAllIncomes: incSum,
      totalCompare: Math.max(incSum + expSum, 1),
    };
  }, [data.transactions, statsPeriod, currentDayKey]);

  const statsPeriodSubtitle = useMemo(
    () => getStatsPeriodSubtitle(statsPeriod, currentDayKey),
    [statsPeriod, currentDayKey]
  );

  const totalWishesValue = useMemo(
    () => data.wishes.reduce((acc, w) => acc + (Number(w.price) || 0), 0),
    [data.wishes]
  );

  const getWishRankStyle = (idx) => {
    if (idx === 0) {
      return {
        badgeBg: isDark ? '#F59E0B' : '#D97706',
        badgeColor: '#FFFFFF',
        cardBorder: isDark ? 'rgba(245, 158, 11, 0.45)' : 'rgba(217, 119, 6, 0.42)',
        amountColor: isDark ? '#FBBF24' : '#B45309',
      };
    }
    if (idx === 1) {
      return {
        badgeBg: isDark ? '#CBD5E1' : '#64748B',
        badgeColor: '#FFFFFF',
        cardBorder: isDark ? 'rgba(203, 213, 225, 0.35)' : 'rgba(100, 116, 139, 0.35)',
        amountColor: isDark ? '#E2E8F0' : '#334155',
      };
    }
    if (idx === 2) {
      return {
        badgeBg: theme.accentBlue,
        badgeColor: '#FFFFFF',
        cardBorder: isDark ? 'rgba(96, 165, 250, 0.38)' : 'rgba(37, 99, 235, 0.35)',
        amountColor: theme.accentBlueText,
      };
    }
    return {
      badgeBg: theme.cardSubtle,
      badgeColor: theme.textSecondary,
      cardBorder: theme.border,
      amountColor: theme.accentBlueText,
    };
  };

  const getDebtRankStyle = (idx) => {
    if (idx === 0) {
      return {
        badgeBg: '#EF4444',
        badgeColor: '#FFFFFF',
        border: 'rgba(239, 68, 68, 0.5)',
        amountColor: '#F87171',
      };
    }
    if (idx === 1) {
      return {
        badgeBg: '#F97316',
        badgeColor: '#FFFFFF',
        border: 'rgba(249, 115, 22, 0.5)',
        amountColor: '#FB923C',
      };
    }
    if (idx === 2) {
      return {
        badgeBg: '#EAB308',
        badgeColor: '#090B0E',
        border: 'rgba(234, 179, 8, 0.5)',
        amountColor: '#FACC15',
      };
    }
    return {
      badgeBg: theme.cardSubtle,
      badgeColor: theme.textSecondary,
      border: theme.border,
      amountColor: theme.danger,
    };
  };

  const renderTransactionListGroups = (groups) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {groups.map((group) => (
        <div key={group.dayKey} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: theme.textSecondary,
              borderBottom: `1px solid ${theme.border}`,
              paddingBottom: '5px',
            }}
          >
            {group.label}
          </div>

          {group.items.map((tx) => {
            const isTransfer = tx.type === 'transferencia';
            const sign = tx.type === 'ingreso' ? '+' : tx.type === 'gasto' ? '-' : '⇄ ';
            const amountColor = isTransfer
              ? theme.accentBlueText
              : tx.type === 'ingreso'
              ? theme.success
              : theme.danger;

            const subcatBg = tx.type === 'gasto' ? theme.dangerBg : theme.successBg;
            const subcatColor = tx.type === 'gasto' ? theme.danger : theme.success;

            return (
              <div
                key={tx.id}
                onClick={() => setSelectedTxDetail(tx)}
                style={{
                  backgroundColor: theme.cardSolid,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '14px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  cursor: 'pointer',
                  transition: `transform 0.25s ${iosEase}, background-color 0.25s ${iosEase}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  {tx.categoryIcon && tx.categoryIcon !== 'none' ? (
                    <CategoryGlyph iconId={tx.categoryIcon} size={18} color={theme.textSecondary} />
                  ) : null}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: theme.textPrimary }}>
                        {tx.categoryName}
                      </span>
                      {tx.subcategoryName && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '999px',
                            backgroundColor: subcatBg,
                            color: subcatColor,
                          }}
                        >
                          {tx.subcategoryName}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '2px' }}>
                      {tx.accountName}
                      {tx.note && !isTransfer ? ` • ${tx.note}` : ''}
                    </div>
                    <div style={{ fontSize: '11px', color: theme.textSecondary, marginTop: '2px' }}>
                      {formatDateTimeLabel(tx.date)}
                    </div>
                  </div>
                </div>

                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span
                    onClick={() => setSelectedTxDetail(tx)}
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: amountColor,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sign}
                    {renderMoney(tx.amount)}
                  </span>
                  {!isTransfer && (
                    <button
                      type="button"
                      onClick={() => setTxToDelete(tx)}
                      title="Eliminar movimiento"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: theme.textMuted,
                        cursor: 'pointer',
                        fontSize: '15px',
                        padding: '4px',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  // Ordenar categorías en Estadísticas poniendo arriba la que más total tiene (Ingresos vs Gastos)
  const categoryBreakdownBlocks = useMemo(() => {
    const gastosBlock = {
      key: 'gastosCat',
      title: 'Gasto por categoría',
      total: totalAllExpenses,
      entries: Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]),
      emptyText: 'Sin gastos registrados en este rango.',
      amountColor: theme.danger,
    };

    const ingresosBlock = {
      key: 'ingresosCat',
      title: 'Ingresos por categoría',
      total: totalAllIncomes,
      entries: Object.entries(incomeByCategory).sort((a, b) => b[1] - a[1]),
      emptyText: 'Sin ingresos registrados en este rango.',
      amountColor: theme.success,
    };

    return totalAllIncomes > totalAllExpenses
      ? [ingresosBlock, gastosBlock]
      : [gastosBlock, ingresosBlock];
  }, [totalAllIncomes, totalAllExpenses, expenseByCategory, incomeByCategory, theme.danger, theme.success]);

  return (
    <div
      onTouchStart={handleScreenTouchStart}
      onTouchEnd={handleScreenTouchEnd}
      style={{
        minHeight: '100dvh',
        backgroundColor: theme.bg,
        color: theme.textPrimary,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
        paddingBottom: '94px',
        transition: `background-color 0.32s ${iosEase}, color 0.32s ${iosEase}`,
      }}
    >
      <style>{`
        @keyframes iosTabEnter {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.99);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes iosDrawerSlide {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes iosSheetSlide {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes iosFadeBackdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .ios-screen-enter {
          animation: iosTabEnter 0.34s ${iosEase};
        }
        .ios-drawer-enter {
          animation: iosDrawerSlide 0.32s ${iosEase};
        }
        .ios-sheet-enter {
          animation: iosSheetSlide 0.36s ${iosEase};
        }
        .ios-backdrop-enter {
          animation: iosFadeBackdrop 0.28s ${iosEase};
        }
        .smooth-collapse {
          display: grid;
          transition: grid-template-rows 0.34s ${iosEase}, opacity 0.28s ${iosEase};
        }
        .smooth-collapse.open {
          grid-template-rows: 1fr;
          opacity: 1;
        }
        .smooth-collapse.closed {
          grid-template-rows: 0fr;
          opacity: 0;
        }
        .smooth-collapse-inner {
          overflow: hidden;
        }
        .debt-row-anim {
          transition: transform 0.24s ${iosEase}, border-color 0.24s ${iosEase}, background-color 0.24s ${iosEase}, box-shadow 0.24s ${iosEase};
        }
        .debt-row-anim:active {
          transform: scale(0.985);
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #artpay-printable-sheet,
          #artpay-printable-sheet * {
            visibility: visible !important;
          }
          #artpay-printable-sheet {
            position: absolute !important;
            inset: 0 !important;
            background: #FFFFFF !important;
            color: #0F172A !important;
            padding: 16px !important;
            overflow: visible !important;
          }
          .no-print-btn {
            display: none !important;
          }
        }
      `}</style>

      {/* Menú lateral deslizable */}
      {drawerOpen && (
        <div
          className="ios-backdrop-enter"
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            display: 'flex',
          }}
        >
          <aside
            className="ios-drawer-enter"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '260px',
              maxWidth: '78vw',
              height: '100%',
              backgroundColor: theme.cardSolid,
              borderRight: `1px solid ${theme.borderStrong}`,
              paddingTop: 'calc(34px + env(safe-area-inset-top))',
              paddingRight: '18px',
              paddingBottom: '24px',
              paddingLeft: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img
                  src="/logo.png"
                  alt="ArtPay"
                  style={{ width: '34px', height: '34px', borderRadius: '10px', objectFit: 'cover' }}
                />
                <span style={{ fontSize: '17px', fontWeight: 800 }}>ArtPay</span>
                <span style={{ fontSize: '10px', color: theme.textMuted, fontWeight: 600 }}>{APP_VERSION}</span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.textSecondary,
                  fontSize: '18px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {[
              { id: 'inicio', label: 'Principal' },
              { id: 'movimientos', label: 'Movimientos' },
              { id: 'estadisticas', label: 'Estadísticas' },
              { id: 'suscripciones', label: 'Suscripciones' },
              { id: 'deseos', label: 'Deseos' },
              { id: 'config', label: 'Configuración' },
            ].map((item) => {
              const isCurrent = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setDrawerOpen(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: isCurrent ? `1px solid ${theme.accentBlue}` : `1px solid ${theme.border}`,
                    backgroundColor: isCurrent ? theme.accentBlueSoft : theme.cardSubtle,
                    color: isCurrent ? theme.accentBlueText : theme.textPrimary,
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: `all 0.22s ${iosEase}`,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{item.label}</span>
                    {item.id === 'suscripciones' && subAlertStatus && (
                      <span
                        style={{
                          minWidth: '18px',
                          height: '18px',
                          padding: '0 5px',
                          borderRadius: '999px',
                          backgroundColor: subAlertStatus.color,
                          color: subAlertStatus.textColor,
                          fontSize: '11px',
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {subAlertStatus.count}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </aside>
        </div>
      )}

      {/* Header superior */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backgroundColor: theme.headerBg,
          borderBottom: `1px solid ${theme.border}`,
          paddingTop: 'calc(34px + env(safe-area-inset-top))',
          paddingRight: '18px',
          paddingBottom: '14px',
          paddingLeft: '18px',
          transition: `background-color 0.32s ${iosEase}, border-color 0.32s ${iosEase}`,
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              title="Abrir menú"
              style={{
                padding: 0,
                border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: '11px',
                background: 'none',
                width: '38px',
                height: '38px',
                overflow: 'hidden',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <img
                src="/logo.png"
                alt="ArtPay"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </button>

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.4px' }}>
                  ArtPay
                </span>
                <span style={{ fontSize: '10px', fontWeight: 600, color: theme.textMuted }}>
                  {APP_VERSION}
                </span>
              </div>
              <button
                type="button"
                onClick={() => openOnlySectionInConfig('perfil')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: data.userName ? theme.textSecondary : theme.accentBlueText,
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {data.userName ? `Hola, ${data.userName}` : 'Agrega tu nombre'}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setHideBalances((h) => !h)}
            title={hideBalances ? 'Mostrar saldos' : 'Ocultar saldos'}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: theme.cardSubtle,
              border: `1px solid ${theme.border}`,
              color: theme.textPrimary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {hideBalances ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Contenedor principal */}
      <main
        key={activeTab}
        className="ios-screen-enter"
        style={{ maxWidth: '480px', margin: '0 auto', padding: '16px' }}
      >
        {/* ================= PESTAÑA INICIO ================= */}
        {activeTab === 'inicio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {celebrationBanner && (
              <div
                className="ios-screen-enter"
                style={{
                  backgroundColor: theme.successBg,
                  border: `1.5px solid ${theme.success}`,
                  color: theme.success,
                  borderRadius: '14px',
                  padding: '12px 14px',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                {celebrationBanner}
              </div>
            )}

            {!data.onboardingDismissed &&
              data.accounts.length === 0 &&
              data.transactions.length === 0 &&
              data.debts.length === 0 && (
                <section
                  className="ios-screen-enter"
                  style={{
                    background: theme.card,
                    border: `1.5px solid ${theme.accentBlue}`,
                    borderRadius: '18px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: theme.accentBlueText }}>
                      Guía rápida de inicio
                    </span>
                    <button
                      type="button"
                      onClick={() => setData((prev) => ({ ...prev, onboardingDismissed: true }))}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: theme.textMuted,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Entendido ✕
                    </button>
                  </div>
                  <div style={{ fontSize: '12px', color: theme.textSecondary, lineHeight: 1.45 }}>
                    • <strong>Plata disponible:</strong> Agrega tus cuentas (Nequi, banco, efectivo) para ver tu saldo real.<br />
                    • <strong>Registrar movimiento / Transferir:</strong> Anota ingresos, gastos o pasa plata entre tus cuentas.<br />
                    • <strong>Deudas, Suscrip. y Deseos:</strong> Controla lo que debes, tus cobros mensuales y tus metas de compra.
                  </div>
                  <button
                    type="button"
                    onClick={goToAddAccount}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '11px',
                      border: 'none',
                      backgroundColor: theme.accentBlue,
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Empezar: Agregar mi primera cuenta
                  </button>
                </section>
              )}

            {/* Cuadro Principal: Plata disponible */}
            <section
              style={{
                background: theme.availableCard,
                border: `1.5px solid ${theme.availableBorder}`,
                borderRadius: '20px',
                padding: '20px',
                boxShadow: theme.availableShadow,
                transition: `all 0.3s ${iosEase}`,
              }}
            >
              <div
                onClick={() => setAccountsExpanded((prev) => !prev)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: theme.iconCircleBg,
                      color: theme.iconCircleColor,
                      border: theme.iconCircleBorder,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <rect x="2" y="5" width="20" height="14" rx="3" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.8px',
                      color: theme.availableLabelColor,
                      textTransform: 'uppercase',
                    }}
                  >
                    Plata disponible
                  </span>
                </div>

                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#93C5FD',
                    backgroundColor: 'rgba(37, 99, 235, 0.24)',
                    padding: '4px 10px',
                    borderRadius: '999px',
                  }}
                >
                  {data.accounts.length} {data.accounts.length === 1 ? 'cuenta' : 'cuentas'} {accountsExpanded ? '▲' : '▼'}
                </span>
              </div>

              <div style={{ marginBottom: '12px' }}>
                {renderBigCurrencyAmount(totalAvailable, 32)}
              </div>

              <div className={`smooth-collapse ${accountsExpanded ? 'open' : 'closed'}`}>
                <div className="smooth-collapse-inner">
                  <div
                    style={{
                      backgroundColor: theme.availableSubCardBg,
                      border: `1px solid ${theme.availableSubCardBorder}`,
                      borderRadius: '14px',
                      padding: '10px 12px',
                      marginBottom: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {data.accounts.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '12px', color: theme.availableMutedColor }}>
                          No tienes cuentas agregadas aún. Crea tu primera cuenta (ej. Nequi, Bancolombia o Efectivo) para empezar.
                        </div>
                        <button
                          type="button"
                          onClick={goToAddAccount}
                          style={{
                            alignSelf: 'flex-start',
                            padding: '7px 12px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: theme.accentBlue,
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          + Agregar cuenta
                        </button>
                      </div>
                    ) : (
                      data.accounts.map((acc) => (
                        <div
                          key={acc.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '13px',
                            padding: '4px 0',
                          }}
                        >
                          <span style={{ color: '#F1F5F9', fontWeight: 600 }}>{acc.name}</span>
                          <span style={{ color: '#93C5FD', fontWeight: 700 }}>{renderMoney(acc.balance)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.7px',
                  color: theme.availableMutedColor,
                  marginBottom: '8px',
                }}
              >
                HOY
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div
                  style={{
                    backgroundColor: theme.availableSubCardBg,
                    border: `1px solid ${theme.availableSubCardBorder}`,
                    borderRadius: '14px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      background: theme.iconCircleBg,
                      color: theme.iconCircleColor,
                      border: theme.iconCircleBorder,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    +
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: theme.availableLabelColor, marginBottom: '2px' }}>
                      Ingresos
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#34D399' }}>
                      +{renderMoney(todayIncome)}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: theme.availableSubCardBg,
                    border: `1px solid ${theme.availableSubCardBorder}`,
                    borderRadius: '14px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      background: theme.iconCircleBg,
                      color: theme.iconCircleColor,
                      border: theme.iconCircleBorder,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    -
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: theme.availableLabelColor, marginBottom: '2px' }}>
                      Gastos
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#F87171' }}>
                      -{renderMoney(todayExpense)}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Tarjeta de Deudas */}
            <section
              className="debt-row-anim"
              onClick={() => setShowDebtSectionModal(true)}
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '18px',
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.7px',
                    color: theme.textSecondary,
                    marginBottom: '4px',
                  }}
                >
                  DEUDAS
                </div>
                <div>
                  {renderBigCurrencyAmount(
                    totalDebts,
                    24,
                    totalDebts > 0
                      ? {
                          fontSize: '24px',
                          fontWeight: 800,
                          color: theme.danger,
                        }
                      : {
                          fontSize: '24px',
                          fontWeight: 800,
                          color: theme.textPrimary,
                        }
                  )}
                </div>
                <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '2px' }}>
                  {data.debts.length === 0
                    ? 'Sin deudas • Toca para ver o agregar'
                    : `${data.debts.length} ${data.debts.length === 1 ? 'deuda activa' : 'deudas activas'} • Toca para ver o abonar`}
                </div>
              </div>

              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: theme.iconCircleBg,
                  color: theme.iconCircleColor,
                  border: theme.iconCircleBorder,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </div>
            </section>

            {/* Botones de acción: Transferir a la izquierda y Registrar movimiento a la derecha */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: '8px' }}>
              <button
                type="button"
                onClick={openTransferDialog}
                style={{
                  width: '100%',
                  padding: '14px 10px',
                  borderRadius: '16px',
                  border: `1.5px solid ${theme.accentBlue}`,
                  backgroundColor: theme.accentBlueSoft,
                  color: theme.accentBlueText,
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ⇄ Transferir
              </button>

              <button
                type="button"
                onClick={openTransactionModal}
                style={{
                  width: '100%',
                  padding: '14px 12px',
                  borderRadius: '16px',
                  border: 'none',
                  backgroundColor: theme.accentBlue,
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(37, 99, 235, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span> Registrar movimiento
              </button>
            </div>

            {/* Movimientos recientes en Inicio (máximo 6 + botón Ver más) */}
            <section style={{ marginTop: '4px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: 700 }}>Movimientos</span>
                <span style={{ fontSize: '12px', color: theme.textMuted }}>
                  {data.transactions.length > 6
                    ? `Mostrando 6 de ${data.transactions.length}`
                    : `${data.transactions.length} en total`}
                </span>
              </div>

              {recentGroupedTransactions.length === 0 ? (
                <div
                  style={{
                    backgroundColor: theme.cardSolid,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '16px',
                    padding: '20px',
                    textAlign: 'center',
                    color: theme.textMuted,
                    fontSize: '13px',
                  }}
                >
                  No hay movimientos registrados.
                </div>
              ) : (
                <>
                  {renderTransactionListGroups(recentGroupedTransactions)}

                  {data.transactions.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('movimientos')}
                      style={{
                        width: '100%',
                        marginTop: '12px',
                        padding: '12px',
                        borderRadius: '14px',
                        border: `1.5px solid ${theme.accentBlue}`,
                        backgroundColor: theme.accentBlueSoft,
                        color: theme.accentBlueText,
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: `all 0.22s ${iosEase}`,
                      }}
                    >
                      Ver más ({data.transactions.length - 6} movimientos más)
                    </button>
                  )}
                </>
              )}
            </section>
          </div>
        )}

        {/* ================= PESTAÑA DEDICADA DE TODOS LOS MOVIMIENTOS CON FILTROS ================= */}
        {activeTab === 'movimientos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <div>
                <h2 style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>Todos los movimientos</h2>
                <p style={{ fontSize: '12px', color: theme.textSecondary, margin: '3px 0 0' }}>
                  {filteredAllTransactions.length} {filteredAllTransactions.length === 1 ? 'resultado' : 'resultados'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('inicio')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: `1px solid ${theme.borderStrong}`,
                  backgroundColor: theme.cardSolid,
                  color: theme.textPrimary,
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ← Inicio
              </button>
            </div>

            <div
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '16px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {[
                  { id: 'todos', label: 'Todos' },
                  { id: 'ingreso', label: 'Ingresos' },
                  { id: 'gasto', label: 'Gastos' },
                ].map((flt) => {
                  const active = txFilterType === flt.id;
                  return (
                    <button
                      key={flt.id}
                      type="button"
                      onClick={() => setTxFilterType(flt.id)}
                      style={{
                        padding: '8px 6px',
                        borderRadius: '10px',
                        border: active ? `1.5px solid ${theme.accentBlue}` : `1px solid ${theme.border}`,
                        backgroundColor: active ? theme.accentBlueSoft : theme.cardSubtle,
                        color: active ? theme.accentBlueText : theme.textSecondary,
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {flt.label}
                    </button>
                  );
                })}
              </div>

              <select
                value={txFilterAccountId}
                onChange={(e) => setTxFilterAccountId(e.target.value)}
                style={baseInputStyle}
              >
                <option value="todas">Todas las cuentas</option>
                {data.accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            {filteredGroupedTransactions.length === 0 ? (
              <div
                style={{
                  backgroundColor: theme.cardSolid,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '16px',
                  padding: '22px',
                  textAlign: 'center',
                  color: theme.textMuted,
                  fontSize: '13px',
                }}
              >
                No hay movimientos que coincidan con este filtro.
              </div>
            ) : (
              renderTransactionListGroups(filteredGroupedTransactions)
            )}
          </div>
        )}

        {/* ================= PESTAÑA ESTADÍSTICAS ================= */}
        {activeTab === 'estadisticas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <div>
                <h2 style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>Estadísticas</h2>
                <div style={{ fontSize: '12px', fontWeight: 600, color: theme.accentBlueText, marginTop: '3px' }}>
                  {statsPeriodSubtitle}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                {[
                  { id: 'dia', label: 'Día' },
                  { id: 'semana', label: 'Semana' },
                  { id: 'mes', label: 'Mes' },
                ].map((p) => {
                  const active = statsPeriod === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setStatsPeriod(p.id)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '10px',
                        border: active ? `1.5px solid ${theme.accentBlue}` : `1px solid ${theme.border}`,
                        backgroundColor: active ? theme.accentBlueSoft : theme.cardSubtle,
                        color: active ? theme.accentBlueText : theme.textSecondary,
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Siempre arriba: Ingresos vs Gastos */}
            <section
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '18px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 700 }}>Ingresos vs Gastos</div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ color: theme.textSecondary, fontWeight: 600 }}>Ingresos</span>
                  <span style={{ color: theme.success, fontWeight: 700 }}>{renderMoney(totalAllIncomes)}</span>
                </div>
                <div style={{ height: '12px', borderRadius: '999px', backgroundColor: theme.cardSubtle, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.round((totalAllIncomes / totalCompare) * 100)}%`,
                      height: '100%',
                      backgroundColor: theme.success,
                      borderRadius: '999px',
                      transition: `width 0.4s ${iosEase}`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ color: theme.textSecondary, fontWeight: 600 }}>Gastos</span>
                  <span style={{ color: theme.danger, fontWeight: 700 }}>{renderMoney(totalAllExpenses)}</span>
                </div>
                <div style={{ height: '12px', borderRadius: '999px', backgroundColor: theme.cardSubtle, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.round((totalAllExpenses / totalCompare) * 100)}%`,
                      height: '100%',
                      backgroundColor: theme.danger,
                      borderRadius: '999px',
                      transition: `width 0.4s ${iosEase}`,
                    }}
                  />
                </div>
              </div>
            </section>

            {/* Debajo: ordenado dinámicamente poniendo arriba el que mayor total tiene */}
            {categoryBreakdownBlocks.map((block) => {
              const isOpen = !!openStats[block.key];
              return (
                <section
                  key={block.key}
                  style={{
                    background: theme.card,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '18px',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleStat(block.key)}
                    style={{
                      width: '100%',
                      padding: '15px 16px',
                      background: 'none',
                      border: 'none',
                      color: theme.textPrimary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700 }}>{block.title}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: block.amountColor }}>
                        ({renderMoney(block.total)})
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: theme.textSecondary }}>
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </button>

                  <div className={`smooth-collapse ${isOpen ? 'open' : 'closed'}`}>
                    <div className="smooth-collapse-inner">
                      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {block.entries.length === 0 ? (
                          <div style={{ fontSize: '13px', color: theme.textMuted }}>{block.emptyText}</div>
                        ) : (
                          block.entries.map(([cat, amt]) => (
                            <div
                              key={cat}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                backgroundColor: theme.cardSubtle,
                                border: `1px solid ${theme.border}`,
                                borderRadius: '12px',
                                padding: '10px 12px',
                                fontSize: '13px',
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{cat}</span>
                              <span style={{ fontWeight: 700, color: block.amountColor }}>{renderMoney(amt)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* ================= PESTAÑA SUSCRIPCIONES ================= */}
        {activeTab === 'suscripciones' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <div>
                <h2 style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>Suscripciones</h2>
                <p style={{ fontSize: '12px', color: theme.textSecondary, margin: '3px 0 0' }}>
                  Próxima a cobrar primero; ya cobradas al final
                </p>
              </div>
              {data.subscriptions.length > 0 && (
                <button
                  type="button"
                  onClick={() => openOnlySectionInConfig('editarSuscripciones')}
                  style={{
                    padding: '7px 11px',
                    borderRadius: '10px',
                    border: `1px solid ${theme.borderStrong}`,
                    backgroundColor: theme.cardSolid,
                    color: theme.accentBlueText,
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Editar en Config
                </button>
              )}
            </div>



            {subError && (
              <div
                style={{
                  backgroundColor: theme.dangerBg,
                  border: `1px solid ${theme.danger}`,
                  color: theme.danger,
                  borderRadius: '12px',
                  padding: '10px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {subError}
              </div>
            )}

            <form
              onSubmit={handleAddSubscription}
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '18px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Ej: Netflix / Spotify"
                  value={subName}
                  onChange={(e) => {
                    setSubName(e.target.value);
                    if (subError) setSubError('');
                  }}
                  style={baseInputStyle}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Valor (Ej: 30.000)"
                  value={subPrice}
                  onChange={(e) => {
                    setSubPrice(formatMoneyInput(e.target.value));
                    if (subError) setSubError('');
                  }}
                  style={baseInputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.3fr)', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: theme.textSecondary, display: 'block', marginBottom: '4px' }}>
                    Día del mes (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={subBillingDay}
                    onChange={(e) => setSubBillingDay(e.target.value)}
                    style={baseInputStyle}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: theme.textSecondary, display: 'block', marginBottom: '4px' }}>
                    ¿De qué dinero saldrá?
                  </label>
                  <select
                    value={subAccountId}
                    onChange={(e) => {
                      setSubAccountId(e.target.value);
                      if (subError) setSubError('');
                    }}
                    style={baseInputStyle}
                  >
                    {data.accounts.length === 0 ? (
                      <option value="">Sin cuentas</option>
                    ) : (
                      data.accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({formatMoneyByCurrency(acc.balance, currency)})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: theme.accentBlue,
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + Agregar suscripción
              </button>
            </form>

            {computedSubscriptions.length === 0 ? (
              <div
                style={{
                  backgroundColor: theme.cardSolid,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '16px',
                  padding: '22px',
                  textAlign: 'center',
                  color: theme.textMuted,
                  fontSize: '13px',
                }}
              >
                No tienes suscripciones registradas todavía.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {computedSubscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    style={{
                      background: theme.card,
                      border: `1px solid ${
                        sub.isOverdue
                          ? theme.danger
                          : sub.isDueToday
                          ? '#FACC15'
                          : sub.chargedThisMonth
                          ? theme.border
                          : theme.borderStrong
                      }`,
                      borderRadius: '15px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      opacity: sub.chargedThisMonth ? 0.78 : 1,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700 }}>{sub.name}</span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            backgroundColor: sub.badgeBg,
                            color: sub.badgeColor,
                          }}
                        >
                          {sub.badgeText}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '3px' }}>
                        {sub.isOverdue ? 'Debió cobrarse el' : 'Se cobra el'} <strong>{sub.dateLabel}</strong> • Sale de:{' '}
                        <strong>{sub.accountName}</strong>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: theme.danger, marginTop: '2px' }}>
                        {renderMoney(sub.price)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {!sub.chargedThisMonth && (
                        <button
                          type="button"
                          onClick={() => setSubToChargeConfirm(sub)}
                          style={{
                            padding: '7px 10px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: theme.accentBlue,
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Cobrar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSubToDelete(sub)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: theme.dangerBg,
                          color: theme.danger,
                          cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= PESTAÑA DESEOS ================= */}
        {activeTab === 'deseos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <div>
                <h2 style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>Lista de Deseos</h2>
                <p style={{ fontSize: '12px', color: theme.textSecondary, margin: '3px 0 0' }}>
                  Mantén presionado el agarre izquierdo para ordenar
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {data.wishes.length > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: theme.textMuted }}>Total estimado</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: theme.accentBlueText }}>
                      {renderMoney(totalWishesValue)}
                    </div>
                  </div>
                )}
                {data.wishes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => openOnlySectionInConfig('editarDeseos')}
                    style={{
                      padding: '7px 11px',
                      borderRadius: '10px',
                      border: `1px solid ${theme.borderStrong}`,
                      backgroundColor: theme.cardSolid,
                      color: theme.accentBlueText,
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Editar en Config
                  </button>
                )}
              </div>
            </div>

            {wishFormAlert && (
              <div
                style={{
                  backgroundColor: theme.dangerBg,
                  border: `1px solid ${theme.danger}`,
                  color: theme.danger,
                  borderRadius: '12px',
                  padding: '10px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {wishFormAlert}
              </div>
            )}

            <form
              onSubmit={handleAddWish}
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '18px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Ej: Gafas"
                  value={wishName}
                  onChange={(e) => {
                    setWishName(e.target.value);
                    if (wishFormAlert) setWishFormAlert('');
                  }}
                  style={baseInputStyle}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej: 180.000"
                  value={wishPrice}
                  onChange={(e) => {
                    setWishPrice(formatMoneyInput(e.target.value));
                    if (wishFormAlert) setWishFormAlert('');
                  }}
                  style={baseInputStyle}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: theme.accentBlue,
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + Agregar deseo
              </button>
            </form>

            {data.wishes.length === 0 ? (
              <div
                style={{
                  backgroundColor: theme.cardSolid,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '16px',
                  padding: '22px',
                  textAlign: 'center',
                  color: theme.textMuted,
                  fontSize: '13px',
                }}
              >
                Agrega un deseo y su valor para organizar tus prioridades.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.wishes.map((wish, idx) => {
                  const rankStyle = getWishRankStyle(idx);
                  return (
                    <div
                      key={wish.id}
                      draggable
                      onDragStart={() => setDragIndex(idx)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverIndex(idx);
                      }}
                      onDrop={() => {
                        reorderWishes(dragIndex, idx);
                        setDragIndex(null);
                        setDragOverIndex(null);
                      }}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setDragOverIndex(null);
                      }}
                      style={{
                        background: theme.card,
                        border:
                          dragOverIndex === idx
                            ? `1.5px solid ${theme.accentBlue}`
                            : `1px solid ${rankStyle.cardBorder}`,
                        borderRadius: '15px',
                        padding: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        opacity: dragIndex === idx ? 0.72 : 1,
                        transition: `transform 0.24s ${iosEase}, border-color 0.2s ${iosEase}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div
                          onTouchStart={(e) => handleTouchStartGrip(idx, e)}
                          onTouchMove={handleTouchMoveGrip}
                          onTouchEnd={handleTouchEndGrip}
                          title="Mantén presionado y arrastra"
                          style={{
                            width: '28px',
                            height: '38px',
                            borderRadius: '8px',
                            backgroundColor: theme.cardSubtle,
                            color: theme.textSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'grab',
                            touchAction: 'none',
                            userSelect: 'none',
                            flexShrink: 0,
                            fontSize: '15px',
                          }}
                        >
                          ⋮⋮
                        </div>

                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: rankStyle.badgeBg,
                            color: rankStyle.badgeColor,
                            fontSize: '12px',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {idx + 1}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '14px',
                              fontWeight: 700,
                              color: theme.textPrimary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {wish.name}
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: rankStyle.amountColor }}>
                            {renderMoney(wish.price)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => reorderWishes(idx, idx - 1)}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            border: `1px solid ${theme.border}`,
                            backgroundColor: theme.cardSubtle,
                            color: idx === 0 ? theme.textMuted : theme.textPrimary,
                            opacity: idx === 0 ? 0.4 : 1,
                            cursor: idx === 0 ? 'default' : 'pointer',
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={idx === data.wishes.length - 1}
                          onClick={() => reorderWishes(idx, idx + 1)}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            border: `1px solid ${theme.border}`,
                            backgroundColor: theme.cardSubtle,
                            color: idx === data.wishes.length - 1 ? theme.textMuted : theme.textPrimary,
                            opacity: idx === data.wishes.length - 1 ? 0.4 : 1,
                            cursor: idx === data.wishes.length - 1 ? 'default' : 'pointer',
                          }}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => setWishToDelete(wish)}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: theme.dangerBg,
                            color: theme.danger,
                            cursor: 'pointer',
                            marginLeft: '2px',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= PESTAÑA CONFIGURACIÓN ================= */}
        {activeTab === 'config' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 style={{ fontSize: '19px', fontWeight: 700, margin: '0 0 2px' }}>Configuración</h2>

            {needsWeeklyBackupReminder && (
              <div
                style={{
                  backgroundColor: theme.warningBg,
                  border: `1px solid ${theme.warning}`,
                  color: theme.warning,
                  borderRadius: '12px',
                  padding: '10px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                Recordatorio semanal: hace más de 7 días que no guardas un respaldo de tu información.
              </div>
            )}

            {configNotice && (
              <div
                style={{
                  backgroundColor: theme.accentBlueSoft,
                  border: `1px solid ${theme.accentBlue}`,
                  color: theme.accentBlueText,
                  borderRadius: '12px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {configNotice}
              </div>
            )}

            {/* 1. PERFIL Y MONEDA */}
            <section
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '18px',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => toggleSection('perfil')}
                style={{
                  width: '100%',
                  padding: '15px 16px',
                  background: 'none',
                  border: 'none',
                  color: theme.textPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 700 }}>Perfil y moneda</span>
                <span style={{ fontSize: '12px', color: theme.textSecondary }}>
                  {openSections.perfil ? '▲' : '▼'}
                </span>
              </button>

              <div className={`smooth-collapse ${openSections.perfil ? 'open' : 'closed'}`}>
                <div className="smooth-collapse-inner">
                  <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: theme.textSecondary, display: 'block', marginBottom: '6px' }}>
                        Tu nombre
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Roynhel"
                        value={data.userName}
                        onChange={(e) => setData((prev) => ({ ...prev, userName: e.target.value }))}
                        style={baseInputStyle}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: theme.textSecondary, display: 'block', marginBottom: '6px' }}>
                        Moneda principal (en montos grandes)
                      </label>
                      <select
                        value={currency}
                        onChange={(e) => setData((prev) => ({ ...prev, currency: e.target.value }))}
                        style={baseInputStyle}
                      >
                        {CURRENCY_OPTIONS.map((opt) => (
                          <option key={opt.code} value={opt.code}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '2px' }}>
                      <button
                        type="button"
                        onClick={handleExportData}
                        style={{
                          padding: '10px',
                          borderRadius: '10px',
                          border: `1.5px solid ${theme.accentBlue}`,
                          backgroundColor: theme.accentBlueSoft,
                          color: theme.accentBlueText,
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Exportar información
                      </button>
                      <button
                        type="button"
                        onClick={() => importInputRef.current?.click()}
                        style={{
                          padding: '10px',
                          borderRadius: '10px',
                          border: `1.5px solid ${theme.accentBlue}`,
                          backgroundColor: theme.accentBlueSoft,
                          color: theme.accentBlueText,
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Importar información
                      </button>
                      <input
                        ref={importInputRef}
                        type="file"
                        accept="application/json"
                        onChange={handleImportFile}
                        style={{ display: 'none' }}
                      />
                    </div>

                    <div style={{ fontSize: '11px', color: theme.textMuted }}>
                      Último respaldo:{' '}
                      {data.lastBackupAt ? formatDateTimeLabel(data.lastBackupAt) : 'Aún no has exportado'}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. APARIENCIA */}
            <section
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '18px',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => toggleSection('apariencia')}
                style={{
                  width: '100%',
                  padding: '15px 16px',
                  background: 'none',
                  border: 'none',
                  color: theme.textPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 700 }}>Apariencia</span>
                <span style={{ fontSize: '12px', color: theme.textSecondary }}>
                  {openSections.apariencia ? '▲' : '▼'}
                </span>
              </button>

              <div className={`smooth-collapse ${openSections.apariencia ? 'open' : 'closed'}`}>
                <div className="smooth-collapse-inner">
                  <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {[
                      { id: 'dark', label: 'Negro' },
                      { id: 'light', label: 'Claro' },
                      { id: 'system', label: 'Sistema' },
                    ].map((opt) => {
                      const selected = data.theme === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setData((prev) => ({ ...prev, theme: opt.id }))}
                          style={{
                            padding: '10px 8px',
                            borderRadius: '12px',
                            border: selected ? `1.5px solid ${theme.accentBlue}` : `1px solid ${theme.border}`,
                            backgroundColor: selected ? theme.accentBlueSoft : theme.cardSubtle,
                            color: selected ? theme.accentBlueText : theme.textPrimary,
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: `all 0.22s ${iosEase}`,
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* 3. CUENTAS Y PLATA */}
            <section
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '18px',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => toggleSection('cuentas')}
                style={{
                  width: '100%',
                  padding: '15px 16px',
                  background: 'none',
                  border: 'none',
                  color: theme.textPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 700 }}>
                  Cuentas y plata ({data.accounts.length})
                </span>
                <span style={{ fontSize: '12px', color: theme.textSecondary }}>
                  {openSections.cuentas ? '▲' : '▼'}
                </span>
              </button>

              <div className={`smooth-collapse ${openSections.cuentas ? 'open' : 'closed'}`}>
                <div className="smooth-collapse-inner">
                  <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {accFormAlert && (
                      <div
                        style={{
                          backgroundColor: theme.dangerBg,
                          border: `1px solid ${theme.danger}`,
                          color: theme.danger,
                          borderRadius: '10px',
                          padding: '8px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {accFormAlert}
                      </div>
                    )}

                    {data.accounts.length === 0 ? (
                      <div
                        style={{
                          fontSize: '12px',
                          color: theme.textMuted,
                          backgroundColor: theme.cardSubtle,
                          padding: '10px 12px',
                          borderRadius: '10px',
                        }}
                      >
                        Agrega una cuenta abajo (Ej: <strong>Nequi</strong> y <strong>50.000</strong>).
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {data.accounts.map((acc) => (
                          <div
                            key={acc.id}
                            style={{
                              backgroundColor: theme.cardSubtle,
                              border: `1px solid ${theme.border}`,
                              borderRadius: '12px',
                              padding: '10px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                            }}
                          >
                            <span style={{ fontSize: '14px', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {acc.name}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={Number(acc.balance).toLocaleString('es-CO')}
                                onChange={(e) => handleUpdateAccountBalance(acc.id, e.target.value)}
                                style={{
                                  width: '104px',
                                  minWidth: 0,
                                  boxSizing: 'border-box',
                                  textAlign: 'right',
                                  backgroundColor: theme.inputBg,
                                  border: `1px solid ${theme.border}`,
                                  borderRadius: '8px',
                                  padding: '6px 8px',
                                  color: theme.textPrimary,
                                  fontSize: '13px',
                                  fontWeight: 700,
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => requestDeleteAccount(acc)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: theme.danger,
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  padding: '4px',
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {data.skipAccountDeleteConfirm && (
                      <div style={{ paddingTop: '2px' }}>
                        <button
                          type="button"
                          onClick={() => setShowReenableAccPrompt(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: theme.accentBlueText,
                            fontSize: '12px',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                          }}
                        >
                          Volver a preguntar al borrar cuenta
                        </button>
                      </div>
                    )}

                    <form onSubmit={handleAddAccount} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Ej: Nequi"
                          value={newAccName}
                          onChange={(e) => {
                            setNewAccName(e.target.value);
                            if (accFormAlert) setAccFormAlert('');
                          }}
                          style={baseInputStyle}
                        />
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Ej: 50.000"
                          value={newAccBalance}
                          onChange={(e) => setNewAccBalance(formatMoneyInput(e.target.value))}
                          style={baseInputStyle}
                        />
                      </div>
                      <button
                        type="submit"
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '10px',
                          border: 'none',
                          backgroundColor: theme.accentBlue,
                          color: '#FFFFFF',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        + Agregar cuenta
                      </button>
                    </form>

                    {/* Precios predeterminados rápidos (máximo 5) */}
                    <div
                      style={{
                        borderTop: `1px solid ${theme.border}`,
                        paddingTop: '12px',
                        marginTop: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700 }}>
                          Precios predeterminados ({(data.quickAmounts || []).length}/5)
                        </span>
                        <span style={{ fontSize: '11px', color: theme.textMuted }}>
                          Máx. 5
                        </span>
                      </div>

                      <div style={{ fontSize: '11px', color: theme.textSecondary, lineHeight: 1.35 }}>
                        Aparecerán como botones rápidos al registrar un movimiento para no escribirlos cada vez.
                      </div>

                      {quickAmountAlert && (
                        <div
                          style={{
                            backgroundColor: theme.dangerBg,
                            border: `1px solid ${theme.danger}`,
                            color: theme.danger,
                            borderRadius: '10px',
                            padding: '7px 10px',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          {quickAmountAlert}
                        </div>
                      )}

                      {(data.quickAmounts || []).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {(data.quickAmounts || []).map((amt) => (
                            <span
                              key={amt}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 10px',
                                borderRadius: '999px',
                                backgroundColor: theme.accentBlueSoft,
                                border: `1px solid ${theme.accentBlue}`,
                                color: theme.accentBlueText,
                                fontSize: '12px',
                                fontWeight: 700,
                              }}
                            >
                              <span>{formatMoneyByCurrency(amt, currency)}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveQuickAmount(amt)}
                                title="Quitar precio"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: theme.accentBlueText,
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  padding: 0,
                                  lineHeight: 1,
                                }}
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {(data.quickAmounts || []).length < 5 && (
                        <form onSubmit={handleAddQuickAmount} style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Ej: 10.000"
                            value={newQuickAmount}
                            onChange={(e) => {
                              setNewQuickAmount(formatMoneyInput(e.target.value));
                              if (quickAmountAlert) setQuickAmountAlert('');
                            }}
                            style={{ ...baseInputStyle, flex: 1 }}
                          />
                          <button
                            type="submit"
                            style={{
                              padding: '10px 14px',
                              borderRadius: '10px',
                              border: 'none',
                              backgroundColor: theme.accentBlue,
                              color: '#FFFFFF',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            + Precio
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 4. CATEGORÍAS Y SUBCATEGORÍAS OPCIONALES */}
            <section
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '18px',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => toggleSection('categorias')}
                style={{
                  width: '100%',
                  padding: '15px 16px',
                  background: 'none',
                  border: 'none',
                  color: theme.textPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 700 }}>
                  Categorías y subcategorías ({data.categories.length})
                </span>
                <span style={{ fontSize: '12px', color: theme.textSecondary }}>
                  {openSections.categorias ? '▲' : '▼'}
                </span>
              </button>

              <div className={`smooth-collapse ${openSections.categorias ? 'open' : 'closed'}`}>
                <div className="smooth-collapse-inner">
                  <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {catFormAlert && (
                      <div
                        style={{
                          backgroundColor: theme.dangerBg,
                          border: `1px solid ${theme.danger}`,
                          color: theme.danger,
                          borderRadius: '10px',
                          padding: '8px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {catFormAlert}
                      </div>
                    )}

                    {data.categories.length === 0 ? (
                      <div
                        style={{
                          fontSize: '12px',
                          color: theme.textMuted,
                          backgroundColor: theme.cardSubtle,
                          padding: '10px 12px',
                          borderRadius: '10px',
                        }}
                      >
                        Agrega una categoría. Luego podrás añadirle subcategorías opcionales (ej. Carrera, Recarga, Gasolina, Parqueo).
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {data.categories.map((cat) => {
                          const subcats = Array.isArray(cat.subcategories) ? cat.subcategories : [];
                          return (
                            <div
                              key={cat.id}
                              style={{
                                backgroundColor: theme.cardSubtle,
                                border: `1px solid ${theme.border}`,
                                borderRadius: '12px',
                                padding: '10px 12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {cat.icon && cat.icon !== 'none' ? (
                                    <CategoryGlyph iconId={cat.icon} size={15} color={theme.textSecondary} />
                                  ) : null}
                                  <span style={{ fontSize: '14px', fontWeight: 700 }}>{cat.name}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => requestDeleteCategory(cat)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: theme.danger,
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    padding: '2px 4px',
                                  }}
                                >
                                  ✕
                                </button>
                              </div>

                              {subcats.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {subcats.map((sub) => (
                                    <span
                                      key={sub}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '4px 9px',
                                        borderRadius: '999px',
                                        backgroundColor: theme.accentBlueSoft,
                                        color: theme.accentBlueText,
                                        fontSize: '11px',
                                        fontWeight: 700,
                                      }}
                                    >
                                      <span>{sub}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveSubcategory(cat.id, sub)}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          color: theme.accentBlueText,
                                          cursor: 'pointer',
                                          fontSize: '11px',
                                          padding: 0,
                                        }}
                                      >
                                        ✕
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                  type="text"
                                  placeholder={`Nueva subcategoría en ${cat.name} (opcional)`}
                                  value={subcatDraftByCatId[cat.id] || ''}
                                  onChange={(e) =>
                                    setSubcatDraftByCatId((prev) => ({ ...prev, [cat.id]: e.target.value }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddSubcategory(cat.id);
                                    }
                                  }}
                                  style={{ ...baseInputStyle, fontSize: '12px', padding: '7px 9px' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddSubcategory(cat.id)}
                                  style={{
                                    padding: '7px 10px',
                                    borderRadius: '9px',
                                    border: `1px solid ${theme.accentBlue}`,
                                    backgroundColor: theme.accentBlueSoft,
                                    color: theme.accentBlueText,
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  + Sub
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {data.skipCategoryDeleteConfirm && (
                      <div style={{ paddingTop: '2px' }}>
                        <button
                          type="button"
                          onClick={() => setShowReenableCatPrompt(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: theme.accentBlueText,
                            fontSize: '12px',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                          }}
                        >
                          Volver a preguntar
                        </button>
                      </div>
                    )}

                    <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                      <div style={{ fontSize: '11px', color: theme.textSecondary }}>
                        Crear nueva categoría
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {ICON_OPTIONS.map((ic) => {
                          const active = newCatIcon === ic.id;
                          return (
                            <button
                              key={ic.id}
                              type="button"
                              title={ic.label}
                              onClick={() => setNewCatIcon(ic.id)}
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '10px',
                                border: active ? `1.5px solid ${theme.accentBlue}` : `1px solid ${theme.border}`,
                                backgroundColor: active ? theme.accentBlueSoft : theme.inputBg,
                                color: active ? theme.accentBlueText : theme.textSecondary,
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {ic.id === 'none' ? '✕' : <CategoryGlyph iconId={ic.id} size={16} color="currentColor" />}
                            </button>
                          );
                        })}
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Ej: Gastos del carro"
                          value={newCatName}
                          onChange={(e) => {
                            setNewCatName(e.target.value);
                            if (catFormAlert) setCatFormAlert('');
                          }}
                          style={{ ...baseInputStyle, flex: 1 }}
                        />
                        <button
                          type="submit"
                          style={{
                            padding: '10px 14px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: theme.accentBlue,
                            color: '#FFFFFF',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          + Agregar
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </section>

            {/* 5. DEUDAS */}
            <section
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '18px',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => toggleSection('deudas')}
                style={{
                  width: '100%',
                  padding: '15px 16px',
                  background: 'none',
                  border: 'none',
                  color: theme.textPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 700 }}>Deudas ({data.debts.length})</span>
                <span style={{ fontSize: '12px', color: theme.textSecondary }}>
                  {openSections.deudas ? '▲' : '▼'}
                </span>
              </button>

              <div className={`smooth-collapse ${openSections.deudas ? 'open' : 'closed'}`}>
                <div className="smooth-collapse-inner">
                  <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {debtFormAlert && (
                      <div
                        style={{
                          backgroundColor: theme.dangerBg,
                          border: `1px solid ${theme.danger}`,
                          color: theme.danger,
                          borderRadius: '10px',
                          padding: '8px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {debtFormAlert}
                      </div>
                    )}

                    {data.debts.length === 0 ? (
                      <div
                        style={{
                          fontSize: '12px',
                          color: theme.textMuted,
                          backgroundColor: theme.cardSubtle,
                          padding: '10px 12px',
                          borderRadius: '10px',
                        }}
                      >
                        Agrega una deuda abajo (Ej: <strong>Tarjeta</strong> y <strong>200.000</strong>).
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {data.debts.map((debt, idx) => {
                          const dStyle = getDebtRankStyle(idx);
                          return (
                            <div
                              key={debt.id}
                              className="debt-row-anim"
                              style={{
                                backgroundColor: theme.cardSubtle,
                                border: `1px solid ${dStyle.border}`,
                                borderRadius: '12px',
                                padding: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '6px',
                              }}
                            >
                              <span
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  backgroundColor: dStyle.badgeBg,
                                  color: dStyle.badgeColor,
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {idx + 1}
                              </span>

                              <input
                                type="text"
                                value={debt.name}
                                onChange={(e) => handleUpdateDebtName(debt.id, e.target.value)}
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  backgroundColor: theme.inputBg,
                                  border: `1px solid ${theme.border}`,
                                  borderRadius: '8px',
                                  padding: '6px 8px',
                                  color: theme.textPrimary,
                                  fontSize: '12px',
                                  fontWeight: 600,
                                }}
                              />

                              <input
                                type="text"
                                inputMode="numeric"
                                value={Number(debt.amount).toLocaleString('es-CO')}
                                onChange={(e) => handleUpdateDebtAmount(debt.id, e.target.value)}
                                style={{
                                  width: '86px',
                                  minWidth: 0,
                                  boxSizing: 'border-box',
                                  textAlign: 'right',
                                  backgroundColor: theme.inputBg,
                                  border: `1px solid ${theme.border}`,
                                  borderRadius: '8px',
                                  padding: '6px 7px',
                                  color: dStyle.amountColor,
                                  fontSize: '12px',
                                  fontWeight: 700,
                                }}
                              />

                              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => reorderDebts(idx, idx - 1)}
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '6px',
                                    border: `1px solid ${theme.border}`,
                                    backgroundColor: theme.inputBg,
                                    color: theme.textPrimary,
                                    opacity: idx === 0 ? 0.35 : 1,
                                    fontSize: '11px',
                                    cursor: idx === 0 ? 'default' : 'pointer',
                                  }}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === data.debts.length - 1}
                                  onClick={() => reorderDebts(idx, idx + 1)}
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '6px',
                                    border: `1px solid ${theme.border}`,
                                    backgroundColor: theme.inputBg,
                                    color: theme.textPrimary,
                                    opacity: idx === data.debts.length - 1 ? 0.35 : 1,
                                    fontSize: '11px',
                                    cursor: idx === data.debts.length - 1 ? 'default' : 'pointer',
                                  }}
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => requestDeleteDebt(debt)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: theme.textMuted,
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    padding: '2px 4px',
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {data.skipDebtDeleteConfirm && (
                      <div style={{ paddingTop: '2px' }}>
                        <button
                          type="button"
                          onClick={() => setShowReenableDebtPrompt(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: theme.accentBlueText,
                            fontSize: '12px',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                          }}
                        >
                          Volver a preguntar al borrar deuda
                        </button>
                      </div>
                    )}

                    <form onSubmit={handleAddDebt} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Ej: Tarjeta"
                          value={newDebtName}
                          onChange={(e) => {
                            setNewDebtName(e.target.value);
                            if (debtFormAlert) setDebtFormAlert('');
                          }}
                          style={baseInputStyle}
                        />
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Ej: 200.000"
                          value={newDebtAmount}
                          onChange={(e) => {
                            setNewDebtAmount(formatMoneyInput(e.target.value));
                            if (debtFormAlert) setDebtFormAlert('');
                          }}
                          style={baseInputStyle}
                        />
                      </div>
                      <button
                        type="submit"
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '10px',
                          border: 'none',
                          backgroundColor: theme.accentBlue,
                          color: '#FFFFFF',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        + Agregar deuda
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </section>

            {/* 6. EDITAR SUSCRIPCIONES */}
            <section
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '18px',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => toggleSection('editarSuscripciones')}
                style={{
                  width: '100%',
                  padding: '15px 16px',
                  background: 'none',
                  border: 'none',
                  color: theme.textPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 700 }}>
                  Editar suscripciones ({data.subscriptions.length})
                </span>
                <span style={{ fontSize: '12px', color: theme.textSecondary }}>
                  {openSections.editarSuscripciones ? '▲' : '▼'}
                </span>
              </button>

              <div className={`smooth-collapse ${openSections.editarSuscripciones ? 'open' : 'closed'}`}>
                <div className="smooth-collapse-inner">
                  <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {data.subscriptions.length === 0 ? (
                      <div style={{ fontSize: '12px', color: theme.textMuted }}>No hay suscripciones para editar.</div>
                    ) : (
                      data.subscriptions.map((sub) => (
                        <div
                          key={sub.id}
                          style={{
                            backgroundColor: theme.cardSubtle,
                            border: `1px solid ${theme.border}`,
                            borderRadius: '12px',
                            padding: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          <div style={{ fontSize: '12px', fontWeight: 700, color: theme.accentBlueText }}>
                            Editar suscripción: {sub.name || 'Sin nombre'}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '8px' }}>
                            <div>
                              <label style={{ fontSize: '11px', color: theme.textSecondary, display: 'block', marginBottom: '3px' }}>
                                Nombre de la suscripción
                              </label>
                              <input
                                type="text"
                                placeholder="Nombre"
                                value={sub.name}
                                onChange={(e) => handleUpdateSubscription(sub.id, { name: e.target.value })}
                                style={baseInputStyle}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px', color: theme.textSecondary, display: 'block', marginBottom: '3px' }}>
                                Valor del cobro
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Valor"
                                value={Number(sub.price).toLocaleString('es-CO')}
                                onChange={(e) =>
                                  handleUpdateSubscription(sub.id, { price: parseMoneyInput(e.target.value) })
                                }
                                style={baseInputStyle}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.35fr', gap: '8px' }}>
                            <div>
                              <label style={{ fontSize: '11px', color: theme.textSecondary, display: 'block', marginBottom: '3px' }}>
                                Día de cobro (1-31)
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="31"
                                value={sub.billingDay}
                                onChange={(e) =>
                                  handleUpdateSubscription(sub.id, {
                                    billingDay: Math.max(1, Math.min(31, Number(e.target.value) || 1)),
                                  })
                                }
                                style={baseInputStyle}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px', color: theme.textSecondary, display: 'block', marginBottom: '3px' }}>
                                Cuenta que paga
                              </label>
                              <select
                                value={sub.accountId}
                                onChange={(e) => handleUpdateSubscription(sub.id, { accountId: e.target.value })}
                                style={baseInputStyle}
                              >
                                {data.accounts.map((acc) => (
                                  <option key={acc.id} value={acc.id}>
                                    {acc.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* 7. EDITAR DESEOS */}
            <section
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '18px',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => toggleSection('editarDeseos')}
                style={{
                  width: '100%',
                  padding: '15px 16px',
                  background: 'none',
                  border: 'none',
                  color: theme.textPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 700 }}>
                  Editar deseos ({data.wishes.length})
                </span>
                <span style={{ fontSize: '12px', color: theme.textSecondary }}>
                  {openSections.editarDeseos ? '▲' : '▼'}
                </span>
              </button>

              <div className={`smooth-collapse ${openSections.editarDeseos ? 'open' : 'closed'}`}>
                <div className="smooth-collapse-inner">
                  <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {data.wishes.length === 0 ? (
                      <div style={{ fontSize: '12px', color: theme.textMuted }}>No hay deseos para editar.</div>
                    ) : (
                      data.wishes.map((w) => (
                        <div
                          key={w.id}
                          style={{
                            backgroundColor: theme.cardSubtle,
                            border: `1px solid ${theme.border}`,
                            borderRadius: '12px',
                            padding: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          <div style={{ fontSize: '12px', fontWeight: 700, color: theme.accentBlueText }}>
                            Editar deseo: {w.name || 'Sin nombre'}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '8px' }}>
                            <div>
                              <label style={{ fontSize: '11px', color: theme.textSecondary, display: 'block', marginBottom: '3px' }}>
                                Nombre del deseo
                              </label>
                              <input
                                type="text"
                                placeholder="Nombre del deseo"
                                value={w.name}
                                onChange={(e) => handleUpdateWish(w.id, { name: e.target.value })}
                                style={baseInputStyle}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px', color: theme.textSecondary, display: 'block', marginBottom: '3px' }}>
                                Precio estimado
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Precio"
                                value={Number(w.price).toLocaleString('es-CO')}
                                onChange={(e) => handleUpdateWish(w.id, { price: parseMoneyInput(e.target.value) })}
                                style={baseInputStyle}
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Botón directo al final: Descargar PDF */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <button
                type="button"
                onClick={() => setShowPdfPreviewModal(true)}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '14px',
                  border: `1px solid ${theme.borderStrong}`,
                  background: theme.card,
                  color: theme.textPrimary,
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Descargar PDF
              </button>
              <div style={{ fontSize: '11px', color: theme.textMuted, paddingLeft: '4px', lineHeight: 1.35 }}>
                Genera el reporte completo con tus cuentas, deudas, suscripciones, deseos y movimientos para guardarlo en PDF.
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ================= MODAL DETALLE DEL MOVIMIENTO AL TOCARLO (CON MINIMAPA) ================= */}
      {selectedTxDetail && (
        <div
          className="ios-backdrop-enter"
          onClick={() => setSelectedTxDetail(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 62,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="ios-screen-enter"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '375px',
              backgroundColor: theme.cardSolid,
              border: `1px solid ${theme.borderStrong}`,
              borderRadius: '22px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              maxHeight: '88dvh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: 800 }}>Detalle del movimiento</span>
              <button
                type="button"
                onClick={() => setSelectedTxDetail(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.textSecondary,
                  fontSize: '18px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                backgroundColor: theme.cardSubtle,
                border: `1px solid ${theme.border}`,
                borderRadius: '14px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '7px',
                fontSize: '13px',
              }}
            >
              <div>
                <span style={{ color: theme.textMuted }}>Valor: </span>
                <strong
                  style={{
                    color:
                      selectedTxDetail.type === 'transferencia'
                        ? theme.accentBlueText
                        : selectedTxDetail.type === 'ingreso'
                        ? theme.success
                        : theme.danger,
                  }}
                >
                  {selectedTxDetail.type === 'ingreso' ? '+' : selectedTxDetail.type === 'gasto' ? '-' : '⇄ '}
                  {renderMoney(selectedTxDetail.amount)}
                </strong>
              </div>
              <div>
                <span style={{ color: theme.textMuted }}>Categoría: </span>
                <strong>{selectedTxDetail.categoryName}</strong>
              </div>
              {selectedTxDetail.subcategoryName && (
                <div>
                  <span style={{ color: theme.textMuted }}>Subcategoría: </span>
                  <strong
                    style={{
                      color: selectedTxDetail.type === 'gasto' ? theme.danger : theme.success,
                    }}
                  >
                    {selectedTxDetail.subcategoryName}
                  </strong>
                </div>
              )}
              <div>
                <span style={{ color: theme.textMuted }}>Cuenta: </span>
                <strong>{selectedTxDetail.accountName}</strong>
              </div>
              <div>
                <span style={{ color: theme.textMuted }}>Fecha y hora: </span>
                <strong>{formatDateTimeLabel(selectedTxDetail.date)}</strong>
              </div>
              {selectedTxDetail.note && (
                <div>
                  <span style={{ color: theme.textMuted }}>Nota: </span>
                  <strong>{selectedTxDetail.note}</strong>
                </div>
              )}
            </div>

            <div
              style={{
                backgroundColor: theme.cardSubtle,
                border: `1px solid ${theme.border}`,
                borderRadius: '14px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: theme.textSecondary }}>
                Ubicación del registro
              </div>
              {selectedTxDetail.location ? (
                <>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: theme.textPrimary }}>
                    {selectedTxDetail.location.label}
                  </div>
                  <div style={{ fontSize: '11px', color: theme.textMuted }}>
                    Coordenadas: {selectedTxDetail.location.lat}, {selectedTxDetail.location.lng}
                  </div>

                  {/* Minimapa limpio recortado sin textos de atribucion ni donaciones, tocable para abrir app nativa */}
                  <a
                    href={getNativeMapHref(selectedTxDetail.location.lat, selectedTxDetail.location.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Toca para abrir en Mapas"
                    style={{
                      position: 'relative',
                      display: 'block',
                      width: '100%',
                      height: '140px',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: `1px solid ${theme.borderStrong}`,
                      textDecoration: 'none',
                      backgroundColor: '#1e293b',
                    }}
                  >
                    <iframe
                      title="Minimapa de ubicación"
                      src={
                        selectedTxDetail.location.embedUrl ||
                        buildMiniMapEmbedUrl(selectedTxDetail.location.lat, selectedTxDetail.location.lng)
                      }
                      style={{
                        position: 'absolute',
                        top: '-24px',
                        left: '-10px',
                        width: 'calc(100% + 20px)',
                        height: 'calc(100% + 56px)',
                        border: 0,
                        pointerEvents: 'none',
                        display: 'block',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        backgroundColor: 'rgba(9, 11, 14, 0.88)',
                        color: '#FFFFFF',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '5px 9px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.2)',
                      }}
                    >
                      Abrir en Mapas ↗
                    </span>
                  </a>
                </>
              ) : (
                <div style={{ fontSize: '12px', color: theme.textMuted }}>
                  No se guardó ubicación en este movimiento.
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedTxDetail(null)}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: theme.accentBlue,
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL TRANSFERENCIA ENTRE CUENTAS ================= */}
      {showTransferModal && (
        <div
          className="ios-backdrop-enter"
          onClick={() => setShowTransferModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <form
            className="ios-sheet-enter"
            onSubmit={handleExecuteTransfer}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: theme.cardSolid,
              borderTop: `1px solid ${theme.borderStrong}`,
              borderRadius: '24px 24px 0 0',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>Transferir entre cuentas</span>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.textSecondary,
                  fontSize: '18px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {data.accounts.length >= 2 && (() => {
              const fromA = data.accounts.find((a) => a.id === transferFromId);
              const toA = data.accounts.find((a) => a.id === transferToId);
              const amtPreview = parseMoneyInput(transferAmount);
              return (
                <div
                  style={{
                    backgroundColor: theme.cardSubtle,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '12px',
                    padding: '10px 12px',
                    fontSize: '12px',
                    color: theme.textSecondary,
                  }}
                >
                  Vas a pasar{' '}
                  <strong style={{ color: theme.accentBlueText }}>{formatMoneyByCurrency(amtPreview, currency)}</strong>{' '}
                  desde <strong>{fromA?.name || '—'}</strong> hacia <strong>{toA?.name || '—'}</strong>.
                </div>
              );
            })()}

            {transferError && (
              <div
                style={{
                  backgroundColor: theme.dangerBg,
                  border: `1px solid ${theme.danger}`,
                  color: theme.danger,
                  borderRadius: '12px',
                  padding: '10px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {transferError}
              </div>
            )}

            <div>
              <label style={{ fontSize: '12px', color: theme.textSecondary, display: 'block', marginBottom: '4px' }}>
                Desde qué cuenta sale
              </label>
              <select
                value={transferFromId}
                onChange={(e) => {
                  setTransferFromId(e.target.value);
                  if (transferError) setTransferError('');
                }}
                style={{ ...baseInputStyle, fontSize: '14px', padding: '12px' }}
              >
                {data.accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatMoneyByCurrency(acc.balance, currency)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: theme.textSecondary, display: 'block', marginBottom: '4px' }}>
                Hacia qué cuenta llega
              </label>
              <select
                value={transferToId}
                onChange={(e) => {
                  setTransferToId(e.target.value);
                  if (transferError) setTransferError('');
                }}
                style={{ ...baseInputStyle, fontSize: '14px', padding: '12px' }}
              >
                {data.accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatMoneyByCurrency(acc.balance, currency)})
                  </option>
                ))}
              </select>
            </div>

            <input
              type="text"
              inputMode="numeric"
              placeholder="Valor a transferir (Ej: 40.000)"
              value={transferAmount}
              onChange={(e) => {
                setTransferAmount(formatMoneyInput(e.target.value));
                if (transferError) setTransferError('');
              }}
              style={{ ...baseInputStyle, fontSize: '16px', fontWeight: 700, padding: '12px' }}
            />

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '14px',
                border: 'none',
                backgroundColor: theme.accentBlue,
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Confirmar transferencia
            </button>
          </form>
        </div>
      )}

      {/* ================= VISTA / MODAL PDF COMPLETO CON BOTÓN VOLVER ================= */}
      {showPdfPreviewModal && (
        <div
          id="artpay-printable-sheet"
          className="ios-screen-enter"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 75,
            backgroundColor: theme.bg,
            color: theme.textPrimary,
            overflowY: 'auto',
            paddingTop: 'calc(28px + env(safe-area-inset-top))',
            paddingRight: '18px',
            paddingBottom: '34px',
            paddingLeft: '18px',
          }}
        >
          <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="no-print-btn" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowPdfPreviewModal(false)}
                style={{
                  padding: '9px 14px',
                  borderRadius: '12px',
                  border: `1px solid ${theme.borderStrong}`,
                  backgroundColor: theme.cardSolid,
                  color: theme.textPrimary,
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ← Volver
              </button>

              <button
                type="button"
                onClick={handleTriggerSavePDF}
                style={{
                  padding: '9px 14px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: theme.accentBlue,
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Guardar / Imprimir PDF
              </button>
            </div>

            <div
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '18px',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px' }}>
                ArtPay — Reporte Financiero ({currency})
              </div>
              <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '12px' }}>
                {data.userName ? `Usuario: ${data.userName} • ` : ''}
                {new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })} • {APP_VERSION}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div>
                  Plata disponible: <strong>{formatMoneyByCurrency(totalAvailable, currency)} {currency}</strong>
                </div>
                <div>
                  Deudas totales: <strong style={{ color: totalDebts > 0 ? theme.danger : theme.textPrimary }}>{formatMoneyByCurrency(totalDebts, currency)} {currency}</strong>
                </div>
              </div>
            </div>

            <div
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '18px',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>
                Cuentas ({data.accounts.length})
              </div>
              {data.accounts.length === 0 ? (
                <div style={{ fontSize: '12px', color: theme.textMuted }}>Sin cuentas registradas.</div>
              ) : (
                data.accounts.map((acc) => (
                  <div
                    key={acc.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      padding: '5px 0',
                      borderBottom: `1px solid ${theme.border}`,
                    }}
                  >
                    <span>{acc.name}</span>
                    <strong>{formatMoneyByCurrency(acc.balance, currency)}</strong>
                  </div>
                ))
              )}
            </div>

            <div
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '18px',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>
                Todos los movimientos ({data.transactions.length})
              </div>
              {data.transactions.length === 0 ? (
                <div style={{ fontSize: '12px', color: theme.textMuted }}>Sin movimientos registrados.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '12px',
                        paddingBottom: '6px',
                        borderBottom: `1px solid ${theme.border}`,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          {tx.categoryName}
                          {tx.subcategoryName ? ` (${tx.subcategoryName})` : ''} ({tx.accountName})
                        </div>
                        <div style={{ color: theme.textMuted }}>
                          {formatDateTimeLabel(tx.date)}{tx.note && tx.type !== 'transferencia' ? ` • ${tx.note}` : ''}
                          {tx.location?.label ? ` • ${tx.location.label}` : ''}
                        </div>
                      </div>
                      <span
                        style={{
                          fontWeight: 700,
                          color:
                            tx.type === 'transferencia'
                              ? theme.accentBlueText
                              : tx.type === 'ingreso'
                              ? theme.success
                              : theme.danger,
                        }}
                      >
                        {tx.type === 'ingreso' ? '+' : tx.type === 'gasto' ? '-' : '⇄ '}
                        {formatMoneyByCurrency(tx.amount, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= APARTADO DEDICADO DE DEUDAS + ABONAR CON ANIMACIÓN SUAVE ================= */}
      {showDebtSectionModal && (
        <div
          className="ios-backdrop-enter"
          onClick={() => {
            setSelectedDebtForPayment(null);
            setShowDebtSectionModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 55,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            className="ios-sheet-enter"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: theme.cardSolid,
              borderTop: `1px solid ${theme.borderStrong}`,
              borderRadius: '24px 24px 0 0',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxSizing: 'border-box',
              maxHeight: '88dvh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>Deudas</div>
                <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                  Total:{' '}
                  <strong style={{ color: totalDebts > 0 ? theme.danger : theme.textPrimary }}>
                    {renderMoney(totalDebts)}
                  </strong>{' '}
                  • Toca una deuda para abonar
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedDebtForPayment(null);
                  setShowDebtSectionModal(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.textSecondary,
                  fontSize: '18px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {data.debts.length === 0 ? (
              <div
                style={{
                  backgroundColor: theme.cardSubtle,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '14px',
                  padding: '18px',
                  textAlign: 'center',
                  fontSize: '13px',
                  color: theme.textMuted,
                }}
              >
                No tienes deudas registradas.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.debts.map((debt, idx) => {
                  const dStyle = getDebtRankStyle(idx);
                  const isSelected = selectedDebtForPayment?.id === debt.id;
                  return (
                    <div
                      key={debt.id}
                      className="debt-row-anim"
                      onClick={() => openPayForDebt(debt)}
                      style={{
                        backgroundColor: isSelected ? theme.accentBlueSoft : theme.cardSubtle,
                        border: isSelected ? `1.5px solid ${theme.accentBlue}` : `1px solid ${dStyle.border}`,
                        borderRadius: '14px',
                        padding: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 6px 18px rgba(37, 99, 235, 0.24)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <span
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            backgroundColor: dStyle.badgeBg,
                            color: dStyle.badgeColor,
                            fontSize: '11px',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {idx + 1}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: theme.textPrimary }}>
                          {debt.name}
                        </span>
                      </div>

                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span style={{ fontSize: '14px', fontWeight: 800, color: dStyle.amountColor }}>
                          {renderMoney(debt.amount)}
                        </span>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => reorderDebts(idx, idx - 1)}
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '7px',
                            border: `1px solid ${theme.border}`,
                            backgroundColor: theme.inputBg,
                            color: theme.textPrimary,
                            opacity: idx === 0 ? 0.35 : 1,
                            fontSize: '11px',
                            cursor: idx === 0 ? 'default' : 'pointer',
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={idx === data.debts.length - 1}
                          onClick={() => reorderDebts(idx, idx + 1)}
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '7px',
                            border: `1px solid ${theme.border}`,
                            backgroundColor: theme.inputBg,
                            color: theme.textPrimary,
                            opacity: idx === data.debts.length - 1 ? 0.35 : 1,
                            fontSize: '11px',
                            cursor: idx === data.debts.length - 1 ? 'default' : 'pointer',
                          }}
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className={`smooth-collapse ${selectedDebtForPayment ? 'open' : 'closed'}`}>
              <div className="smooth-collapse-inner">
                {selectedDebtForPayment && (
                  <form
                    onSubmit={handleConfirmDebtPayment}
                    style={{
                      backgroundColor: theme.cardSubtle,
                      border: `1.5px solid ${theme.accentBlue}`,
                      borderRadius: '14px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>
                      Abonar a "{selectedDebtForPayment.name}" ({renderMoney(selectedDebtForPayment.amount)})
                    </div>

                    {debtPayFeedback && (
                      <div
                        style={{
                          backgroundColor: theme.dangerBg,
                          border: `1px solid ${theme.danger}`,
                          color: theme.danger,
                          borderRadius: '8px',
                          padding: '8px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {debtPayFeedback}
                      </div>
                    )}

                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={`Máximo ${formatMoneyByCurrency(selectedDebtForPayment.amount, currency)}`}
                      value={debtPayInput}
                      onChange={(e) => {
                        const maxDebt = Number(selectedDebtForPayment.amount) || 0;
                        const typedNum = parseMoneyInput(e.target.value);
                        const clampedNum = typedNum > maxDebt ? maxDebt : typedNum;
                        setDebtPayInput(clampedNum > 0 ? clampedNum.toLocaleString('es-CO') : '');
                        if (debtPayFeedback) setDebtPayFeedback('');
                      }}
                      style={baseInputStyle}
                    />

                    <div>
                      <label style={{ fontSize: '11px', color: theme.textSecondary, display: 'block', marginBottom: '4px' }}>
                        ¿De dónde va a salir la plata?
                      </label>
                      <select
                        value={debtPayAccountId}
                        onChange={(e) => {
                          setDebtPayAccountId(e.target.value);
                          if (debtPayFeedback) setDebtPayFeedback('');
                        }}
                        style={baseInputStyle}
                      >
                        {data.accounts.length === 0 ? (
                          <option value="">Sin cuentas disponibles</option>
                        ) : (
                          data.accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} ({formatMoneyByCurrency(acc.balance, currency)})
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDebtForPayment(null);
                          setDebtPayFeedback('');
                        }}
                        style={{
                          padding: '10px',
                          borderRadius: '10px',
                          border: `1px solid ${theme.border}`,
                          backgroundColor: theme.inputBg,
                          color: theme.textSecondary,
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        style={{
                          padding: '10px',
                          borderRadius: '10px',
                          border: 'none',
                          backgroundColor: theme.accentBlue,
                          color: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Confirmar abono
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => openOnlySectionInConfig('deudas')}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: '12px',
                border: `1px solid ${theme.borderStrong}`,
                backgroundColor: 'transparent',
                color: theme.textSecondary,
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Agregar, editar o eliminar deudas en Configuración
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL CONFIRMAR COBRAR SUSCRIPCIÓN (CON OPCIÓN A DEUDA SI FALTA PLATA) ================= */}
      {subToChargeConfirm && (() => {
        const linkedAcc = data.accounts.find((a) => a.id === subToChargeConfirm.accountId);
        const accBal = linkedAcc ? Number(linkedAcc.balance) || 0 : 0;
        const lacksFunds = (Number(subToChargeConfirm.price) || 0) > accBal;

        return (
          <div
            className="ios-backdrop-enter"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 65,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
          >
            <div
              className="ios-screen-enter"
              style={{
                width: '100%',
                maxWidth: '350px',
                backgroundColor: theme.cardSolid,
                border: `1px solid ${theme.borderStrong}`,
                borderRadius: '20px',
                padding: '20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
                ¿Ya pagaste "{subToChargeConfirm.name}"?
              </div>
              <div style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '12px' }}>
                Valor: <strong>{renderMoney(subToChargeConfirm.price)}</strong> • Cuenta:{' '}
                <strong>{subToChargeConfirm.accountName}</strong> ({renderMoney(accBal)})
              </div>

              {lacksFunds && (
                <div
                  style={{
                    backgroundColor: theme.warningBg,
                    border: `1px solid ${theme.warning}`,
                    color: theme.warning,
                    borderRadius: '10px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '12px',
                  }}
                >
                  No alcanza el saldo de esta cuenta para cobrarla. ¿Quieres pasarla a Deudas?
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSubToChargeConfirm(null)}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '12px',
                    border: `1px solid ${theme.border}`,
                    backgroundColor: theme.cardSubtle,
                    color: theme.textPrimary,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                {lacksFunds ? (
                  <button
                    type="button"
                    onClick={() => handleMoveSubscriptionToDebt(subToChargeConfirm)}
                    style={{
                      flex: 1,
                      padding: '11px',
                      borderRadius: '12px',
                      border: 'none',
                      backgroundColor: '#D97706',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Pasar a deuda
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => executeChargeSubscription(subToChargeConfirm)}
                    style={{
                      flex: 1,
                      padding: '11px',
                      borderRadius: '12px',
                      border: 'none',
                      backgroundColor: theme.accentBlue,
                      color: '#FFFFFF',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Sí, cobrar
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= MODAL CONFIRMAR ELIMINAR MOVIMIENTO (SIEMPRE PREGUNTA) ================= */}
      {txToDelete && (
        <div
          className="ios-backdrop-enter"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 65,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="ios-screen-enter"
            style={{
              width: '100%',
              maxWidth: '340px',
              backgroundColor: theme.cardSolid,
              border: `1px solid ${theme.borderStrong}`,
              borderRadius: '20px',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
              ¿Seguro que quieres eliminar este movimiento?
            </div>
            <div style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '16px' }}>
              {txToDelete.categoryName} ({renderMoney(txToDelete.amount)}) y se ajustará el saldo de {txToDelete.accountName}.
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.cardSubtle,
                  color: theme.textPrimary,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteTransaction}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: theme.danger,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL CONFIRMAR ELIMINAR SUSCRIPCIÓN (SIEMPRE PREGUNTA) ================= */}
      {subToDelete && (
        <div
          className="ios-backdrop-enter"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 65,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="ios-screen-enter"
            style={{
              width: '100%',
              maxWidth: '340px',
              backgroundColor: theme.cardSolid,
              border: `1px solid ${theme.borderStrong}`,
              borderRadius: '20px',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
              ¿Seguro que quieres eliminar "{subToDelete.name}"?
            </div>
            <div style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '16px' }}>
              Esta suscripción se quitará de tu lista.
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setSubToDelete(null)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.cardSubtle,
                  color: theme.textPrimary,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteSubscription}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: theme.danger,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL CONFIRMAR ELIMINAR DESEO (SIEMPRE PREGUNTA) ================= */}
      {wishToDelete && (
        <div
          className="ios-backdrop-enter"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 65,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="ios-screen-enter"
            style={{
              width: '100%',
              maxWidth: '340px',
              backgroundColor: theme.cardSolid,
              border: `1px solid ${theme.borderStrong}`,
              borderRadius: '20px',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
              ¿Seguro que quieres eliminar "{wishToDelete.name}"?
            </div>
            <div style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '16px' }}>
              Este deseo se quitará de tu lista.
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setWishToDelete(null)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.cardSubtle,
                  color: theme.textPrimary,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteWish}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: theme.danger,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= AVISO SI NO HAY CUENTAS AL REGISTRAR MOVIMIENTO ================= */}
      {noAccountAlert && (
        <div
          className="ios-backdrop-enter"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="ios-screen-enter"
            style={{
              width: '100%',
              maxWidth: '340px',
              backgroundColor: theme.cardSolid,
              border: `1px solid ${theme.borderStrong}`,
              borderRadius: '20px',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
              Primero agrega una cuenta
            </div>
            <div style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '16px' }}>
              No puedes registrar movimientos si no has creado al menos una cuenta (como Efectivo o Nequi).
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setNoAccountAlert(false)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.cardSubtle,
                  color: theme.textPrimary,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={goToAddAccount}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: theme.accentBlue,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Agregar cuenta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL FLOTANTE CENTRADO: REGISTRAR MOVIMIENTO ================= */}
      {showTxModal && (
        <div
          className="ios-backdrop-enter"
          onClick={() => {
            if (!txSavingLocation) setShowTxModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            backgroundColor: 'rgba(0, 0, 0, 0.68)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <form
            className="ios-screen-enter"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveTransaction}
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: theme.cardSolid,
              border: `1px solid ${theme.borderStrong}`,
              borderRadius: '24px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxSizing: 'border-box',
              maxHeight: '86dvh',
              overflowY: 'auto',
              boxShadow: '0 24px 54px rgba(0, 0, 0, 0.72)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>Registrar movimiento</span>
              <button
                type="button"
                onClick={() => setShowTxModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.textSecondary,
                  fontSize: '18px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setTxType('gasto');
                  if (txError) setTxError('');
                }}
                style={{
                  padding: '10px',
                  borderRadius: '12px',
                  border: txType === 'gasto' ? `1.5px solid ${theme.danger}` : `1px solid ${theme.border}`,
                  backgroundColor: txType === 'gasto' ? theme.dangerBg : theme.cardSubtle,
                  color: txType === 'gasto' ? theme.danger : theme.textSecondary,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Gasto
              </button>
              <button
                type="button"
                onClick={() => {
                  setTxType('ingreso');
                  if (txError) setTxError('');
                }}
                style={{
                  padding: '10px',
                  borderRadius: '12px',
                  border: txType === 'ingreso' ? `1.5px solid ${theme.success}` : `1px solid ${theme.border}`,
                  backgroundColor: txType === 'ingreso' ? theme.successBg : theme.cardSubtle,
                  color: txType === 'ingreso' ? theme.success : theme.textSecondary,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Ingreso
              </button>
            </div>

            <input
              type="text"
              inputMode="numeric"
              placeholder="Valor (Ej: 25.000)"
              value={txAmount}
              onChange={(e) => {
                setTxAmount(formatMoneyInput(e.target.value));
                if (txError) setTxError('');
              }}
              required
              style={{ ...baseInputStyle, fontSize: '16px', fontWeight: 700, padding: '12px' }}
            />

            {(data.quickAmounts || []).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(data.quickAmounts || []).map((preset) => {
                  const isCurrent = parseMoneyInput(txAmount) === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setTxAmount(Number(preset).toLocaleString('es-CO'));
                        if (txError) setTxError('');
                      }}
                      style={{
                        padding: '6px 11px',
                        borderRadius: '999px',
                        border: isCurrent ? `1.5px solid ${theme.accentBlue}` : `1px solid ${theme.border}`,
                        backgroundColor: isCurrent ? theme.accentBlueSoft : theme.cardSubtle,
                        color: isCurrent ? theme.accentBlueText : theme.textPrimary,
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {formatMoneyByCurrency(preset, currency)}
                    </button>
                  );
                })}
              </div>
            )}

            <select
              value={txAccount}
              onChange={(e) => {
                setTxAccount(e.target.value);
                if (txError) setTxError('');
              }}
              style={{ ...baseInputStyle, fontSize: '14px', padding: '12px' }}
            >
              {data.accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({formatMoneyByCurrency(acc.balance, currency)})
                </option>
              ))}
            </select>

            {txError && (
              <div
                style={{
                  backgroundColor: theme.dangerBg,
                  border: `1px solid ${theme.danger}`,
                  color: theme.danger,
                  borderRadius: '12px',
                  padding: '10px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {txError}
              </div>
            )}

            <div>
              <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '6px' }}>
                Categoría
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {data.categories.map((cat) => {
                  const selected = txCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        if (selected) {
                          setTxCategoryId('');
                          setTxCategoryName('');
                          setTxCategoryIcon('none');
                          setTxSubcategoryName('');
                        } else {
                          setTxCategoryId(cat.id);
                          setTxCategoryName(cat.name);
                          setTxCategoryIcon(cat.icon || 'none');
                          setTxSubcategoryName('');
                        }
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 12px',
                        borderRadius: '999px',
                        border: selected ? `1.5px solid ${theme.accentBlue}` : `1px solid ${theme.border}`,
                        backgroundColor: selected ? theme.accentBlueSoft : theme.cardSubtle,
                        color: selected ? theme.accentBlueText : theme.textPrimary,
                        fontSize: '13px',
                        fontWeight: selected ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {cat.icon && cat.icon !== 'none' ? (
                        <CategoryGlyph iconId={cat.icon} size={14} color="currentColor" />
                      ) : null}
                      <span>{cat.name}</span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={goToAddCategory}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '7px 12px',
                    borderRadius: '999px',
                    border: `1px dashed ${theme.accentBlueText}`,
                    backgroundColor: 'transparent',
                    color: theme.accentBlueText,
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Agregar categoría
                </button>
              </div>
            </div>

            {/* Subcategorías opcionales si la categoría elegida tiene subcategorías */}
            {selectedCategoryObject &&
              Array.isArray(selectedCategoryObject.subcategories) &&
              selectedCategoryObject.subcategories.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '6px' }}>
                    Subcategoría de {selectedCategoryObject.name} (opcional)
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                    {selectedCategoryObject.subcategories.map((sub) => {
                      const subSelected = txSubcategoryName === sub;
                      const activeSubBg = txType === 'gasto' ? theme.dangerBg : theme.successBg;
                      const activeSubBorder = txType === 'gasto' ? theme.danger : theme.success;
                      const activeSubColor = txType === 'gasto' ? theme.danger : theme.success;

                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setTxSubcategoryName(subSelected ? '' : sub)}
                          style={{
                            padding: '6px 11px',
                            borderRadius: '999px',
                            border: subSelected
                              ? `1.5px solid ${activeSubBorder}`
                              : `1px solid ${theme.border}`,
                            backgroundColor: subSelected ? activeSubBg : theme.inputBg,
                            color: subSelected ? activeSubColor : theme.textSecondary,
                            fontSize: '12px',
                            fontWeight: subSelected ? 700 : 500,
                            cursor: 'pointer',
                          }}
                        >
                          {sub}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Opción de guardar ubicación: Sí / No (sin ícono al lado) */}
            <div
              style={{
                backgroundColor: theme.cardSubtle,
                border: `1px solid ${theme.border}`,
                borderRadius: '12px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: theme.textSecondary }}>
                  ¿Guardar ubicación?
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleLocationOption(true)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '9px',
                      border: txSaveLocation ? `1.5px solid ${theme.accentBlue}` : `1px solid ${theme.border}`,
                      backgroundColor: txSaveLocation ? theme.accentBlueSoft : theme.inputBg,
                      color: txSaveLocation ? theme.accentBlueText : theme.textSecondary,
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleLocationOption(false)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '9px',
                      border: !txSaveLocation ? `1.5px solid ${theme.accentBlue}` : `1px solid ${theme.border}`,
                      backgroundColor: !txSaveLocation ? theme.accentBlueSoft : theme.inputBg,
                      color: !txSaveLocation ? theme.accentBlueText : theme.textSecondary,
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    No
                  </button>
                </div>
              </div>
              {txLocationStatus && (
                <div style={{ fontSize: '11px', color: theme.accentBlueText }}>{txLocationStatus}</div>
              )}
            </div>

            <input
              type="text"
              placeholder="Nota corta (Ej: Almuerzo)"
              value={txNote}
              onChange={(e) => setTxNote(e.target.value)}
              style={{ ...baseInputStyle, fontSize: '14px', padding: '12px' }}
            />

            <button
              type="submit"
              disabled={txSavingLocation}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '14px',
                border: 'none',
                backgroundColor: theme.accentBlue,
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 700,
                cursor: txSavingLocation ? 'wait' : 'pointer',
                opacity: txSavingLocation ? 0.75 : 1,
              }}
            >
              {txSavingLocation ? 'Guardando ubicación...' : 'Guardar movimiento'}
            </button>
          </form>
        </div>
      )}

      {/* ================= MODAL CONFIRMAR BORRAR CATEGORÍA ================= */}
      {catToDelete && (
        <div
          className="ios-backdrop-enter"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="ios-screen-enter"
            style={{
              width: '100%',
              maxWidth: '340px',
              backgroundColor: theme.cardSolid,
              border: `1px solid ${theme.borderStrong}`,
              borderRadius: '20px',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
              ¿Seguro que quieres borrar "{catToDelete.name}"?
            </div>
            <div style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '16px' }}>
              Esta categoría y sus subcategorías se quitarán de tu lista.
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setCatToDelete(null)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.cardSubtle,
                  color: theme.textPrimary,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteCategory(false)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: theme.danger,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Sí, borrar
              </button>
            </div>

            <button
              type="button"
              onClick={() => confirmDeleteCategory(true)}
              style={{
                background: 'none',
                border: 'none',
                color: theme.textSecondary,
                fontSize: '12px',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              No volver a preguntar
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL VOLVER A PREGUNTAR CATEGORÍAS ================= */}
      {showReenableCatPrompt && (
        <div
          className="ios-backdrop-enter"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="ios-screen-enter"
            style={{
              width: '100%',
              maxWidth: '340px',
              backgroundColor: theme.cardSolid,
              border: `1px solid ${theme.borderStrong}`,
              borderRadius: '20px',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>
              ¿Quieres que te vuelva a preguntar cada vez que vayas a eliminar una categoría?
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button
                type="button"
                onClick={() => setShowReenableCatPrompt(false)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.cardSubtle,
                  color: theme.textPrimary,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  setData((prev) => ({ ...prev, skipCategoryDeleteConfirm: false }));
                  setShowReenableCatPrompt(false);
                }}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: theme.accentBlue,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Sí
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL CONFIRMAR BORRAR CUENTA ================= */}
      {accToDelete && (
        <div
          className="ios-backdrop-enter"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="ios-screen-enter"
            style={{
              width: '100%',
              maxWidth: '340px',
              backgroundColor: theme.cardSolid,
              border: `1px solid ${theme.borderStrong}`,
              borderRadius: '20px',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
              ¿Seguro que quieres borrar "{accToDelete.name}"?
            </div>
            <div style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '16px' }}>
              Esta cuenta se quitará de tu lista.
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setAccToDelete(null)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.cardSubtle,
                  color: theme.textPrimary,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteAccount(false)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: theme.danger,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Sí, borrar
              </button>
            </div>

            <button
              type="button"
              onClick={() => confirmDeleteAccount(true)}
              style={{
                background: 'none',
                border: 'none',
                color: theme.textSecondary,
                fontSize: '12px',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              No volver a preguntar
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL VOLVER A PREGUNTAR CUENTAS ================= */}
      {showReenableAccPrompt && (
        <div
          className="ios-backdrop-enter"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="ios-screen-enter"
            style={{
              width: '100%',
              maxWidth: '340px',
              backgroundColor: theme.cardSolid,
              border: `1px solid ${theme.borderStrong}`,
              borderRadius: '20px',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>
              ¿Quieres que te vuelva a preguntar cada vez que vayas a eliminar una cuenta?
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button
                type="button"
                onClick={() => setShowReenableAccPrompt(false)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.cardSubtle,
                  color: theme.textPrimary,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  setData((prev) => ({ ...prev, skipAccountDeleteConfirm: false }));
                  setShowReenableAccPrompt(false);
                }}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: theme.accentBlue,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Sí
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL CONFIRMAR BORRAR DEUDA ================= */}
      {debtToDelete && (
        <div
          className="ios-backdrop-enter"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="ios-screen-enter"
            style={{
              width: '100%',
              maxWidth: '340px',
              backgroundColor: theme.cardSolid,
              border: `1px solid ${theme.borderStrong}`,
              borderRadius: '20px',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
              ¿Seguro que quieres borrar "{debtToDelete.name}"?
            </div>
            <div style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '16px' }}>
              Esta deuda se quitará de tu lista.
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setDebtToDelete(null)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.cardSubtle,
                  color: theme.textPrimary,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteDebt(false)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: theme.danger,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Sí, borrar
              </button>
            </div>

            <button
              type="button"
              onClick={() => confirmDeleteDebt(true)}
              style={{
                background: 'none',
                border: 'none',
                color: theme.textSecondary,
                fontSize: '12px',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              No volver a preguntar
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL VOLVER A PREGUNTAR DEUDAS ================= */}
      {showReenableDebtPrompt && (
        <div
          className="ios-backdrop-enter"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="ios-screen-enter"
            style={{
              width: '100%',
              maxWidth: '340px',
              backgroundColor: theme.cardSolid,
              border: `1px solid ${theme.borderStrong}`,
              borderRadius: '20px',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>
              ¿Quieres que te vuelva a preguntar cada vez que vayas a eliminar una deuda?
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button
                type="button"
                onClick={() => setShowReenableDebtPrompt(false)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.cardSubtle,
                  color: theme.textPrimary,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  setData((prev) => ({ ...prev, skipDebtDeleteConfirm: false }));
                  setShowReenableDebtPrompt(false);
                }}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: theme.accentBlue,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Sí
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= BARRA DE NAVEGACIÓN INFERIOR (5 PESTAÑAS PRINCIPALES) ================= */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          backgroundColor: theme.navBg,
          borderTop: `1px solid ${theme.border}`,
          padding: '8px 4px calc(10px + env(safe-area-inset-bottom))',
          transition: `background-color 0.32s ${iosEase}, border-color 0.32s ${iosEase}`,
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '2px',
          }}
        >
          {[
            {
              id: 'inicio',
              label: 'Inicio',
              icon: (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              ),
            },
            {
              id: 'estadisticas',
              label: 'Estadíst.',
              icon: (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              ),
            },
            {
              id: 'suscripciones',
              label: 'Suscrip.',
              icon: (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              ),
            },
            {
              id: 'deseos',
              label: 'Deseos',
              icon: (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ),
            },
            {
              id: 'config',
              label: 'Config.',
              icon: (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              ),
            },
          ].map((tab) => {
            const active = activeTab === tab.id || (tab.id === 'inicio' && activeTab === 'movimientos');
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '6px 2px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  color: active ? theme.accentBlueText : theme.textMuted,
                  fontSize: '10px',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  transform: active ? 'translateY(-1px)' : 'translateY(0)',
                  transition: `all 0.22s ${iosEase}`,
                }}
              >
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {tab.icon}
                  {tab.id === 'suscripciones' && subAlertStatus && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-3px',
                        right: '-6px',
                        minWidth: '14px',
                        height: '14px',
                        padding: '0 3px',
                        borderRadius: '999px',
                        backgroundColor: subAlertStatus.color,
                        color: subAlertStatus.textColor,
                        fontSize: '9px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 0 1.5px #06080B',
                      }}
                    >
                      {subAlertStatus.count}
                    </span>
                  )}
                </div>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
