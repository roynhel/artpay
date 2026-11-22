import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Eye,
  EyeOff,
  Menu,
  X,
  Home,
  PieChart,
  Settings,
  Plus,
  Car,
  Smartphone,
  Fuel,
  Utensils,
  CreditCard,
  CheckCircle2,
  Wallet,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileDown,
  Check,
  Gamepad2,
  User,
  Download,
  Upload,
  Moon,
  Sun,
  Smartphone as SystemIcon,
} from 'lucide-react';

const formatCOP = (value) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);

const formatThousandsDot = (rawValue) => {
  const digits = String(rawValue ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('es-CO');
};

const parseThousandsDot = (formattedOrRaw) => {
  const digits = String(formattedOrRaw ?? '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

const getTodayKey = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatRealDate = (dateObj = new Date()) =>
  dateObj.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const STORAGE_KEY = 'artpay_state_clean_v2';

const DEFAULT_ACCOUNTS = {
  Bancolombia: 0,
  Nequi: 0,
  Efectivo: 0,
  'Otras cuentas': 0,
};

const DEFAULT_CATEGORIES = [
  'InDrive / Uber',
  'Celulares',
  'Gasolina',
  'Comida',
  'Ocio',
  'Personal',
];

const DEFAULT_DEBTS = [];

export default function App() {
  const [todayKey, setTodayKey] = useState(() => getTodayKey());
  const [activeTab, setActiveTab] = useState('inicio');
  const [statsRange, setStatsRange] = useState('dia');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hideAmounts, setHideAmounts] = useState(false);
  const [showAccountsBreakdown, setShowAccountsBreakdown] = useState(false);
  const [showDebtsModal, setShowDebtsModal] = useState(false);
  const [showAllMovements, setShowAllMovements] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const importInputRef = useRef(null);
  const guestInputRef = useRef(null);

  const savedData = useMemo(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  // 'system' | 'dark' | 'light'
  const [themeMode, setThemeMode] = useState(savedData?.themeMode || 'system');
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemPrefersDark(e.matches);
    setSystemPrefersDark(mq.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);

  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemPrefersDark);

  const [guestName, setGuestName] = useState(savedData?.guestName || 'Invitado');
  const [guestNameDraft, setGuestNameDraft] = useState(
    savedData?.guestName || ''
  );
  const [guestSavedMsg, setGuestSavedMsg] = useState('');

  const [accounts, setAccounts] = useState(() => {
    if (savedData?.accounts && typeof savedData.accounts === 'object') {
      return { ...DEFAULT_ACCOUNTS, ...savedData.accounts };
    }
    return DEFAULT_ACCOUNTS;
  });

  const [categories, setCategories] = useState(
    Array.isArray(savedData?.categories) && savedData.categories.length > 0
      ? savedData.categories
      : DEFAULT_CATEGORIES
  );

  const [accountDrafts, setAccountDrafts] = useState(() => {
    const base =
      savedData?.accounts && typeof savedData.accounts === 'object'
        ? { ...DEFAULT_ACCOUNTS, ...savedData.accounts }
        : DEFAULT_ACCOUNTS;
    return Object.fromEntries(
      Object.entries(base).map(([k, v]) => [k, formatThousandsDot(v)])
    );
  });
  const [savedAccountMsg, setSavedAccountMsg] = useState('');

  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountBalance, setNewAccountBalance] = useState('');
  const [accountAddedMsg, setAccountAddedMsg] = useState('');

  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryMsg, setCategoryMsg] = useState('');

  const [debts, setDebts] = useState(
    Array.isArray(savedData?.debts) ? savedData.debts : DEFAULT_DEBTS
  );

  const [transactions, setTransactions] = useState(() =>
    Array.isArray(savedData?.transactions) ? savedData.transactions : []
  );

  const [newDebtName, setNewDebtName] = useState('');
  const [newDebtAmount, setNewDebtAmount] = useState('');
  const [debtSavedMsg, setDebtSavedMsg] = useState('');

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveType, setMoveType] = useState('ingreso');
  const [moveCategory, setMoveCategory] = useState(
    (savedData?.categories && savedData.categories[0]) || DEFAULT_CATEGORIES[0]
  );
  const [moveAmount, setMoveAmount] = useState('');
  const [moveAccount, setMoveAccount] = useState('Efectivo');
  const [moveNote, setMoveNote] = useState('');

  const [selectedDebtId, setSelectedDebtId] = useState(
    (savedData?.debts && savedData.debts[0]?.id) || ''
  );
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoAccount, setAbonoAccount] = useState('Nequi');

  const accountNames = useMemo(() => Object.keys(accounts), [accounts]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('action') === 'new') {
        const typeParam = params.get('type');
        if (typeParam === 'gasto' || typeParam === 'ingreso') {
          setMoveType(typeParam);
        }
        setActiveTab('inicio');
        setShowMoveModal(true);
      }
    } catch {
      // Ignora errores de URL
    }
  }, []);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(moveCategory)) {
      setMoveCategory(categories[0]);
    }
  }, [categories, moveCategory]);

  useEffect(() => {
    if (accountNames.length > 0 && !accountNames.includes(moveAccount)) {
      setMoveAccount(accountNames[0]);
    }
    if (accountNames.length > 0 && !accountNames.includes(abonoAccount)) {
      setAbonoAccount(accountNames[0]);
    }
  }, [accountNames, moveAccount, abonoAccount]);

  useEffect(() => {
    if (
      debts.length > 0 &&
      !debts.some((d) => String(d.id) === String(selectedDebtId))
    ) {
      setSelectedDebtId(debts[0].id);
    }
  }, [debts, selectedDebtId]);

  useEffect(() => {
    setAccountDrafts(
      Object.fromEntries(
        Object.entries(accounts).map(([k, v]) => [k, formatThousandsDot(v)])
      )
    );
  }, [accounts]);

  useEffect(() => {
    const checkMidnight = () => {
      const currentKey = getTodayKey();
      setTodayKey((prev) => (prev !== currentKey ? currentKey : prev));
    };
    const interval = setInterval(checkMidnight, 30000);
    window.addEventListener('focus', checkMidnight);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkMidnight);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          themeMode,
          guestName,
          accounts,
          categories,
          debts,
          transactions,
        })
      );
    } catch {
      // Ignora errores de almacenamiento
    }
  }, [themeMode, guestName, accounts, categories, debts, transactions]);

  const goToNameConfig = () => {
    setActiveTab('configuracion');
    setTimeout(() => {
      guestInputRef.current?.focus();
    }, 80);
  };

  const money = (val) => (hideAmounts ? '••••••' : formatCOP(val));

  const totalPlata = useMemo(
    () => Object.values(accounts).reduce((acc, v) => acc + v, 0),
    [accounts]
  );

  const totalDeudas = useMemo(
    () => debts.reduce((acc, d) => acc + d.remaining, 0),
    [debts]
  );

  const { ingresosHoy, gastosHoy } = useMemo(() => {
    const todayList = transactions.filter((t) => t.dayKey === todayKey);
    const inc = todayList
      .filter((t) => t.type === 'ingreso')
      .reduce((s, t) => s + t.amount, 0);
    const exp = todayList
      .filter((t) => t.type === 'gasto')
      .reduce((s, t) => s + t.amount, 0);
    return { ingresosHoy: inc, gastosHoy: exp };
  }, [transactions, todayKey]);

  const visibleTransactions = useMemo(() => {
    if (showAllMovements) return transactions;
    return transactions.slice(0, 6);
  }, [transactions, showAllMovements]);

  const handleExportBackup = () => {
    const payload = {
      app: 'artPay',
      version: 1,
      exportedAt: new Date().toISOString(),
      themeMode,
      guestName,
      accounts,
      categories,
      debts,
      transactions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `artpay-respaldo-${getTodayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || ''));
        if (parsed.themeMode) {
          setThemeMode(parsed.themeMode);
        }
        if (parsed.guestName) {
          setGuestName(String(parsed.guestName));
          setGuestNameDraft(
            String(parsed.guestName) === 'Invitado' ? '' : String(parsed.guestName)
          );
        }
        if (parsed.accounts && typeof parsed.accounts === 'object') {
          setAccounts(parsed.accounts);
        }
        if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
          setCategories(parsed.categories);
        }
        if (Array.isArray(parsed.debts)) {
          setDebts(parsed.debts);
        }
        if (Array.isArray(parsed.transactions)) {
          setTransactions(parsed.transactions);
        }
        alert('Respaldo importado correctamente.');
      } catch {
        alert('El archivo seleccionado no es un respaldo válido de artPay.');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const executeConfirmedDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.kind === 'debt') {
      const id = confirmDelete.target;
      setDebts((prev) => {
        const next = prev.filter((d) => d.id !== id);
        if (Number(selectedDebtId) === id && next.length > 0) {
          setSelectedDebtId(next[0].id);
        }
        return next;
      });
    } else if (confirmDelete.kind === 'account') {
      const accName = confirmDelete.target;
      if (accountNames.length > 1) {
        setAccounts((prev) => {
          const next = { ...prev };
          delete next[accName];
          return next;
        });
      }
    } else if (confirmDelete.kind === 'category') {
      const catName = confirmDelete.target;
      if (categories.length > 1) {
        setCategories((prev) => prev.filter((c) => c !== catName));
      }
    }
    setConfirmDelete(null);
  };

  const handleSaveGuestName = (e) => {
    e.preventDefault();
    const clean = guestNameDraft.trim() || 'Invitado';
    setGuestName(clean);
    setGuestSavedMsg('Guardado');
    setTimeout(() => setGuestSavedMsg(''), 1600);
  };

  const handleSaveSingleAccount = (accName) => {
    const parsed = parseThousandsDot(accountDrafts[accName]);
    setAccounts((prev) => ({
      ...prev,
      [accName]: parsed,
    }));
    setSavedAccountMsg(`${accName} actualizada`);
    setTimeout(() => setSavedAccountMsg(''), 1800);
  };

  const handleCreateAccount = (e) => {
    e.preventDefault();
    const cleanName = newAccountName.trim();
    if (!cleanName) return;
    if (accounts[cleanName] !== undefined) {
      setAccountAddedMsg('Esa cuenta ya existe');
      setTimeout(() => setAccountAddedMsg(''), 1800);
      return;
    }

    const initialBalance = parseThousandsDot(newAccountBalance);
    setAccounts((prev) => ({
      ...prev,
      [cleanName]: initialBalance,
    }));
    setMoveAccount(cleanName);
    setNewAccountName('');
    setNewAccountBalance('');
    setAccountAddedMsg('Cuenta agregada');
    setTimeout(() => setAccountAddedMsg(''), 1800);
  };

  const handleCreateCategory = (e) => {
    e.preventDefault();
    const cleanCat = newCategoryName.trim();
    if (!cleanCat) return;
    if (categories.some((c) => c.toLowerCase() === cleanCat.toLowerCase())) {
      setCategoryMsg('Ya existe');
      setTimeout(() => setCategoryMsg(''), 1600);
      return;
    }
    setCategories((prev) => [...prev, cleanCat]);
    setMoveCategory(cleanCat);
    setNewCategoryName('');
    setCategoryMsg('Categoría agregada');
    setTimeout(() => setCategoryMsg(''), 1600);
  };

  const handleAddMovement = (e) => {
    e.preventDefault();
    const numeric = parseThousandsDot(moveAmount);
    if (!numeric || numeric <= 0) return;

    const now = new Date();
    const currentDay = getTodayKey();
    setTodayKey(currentDay);

    const tx = {
      id: Date.now(),
      dayKey: currentDay,
      timestamp: now.getTime(),
      type: moveType,
      category: moveCategory,
      amount: numeric,
      account: moveAccount,
      note: moveNote || moveCategory,
      date: formatRealDate(now),
    };

    setTransactions([tx, ...transactions]);
    setAccounts((prev) => ({
      ...prev,
      [moveAccount]:
        moveType === 'ingreso'
          ? (prev[moveAccount] || 0) + numeric
          : Math.max(0, (prev[moveAccount] || 0) - numeric),
    }));

    setMoveAmount('');
    setMoveNote('');
    setShowMoveModal(false);
  };

  const handleCreateDebt = (e) => {
    e.preventDefault();
    const cleanName = newDebtName.trim();
    const numeric = parseThousandsDot(newDebtAmount);
    if (!cleanName || !numeric || numeric <= 0) return;

    const created = {
      id: Date.now(),
      name: cleanName,
      total: numeric,
      remaining: numeric,
    };

    setDebts((prev) => {
      const next = [...prev, created];
      if (next.length === 1) setSelectedDebtId(created.id);
      return next;
    });

    setNewDebtName('');
    setNewDebtAmount('');
    setDebtSavedMsg('Deuda agregada');
    setTimeout(() => setDebtSavedMsg(''), 1800);
  };

  const handleAbono = (e) => {
    e.preventDefault();
    const numeric = parseThousandsDot(abonoAmount);
    const target = debts.find((d) => String(d.id) === String(selectedDebtId));
    if (!numeric || numeric <= 0 || !target) return;

    const now = new Date();
    const currentDay = getTodayKey();
    setTodayKey(currentDay);
    const pagoReal = Math.min(numeric, target.remaining);

    setAccounts((prev) => ({
      ...prev,
      [abonoAccount]: Math.max(0, (prev[abonoAccount] || 0) - pagoReal),
    }));

    const remainingDebts = debts
      .map((d) =>
        d.id === target.id ? { ...d, remaining: d.remaining - pagoReal } : d
      )
      .filter((d) => d.remaining > 0);

    setDebts(remainingDebts);
    if (remainingDebts.length > 0) {
      setSelectedDebtId(remainingDebts[0].id);
    }

    setTransactions([
      {
        id: Date.now(),
        dayKey: currentDay,
        timestamp: now.getTime(),
        type: 'gasto',
        category: 'Deudas',
        amount: pagoReal,
        account: abonoAccount,
        note: `Abono: ${target.name}`,
        date: formatRealDate(now),
      },
      ...transactions,
    ]);

    setAbonoAmount('');
    setShowDebtsModal(false);
  };

  const filteredStatsTransactions = useMemo(() => {
    const now = new Date();
    const currentMonthPrefix = todayKey.slice(0, 7);
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    return transactions.filter((t) => {
      if (statsRange === 'dia') {
        return t.dayKey === todayKey;
      }
      if (statsRange === 'semana') {
        const ts = t.timestamp || new Date(`${t.dayKey}T12:00:00`).getTime();
        return ts >= sevenDaysAgo;
      }
      return String(t.dayKey || '').startsWith(currentMonthPrefix);
    });
  }, [transactions, statsRange, todayKey]);

  const { expensesByCategory, totalIngresosPeriodo, totalGastosPeriodo } =
    useMemo(() => {
      const map = {};
      let totalInc = 0;
      let totalExp = 0;
      filteredStatsTransactions.forEach((t) => {
        if (t.type === 'ingreso') {
          totalInc += t.amount;
        } else {
          totalExp += t.amount;
          map[t.category] = (map[t.category] || 0) + t.amount;
        }
      });
      return {
        expensesByCategory: Object.entries(map).sort((a, b) => b[1] - a[1]),
        totalIngresosPeriodo: totalInc,
        totalGastosPeriodo: totalExp,
      };
    }, [filteredStatsTransactions]);

  const handleExportPdfKeepMovements = () => {
    if (transactions.length === 0) {
      alert('No hay movimientos para exportar.');
      return;
    }

    const exportDateLabel = formatRealDate(new Date());
    const totalInc = transactions
      .filter((t) => t.type === 'ingreso')
      .reduce((s, t) => s + t.amount, 0);
    const totalExp = transactions
      .filter((t) => t.type === 'gasto')
      .reduce((s, t) => s + t.amount, 0);

    const rowsHtml = transactions
      .map(
        (t) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${t.date}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${t.category}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${t.note}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${t.account}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:${
            t.type === 'ingreso' ? '#2563eb' : '#dc2626'
          };font-weight:bold;">
            ${t.type === 'ingreso' ? '+' : '-'}${formatCOP(t.amount)}
          </td>
        </tr>`
      )
      .join('');

    const reportWindow = window.open('', '_blank', 'width=800,height=900');
    if (reportWindow) {
      reportWindow.document.write(`
        <html>
          <head><title>artPay • ${exportDateLabel}</title></head>
          <body style="font-family:Arial,sans-serif;padding:24px;color:#000;">
            <h1 style="margin:0 0 4px 0;">artPay • ${guestName}</h1>
            <p style="color:#666;margin:0 0 20px 0;">Generado el ${exportDateLabel}</p>
            <p><strong>Plata total en cuentas:</strong> ${formatCOP(totalPlata)}</p>
            <p><strong>Ingresos:</strong> ${formatCOP(totalInc)} | <strong>Gastos:</strong> ${formatCOP(totalExp)}</p>
            <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px;">
              <thead>
                <tr style="background:#f5f5f5;text-align:left;">
                  <th style="padding:8px;">Fecha</th>
                  <th style="padding:8px;">Categoría</th>
                  <th style="padding:8px;">Detalle</th>
                  <th style="padding:8px;">Cuenta</th>
                  <th style="padding:8px;text-align:right;">Monto</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
            <script>window.onload = () => { window.print(); };</script>
          </body>
        </html>
      `);
      reportWindow.document.close();
    }
  };

  const getIcon = (cat) => {
    const lower = String(cat).toLowerCase();
    const iconColor = isDark ? 'text-white' : 'text-black';
    if (
      lower.includes('indrive') ||
      lower.includes('uber') ||
      lower.includes('transporte')
    ) {
      return <Car className={`w-5 h-5 ${iconColor}`} />;
    }
    if (lower.includes('celular')) {
      return <Smartphone className={`w-5 h-5 ${iconColor}`} />;
    }
    if (lower.includes('gasolina')) {
      return <Fuel className={`w-5 h-5 ${iconColor}`} />;
    }
    if (lower.includes('comida')) {
      return <Utensils className={`w-5 h-5 ${iconColor}`} />;
    }
    if (lower.includes('ocio')) {
      return <Gamepad2 className={`w-5 h-5 ${iconColor}`} />;
    }
    if (lower.includes('deuda')) {
      return <CreditCard className="w-5 h-5 text-red-500" />;
    }
    return <Wallet className={`w-5 h-5 ${iconColor}`} />;
  };

  let touchStartX = 0;
  const onTouchStart = (e) => {
    touchStartX = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (touchStartX < 40 && diff > 70) setDrawerOpen(true);
    if (drawerOpen && diff < -70) setDrawerOpen(false);
  };

  const maxBarValue = Math.max(totalIngresosPeriodo, totalGastosPeriodo, 1);
  const ingresosBarPct = Math.min(
    100,
    Math.round((totalIngresosPeriodo / maxBarValue) * 100)
  );
  const gastosBarPct = Math.min(
    100,
    Math.round((totalGastosPeriodo / maxBarValue) * 100)
  );

  const isGuestUnconfigured =
    !guestName || guestName.trim().toLowerCase() === 'invitado';

  // Clases de tema dinámicas
  const shellBg = isDark ? 'bg-neutral-950 text-white' : 'bg-white text-black';
  const cardBg = isDark
    ? 'bg-neutral-900 border-neutral-800'
    : 'bg-white border-neutral-200';
  const softBg = isDark
    ? 'bg-neutral-800/80 border-neutral-700'
    : 'bg-neutral-50 border-neutral-200';
  const inputBg = isDark
    ? 'bg-neutral-800 text-white border-neutral-700 placeholder:text-neutral-400'
    : 'bg-neutral-100 text-black border-transparent placeholder:text-neutral-400';
  const mutedText = isDark ? 'text-neutral-400' : 'text-neutral-500';

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={`min-h-screen flex justify-center relative overflow-x-hidden ${
        isDark ? 'bg-black text-white' : 'bg-white text-black'
      }`}
    >
      <div className={`w-full max-w-md min-h-screen flex flex-col pb-24 ${shellBg}`}>
        {/* CABECERA */}
        <header
          className={`px-5 pt-6 pb-3.5 flex items-center justify-between border-b sticky top-0 backdrop-blur-xs z-20 ${
            isDark
              ? 'border-neutral-800 bg-neutral-950/95'
              : 'border-neutral-100 bg-white/95'
          }`}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menú"
              className={`p-2 -ml-2 rounded-full ${
                isDark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'
              }`}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <span className="text-2xl font-bold tracking-tight block leading-none">
                artPay
              </span>
              {isGuestUnconfigured ? (
                <button
                  type="button"
                  onClick={goToNameConfig}
                  className="text-[11px] font-bold text-blue-500 hover:underline mt-1 inline-block"
                >
                  Agrega tu nombre
                </button>
              ) : (
                <span className={`text-xs font-medium mt-1 block ${mutedText}`}>
                  Hola, {guestName}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setHideAmounts(!hideAmounts)}
            aria-label="Mostrar u ocultar montos"
            className={`p-2 rounded-full ${
              isDark
                ? 'bg-neutral-800 hover:bg-neutral-700'
                : 'bg-neutral-100 hover:bg-neutral-200'
            }`}
          >
            {hideAmounts ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </header>

        {/* PESTAÑA INICIO */}
        {activeTab === 'inicio' && (
          <main key="view-inicio" className="px-5 pt-4 space-y-4 anim-view">
            <section
              className={`rounded-3xl p-5 space-y-4 border ${
                isDark
                  ? 'bg-black text-white border-neutral-800'
                  : 'bg-black text-white border-black'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-neutral-300 font-medium">
                  Plata disponible
                </span>
                <button
                  onClick={() => setShowAccountsBreakdown(!showAccountsBreakdown)}
                  className="text-xs font-bold text-blue-400 hover:text-blue-300 underline underline-offset-4"
                >
                  Plata total: {money(totalPlata)}
                </button>
              </div>

              <div className="text-4xl font-bold tracking-tight">
                {money(totalPlata)}
              </div>

              {showAccountsBreakdown && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3.5 space-y-2 anim-view">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-400">
                      Desglose de plata total por cuenta
                    </span>
                    <button
                      onClick={() => setShowAccountsBreakdown(false)}
                      className="text-xs text-neutral-400"
                    >
                      Ocultar
                    </button>
                  </div>
                  {accountNames.map((acc) => (
                    <div
                      key={acc}
                      className="flex items-center justify-between text-sm py-1 border-b border-neutral-800 last:border-b-0"
                    >
                      <span className="text-neutral-200">{acc}</span>
                      <span className="font-bold text-white">
                        {money(accounts[acc] ?? 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2.5 border-t border-neutral-800 space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block">
                  Hoy
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-neutral-900 rounded-2xl p-3">
                    <span className="text-xs text-neutral-400 block">
                      Ingresos
                    </span>
                    <span className="text-base font-bold text-blue-400">
                      +{money(ingresosHoy)}
                    </span>
                  </div>
                  <div className="bg-neutral-900 rounded-2xl p-3">
                    <span className="text-xs text-neutral-400 block">
                      Gastos
                    </span>
                    <span className="text-base font-bold text-red-500">
                      -{money(gastosHoy)}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section
              role="button"
              tabIndex={0}
              onClick={() => {
                if (
                  debts.length > 0 &&
                  !debts.some((d) => String(d.id) === String(selectedDebtId))
                ) {
                  setSelectedDebtId(debts[0].id);
                }
                setShowDebtsModal(true);
              }}
              onKeyDown={(e) => e.key === 'Enter' && setShowDebtsModal(true)}
              className={`rounded-3xl border p-5 flex items-center justify-between cursor-pointer hover:border-blue-600 ${cardBg}`}
            >
              <div>
                <span className="text-xs uppercase tracking-wider font-bold text-blue-500">
                  Deudas
                </span>
                <p className="text-2xl font-bold mt-0.5">{money(totalDeudas)}</p>
                <p className={`text-xs mt-1 ${mutedText}`}>
                  {debts.length > 0
                    ? `${debts.length} activa(s) • Toca para abonar`
                    : 'Sin deudas • Agrega una en Configuración'}
                </p>
              </div>
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center ${
                  isDark ? 'bg-blue-950/60' : 'bg-blue-50'
                }`}
              >
                <CreditCard className="w-5 h-5 text-blue-500" />
              </div>
            </section>

            <button
              onClick={() => setShowMoveModal(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Registrar movimiento
            </button>

            <section className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">Movimientos</h2>
                <span className={`text-xs ${mutedText}`}>
                  {transactions.length} en total
                </span>
              </div>

              {transactions.length === 0 ? (
                <div
                  className={`p-4 rounded-2xl border text-xs ${softBg} ${mutedText}`}
                >
                  No hay movimientos registrados.
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border ${cardBg}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isDark ? 'bg-neutral-800' : 'bg-neutral-100'
                          }`}
                        >
                          {getIcon(tx.category)}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{tx.category}</p>
                          <p className={`text-xs ${mutedText}`}>
                            {tx.note} • {tx.account}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={`text-sm font-bold ${
                            tx.type === 'ingreso'
                              ? 'text-blue-500'
                              : 'text-red-500'
                          }`}
                        >
                          {tx.type === 'ingreso' ? '+' : '-'}
                          {money(tx.amount)}
                        </p>
                        <p className="text-[11px] text-neutral-400">{tx.date}</p>
                      </div>
                    </div>
                  ))}

                  {transactions.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setShowAllMovements(!showAllMovements)}
                      className={`w-full py-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 ${softBg}`}
                    >
                      {showAllMovements ? (
                        <>
                          Ver menos
                          <ChevronUp className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          Ver más ({transactions.length - 6} más)
                          <ChevronDown className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </section>
          </main>
        )}

        {/* PESTAÑA ESTADÍSTICAS */}
        {activeTab === 'estadisticas' && (
          <main key="view-estadisticas" className="px-5 pt-4 space-y-4 anim-view">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-bold">Estadísticas</h2>

              <div
                className={`flex p-1 rounded-xl gap-1 ${
                  isDark ? 'bg-neutral-900' : 'bg-neutral-100'
                }`}
              >
                {[
                  { key: 'dia', label: 'Día' },
                  { key: 'semana', label: 'Semana' },
                  { key: 'mes', label: 'Mes' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setStatsRange(opt.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      statsRange === opt.key
                        ? isDark
                          ? 'bg-white text-black'
                          : 'bg-black text-white'
                        : mutedText
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <section className={`rounded-3xl border p-5 space-y-4 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Ingresos vs Gastos</h3>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="flex items-center gap-1 text-blue-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                    Ingresos
                  </span>
                  <span className="flex items-center gap-1 text-red-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                    Gastos
                  </span>
                </div>
              </div>

              <div className={`rounded-2xl border p-4 space-y-3 ${softBg}`}>
                <div
                  className={`h-44 flex items-end justify-around gap-6 pt-4 px-2 border-b ${
                    isDark ? 'border-neutral-700' : 'border-neutral-200'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1.5 h-full justify-end flex-1">
                    <span className="text-xs font-bold text-blue-500">
                      {money(totalIngresosPeriodo)}
                    </span>
                    <div
                      className={`w-16 h-32 rounded-t-xl flex items-end overflow-hidden ${
                        isDark ? 'bg-neutral-900' : 'bg-neutral-200/70'
                      }`}
                    >
                      <div
                        className="w-full bg-blue-600 rounded-t-xl transition-all duration-300"
                        style={{ height: `${ingresosBarPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1.5 h-full justify-end flex-1">
                    <span className="text-xs font-bold text-red-500">
                      {money(totalGastosPeriodo)}
                    </span>
                    <div
                      className={`w-16 h-32 rounded-t-xl flex items-end overflow-hidden ${
                        isDark ? 'bg-neutral-900' : 'bg-neutral-200/70'
                      }`}
                    >
                      <div
                        className="w-full bg-red-600 rounded-t-xl transition-all duration-300"
                        style={{ height: `${gastosBarPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className={`flex justify-around text-xs font-bold ${mutedText}`}>
                  <span>Ingresos</span>
                  <span>Gastos</span>
                </div>
              </div>
            </section>

            <section className={`rounded-3xl border p-5 space-y-2.5 ${cardBg}`}>
              <h3 className="text-sm font-bold">Gastos por Categoría</h3>

              {expensesByCategory.length === 0 ? (
                <p className={`text-xs py-2 ${mutedText}`}>
                  No hay gastos en este período.
                </p>
              ) : (
                <div
                  className={`divide-y ${
                    isDark ? 'divide-neutral-800' : 'divide-neutral-100'
                  }`}
                >
                  {expensesByCategory.map(([cat, val]) => (
                    <div
                      key={cat}
                      className="flex items-center justify-between py-2.5 text-sm font-bold"
                    >
                      <span>{cat}</span>
                      <span className="text-red-500">{money(val)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>
        )}

        {/* PESTAÑA CONFIGURACIÓN */}
        {activeTab === 'configuracion' && (
          <main
            key="view-configuracion"
            className="px-5 pt-4 space-y-4 anim-view"
          >
            <h2 className="text-xl font-bold">Configuración</h2>

            {/* Nombre invitado + Respaldo */}
            <section className={`rounded-3xl border p-4 space-y-3 ${cardBg}`}>
              <form onSubmit={handleSaveGuestName} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isDark ? 'bg-neutral-800' : 'bg-neutral-100'
                      }`}
                    >
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">
                        {isGuestUnconfigured ? 'Sin nombre' : `Hola, ${guestName}`}
                      </p>
                      <p className={`text-[11px] ${mutedText}`}>Invitado</p>
                    </div>
                  </div>
                  {guestSavedMsg && (
                    <span className="text-xs font-bold text-blue-500">
                      {guestSavedMsg}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    ref={guestInputRef}
                    type="text"
                    placeholder="Escribe tu nombre (Ej: Roimer)..."
                    value={guestNameDraft}
                    onChange={(e) => setGuestNameDraft(e.target.value)}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600 ${inputBg}`}
                  />
                  <button
                    type="submit"
                    className={`px-4 py-2 rounded-xl text-xs font-bold ${
                      isDark ? 'bg-white text-black' : 'bg-black text-white'
                    }`}
                  >
                    Guardar
                  </button>
                </div>
              </form>

              <div
                className={`grid grid-cols-2 gap-2 pt-2 border-t ${
                  isDark ? 'border-neutral-800' : 'border-neutral-100'
                }`}
              >
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${
                    isDark
                      ? 'bg-neutral-800 hover:bg-neutral-700'
                      : 'bg-neutral-100 hover:bg-neutral-200'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar datos
                </button>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${
                    isDark
                      ? 'bg-neutral-800 hover:bg-neutral-700'
                      : 'bg-neutral-100 hover:bg-neutral-200'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Importar datos
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </div>
            </section>

            {/* Apariencia / Modo oscuro */}
            <section className={`rounded-3xl border p-4 space-y-3 ${cardBg}`}>
              <div>
                <h3 className="text-sm font-bold">Apariencia</h3>
                <p className={`text-xs ${mutedText}`}>
                  Elige si sigue el modo oscuro del sistema o se queda fijo.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'system', label: 'Sistema', icon: SystemIcon },
                  { id: 'dark', label: 'Oscuro', icon: Moon },
                  { id: 'light', label: 'Claro', icon: Sun },
                ].map((opt) => {
                  const IconComp = opt.icon;
                  const active = themeMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setThemeMode(opt.id)}
                      className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : `${softBg}`
                      }`}
                    >
                      <IconComp className="w-3.5 h-3.5" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Cuentas y plata */}
            <section className={`rounded-3xl border p-4 space-y-3 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Cuentas y plata</h3>
                {savedAccountMsg && (
                  <span className="text-xs font-bold text-blue-500">
                    {savedAccountMsg}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {accountNames.map((accName) => (
                  <div
                    key={accName}
                    className={`p-2.5 rounded-2xl border space-y-1.5 ${softBg}`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>{accName}</span>
                      <span className={mutedText}>
                        {money(accounts[accName] ?? 0)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={accountDrafts[accName] ?? ''}
                        onChange={(e) =>
                          setAccountDrafts((prev) => ({
                            ...prev,
                            [accName]: formatThousandsDot(e.target.value),
                          }))
                        }
                        className={`flex-1 px-3 py-1.5 rounded-xl border text-xs font-bold outline-none focus:border-blue-600 ${
                          isDark
                            ? 'bg-neutral-900 text-white border-neutral-700'
                            : 'bg-white text-black border-neutral-200'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveSingleAccount(accName)}
                        aria-label={`Guardar saldo de ${accName}`}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        OK
                      </button>
                      {accName !== 'Otras cuentas' && accountNames.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDelete({
                              kind: 'account',
                              target: accName,
                              label: accName,
                            })
                          }
                          aria-label={`Borrar cuenta ${accName}`}
                          className={`p-1.5 rounded-xl border text-red-500 ${
                            isDark
                              ? 'bg-neutral-900 border-neutral-700'
                              : 'bg-white border-neutral-200'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleCreateAccount} className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Nueva cuenta</span>
                  {accountAddedMsg && (
                    <span className="text-xs font-bold text-blue-500">
                      {accountAddedMsg}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Nombre"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold outline-none ${inputBg}`}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Saldo inicial"
                    value={newAccountBalance}
                    onChange={(e) =>
                      setNewAccountBalance(formatThousandsDot(e.target.value))
                    }
                    className={`px-3 py-2 rounded-xl text-xs font-bold outline-none ${inputBg}`}
                  />
                </div>
                <button
                  type="submit"
                  className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 ${
                    isDark ? 'bg-white text-black' : 'bg-black text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar cuenta
                </button>
              </form>
            </section>

            {/* Categorías */}
            <section className={`rounded-3xl border p-4 space-y-3 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Categorías</h3>
                {categoryMsg && (
                  <span className="text-xs font-bold text-blue-500">
                    {categoryMsg}
                  </span>
                )}
              </div>

              <form onSubmit={handleCreateCategory} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nueva categoría..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold outline-none ${inputBg}`}
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                >
                  Agregar
                </button>
              </form>

              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <div
                    key={cat}
                    className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold ${softBg}`}
                  >
                    <span>{cat}</span>
                    {categories.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDelete({
                            kind: 'category',
                            target: cat,
                            label: cat,
                          })
                        }
                        aria-label={`Borrar categoría ${cat}`}
                        className="text-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Deudas */}
            <section className={`rounded-3xl border p-4 space-y-3 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Deudas</h3>
                {debtSavedMsg && (
                  <span className="text-xs font-bold text-blue-500">
                    {debtSavedMsg}
                  </span>
                )}
              </div>

              <form onSubmit={handleCreateDebt} className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nombre deuda"
                    value={newDebtName}
                    onChange={(e) => setNewDebtName(e.target.value)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold outline-none ${inputBg}`}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="Monto total"
                    value={newDebtAmount}
                    onChange={(e) =>
                      setNewDebtAmount(formatThousandsDot(e.target.value))
                    }
                    className={`px-3 py-2 rounded-xl text-xs font-bold outline-none ${inputBg}`}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar deuda
                </button>
              </form>

              {debts.length > 0 && (
                <div className="space-y-2 pt-1">
                  {debts.map((d) => (
                    <div
                      key={d.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${softBg}`}
                    >
                      <div>
                        <p className="text-xs font-bold">{d.name}</p>
                        <p className="text-xs text-red-500 font-bold">
                          Falta {money(d.remaining)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDelete({
                            kind: 'debt',
                            target: d.id,
                            label: d.name,
                          })
                        }
                        aria-label={`Borrar deuda ${d.name}`}
                        className={`p-2 rounded-xl border text-red-500 ${
                          isDark
                            ? 'bg-neutral-900 border-neutral-700'
                            : 'bg-white border-neutral-200'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <button
              type="button"
              onClick={handleExportPdfKeepMovements}
              className={`w-full font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm ${
                isDark ? 'bg-white text-black' : 'bg-black text-white'
              }`}
            >
              <FileDown className="w-4 h-4" />
              Descargar PDF
            </button>
          </main>
        )}

        {/* BARRA INFERIOR */}
        <nav
          className={`fixed bottom-0 w-full max-w-md border-t py-2.5 px-4 flex justify-around items-center z-20 backdrop-blur-xs ${
            isDark
              ? 'bg-neutral-950/95 border-neutral-800'
              : 'bg-white/95 border-neutral-200'
          }`}
        >
          <button
            onClick={() => setActiveTab('inicio')}
            className={`flex flex-col items-center gap-1 text-xs font-bold ${
              activeTab === 'inicio' ? 'text-blue-500' : 'text-neutral-400'
            }`}
          >
            <Home className="w-5 h-5" />
            Inicio
          </button>

          <button
            onClick={() => setActiveTab('estadisticas')}
            className={`flex flex-col items-center gap-1 text-xs font-bold ${
              activeTab === 'estadisticas' ? 'text-blue-500' : 'text-neutral-400'
            }`}
          >
            <PieChart className="w-5 h-5" />
            Estadísticas
          </button>

          <button
            onClick={() => setActiveTab('configuracion')}
            className={`flex flex-col items-center gap-1 text-xs font-bold ${
              activeTab === 'configuracion' ? 'text-blue-500' : 'text-neutral-400'
            }`}
          >
            <Settings className="w-5 h-5" />
            Configuración
          </button>
        </nav>

        {/* MENÚ LATERAL */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 flex anim-backdrop">
            <div
              className={`w-72 h-full border-r p-6 flex flex-col justify-between z-50 anim-drawer ${
                isDark
                  ? 'bg-neutral-950 border-neutral-800 text-white'
                  : 'bg-white border-neutral-200 text-black'
              }`}
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold">artPay</span>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className={`p-1.5 rounded-full ${
                      isDark ? 'bg-neutral-800' : 'bg-neutral-100'
                    }`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setActiveTab('inicio');
                      setDrawerOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold ${
                      activeTab === 'inicio'
                        ? isDark
                          ? 'bg-white text-black'
                          : 'bg-black text-white'
                        : isDark
                          ? 'hover:bg-neutral-800'
                          : 'hover:bg-neutral-100'
                    }`}
                  >
                    <Home className="w-4 h-4" />
                    Principal
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('configuracion');
                      setDrawerOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold ${
                      activeTab === 'configuracion'
                        ? isDark
                          ? 'bg-white text-black'
                          : 'bg-black text-white'
                        : isDark
                          ? 'hover:bg-neutral-800'
                          : 'hover:bg-neutral-100'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    Configuración
                  </button>
                </div>
              </div>

              <p className="text-xs text-neutral-400">
                Desliza hacia la izquierda para cerrar
              </p>
            </div>
            <div
              onClick={() => setDrawerOpen(false)}
              className="flex-1 bg-black/50"
            />
          </div>
        )}

        {/* MODAL CONFIRMACIÓN BORRAR */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center px-5 anim-backdrop">
            <div
              className={`w-full max-w-sm rounded-3xl p-6 space-y-4 anim-sheet border ${cardBg}`}
            >
              <h3 className="text-lg font-bold">¿Seguro borrar?</h3>
              <p className={`text-xs ${mutedText}`}>
                Se eliminará <strong>{confirmDelete.label}</strong>.
              </p>
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className={`py-3 rounded-2xl text-xs font-bold ${
                    isDark
                      ? 'bg-neutral-800 text-white'
                      : 'bg-neutral-100 text-black'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={executeConfirmedDelete}
                  className="py-3 rounded-2xl bg-red-600 text-white text-xs font-bold"
                >
                  Sí, borrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DEUDAS Y ABONO */}
        {showDebtsModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center anim-backdrop">
            <div
              className={`w-full max-w-md rounded-t-3xl p-6 space-y-4 anim-sheet border-t ${cardBg}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Desglose de deudas</h3>
                <button
                  onClick={() => setShowDebtsModal(false)}
                  className={`p-1.5 rounded-full ${
                    isDark ? 'bg-neutral-800' : 'bg-neutral-100'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {debts.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-blue-500 font-bold py-2">
                    <CheckCircle2 className="w-4 h-4" />
                    No tienes deudas pendientes
                  </div>
                ) : (
                  debts.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => setSelectedDebtId(d.id)}
                      className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer ${
                        String(selectedDebtId) === String(d.id)
                          ? 'border-blue-600 bg-blue-500/10'
                          : isDark
                            ? 'border-neutral-800'
                            : 'border-neutral-200'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-bold">{d.name}</p>
                        <p className={`text-xs ${mutedText}`}>
                          Total: {money(d.total)}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-red-500">
                        {money(d.remaining)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {debts.length > 0 && (
                <form
                  onSubmit={handleAbono}
                  className={`space-y-3 pt-2 border-t ${
                    isDark ? 'border-neutral-800' : 'border-neutral-100'
                  }`}
                >
                  <div>
                    <label className={`text-xs font-bold ${mutedText}`}>
                      Deuda a abonar
                    </label>
                    <select
                      value={selectedDebtId}
                      onChange={(e) => setSelectedDebtId(e.target.value)}
                      className={`w-full mt-1 px-3 py-2.5 rounded-xl text-sm font-bold ${inputBg}`}
                    >
                      {debts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} (Falta {formatCOP(d.remaining)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`text-xs font-bold ${mutedText}`}>
                        ¿De dónde sale la plata?
                      </label>
                      <select
                        value={abonoAccount}
                        onChange={(e) => setAbonoAccount(e.target.value)}
                        className={`w-full mt-1 px-3 py-2.5 rounded-xl text-sm font-bold ${inputBg}`}
                      >
                        {accountNames.map((acc) => (
                          <option key={acc} value={acc}>
                            {acc}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={`text-xs font-bold ${mutedText}`}>
                        Monto a abonar
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        placeholder="Ej: 50.000"
                        value={abonoAmount}
                        onChange={(e) =>
                          setAbonoAmount(formatThousandsDot(e.target.value))
                        }
                        className={`w-full mt-1 px-3 py-2.5 rounded-xl text-sm font-bold ${inputBg}`}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-2xl"
                  >
                    Agregar abono
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* MODAL NUEVO MOVIMIENTO */}
        {showMoveModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center anim-backdrop">
            <form
              onSubmit={handleAddMovement}
              className={`w-full max-w-md rounded-t-3xl p-6 space-y-4 anim-sheet max-h-[90vh] overflow-y-auto border-t ${cardBg}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Nuevo movimiento</h3>
                <button
                  type="button"
                  onClick={() => setShowMoveModal(false)}
                  className={`p-1.5 rounded-full ${
                    isDark ? 'bg-neutral-800' : 'bg-neutral-100'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div
                className={`grid grid-cols-2 gap-2 p-1 rounded-2xl ${
                  isDark ? 'bg-neutral-800' : 'bg-neutral-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setMoveType('ingreso')}
                  className={`py-2.5 rounded-xl text-sm font-bold ${
                    moveType === 'ingreso'
                      ? 'bg-blue-600 text-white'
                      : mutedText
                  }`}
                >
                  Ingreso
                </button>
                <button
                  type="button"
                  onClick={() => setMoveType('gasto')}
                  className={`py-2.5 rounded-xl text-sm font-bold ${
                    moveType === 'gasto' ? 'bg-red-600 text-white' : mutedText
                  }`}
                >
                  Gasto
                </button>
              </div>

              <div>
                <label className={`text-xs font-bold ${mutedText}`}>Monto</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="Ej: 50.000"
                  value={moveAmount}
                  onChange={(e) =>
                    setMoveAmount(formatThousandsDot(e.target.value))
                  }
                  className={`w-full mt-1 px-4 py-3 rounded-xl text-lg font-bold ${inputBg}`}
                />
              </div>

              <div className="space-y-1.5">
                <label className={`text-xs font-bold block ${mutedText}`}>
                  Categoría
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((cat) => {
                    const selected = moveCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setMoveCategory(cat)}
                        className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 text-xs font-bold ${
                          selected
                            ? isDark
                              ? 'bg-white text-black border-white'
                              : 'bg-black text-white border-black'
                            : softBg
                        }`}
                      >
                        <span
                          className={
                            selected
                              ? isDark
                                ? ''
                                : 'invert'
                              : ''
                          }
                        >
                          {getIcon(cat)}
                        </span>
                        <span className="truncate">{cat}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={`text-xs font-bold ${mutedText}`}>
                  Cuenta
                </label>
                <select
                  value={moveAccount}
                  onChange={(e) => setMoveAccount(e.target.value)}
                  className={`w-full mt-1 px-3 py-2.5 rounded-xl text-sm font-bold ${inputBg}`}
                >
                  {accountNames.map((acc) => (
                    <option key={acc} value={acc}>
                      {acc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`text-xs font-bold ${mutedText}`}>Nota</label>
                <input
                  type="text"
                  placeholder="Detalle breve"
                  value={moveNote}
                  onChange={(e) => setMoveNote(e.target.value)}
                  className={`w-full mt-1 px-4 py-2.5 rounded-xl text-sm ${inputBg}`}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl"
              >
                Guardar
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}