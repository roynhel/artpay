import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const STORAGE_KEY = 'artpay_data_v8';

const DEFAULT_DATA = {
  userName: '',
  theme: 'dark', // 'dark' | 'light' | 'system'
  accounts: [],
  categories: [],
  debts: [],
  transactions: [],
  wishes: [],
  skipCategoryDeleteConfirm: false,
  skipAccountDeleteConfirm: false,
};

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

const formatCOP = (value) => {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
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

export default function App() {
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_DATA,
          ...parsed,
          categories: Array.isArray(parsed.categories)
            ? parsed.categories.map((c) => {
                if (typeof c === 'string') return { id: c, name: c, icon: 'none' };
                const iconId = ALLOWED_ICON_IDS.has(c.icon) ? c.icon : 'none';
                return { id: c.id || String(Date.now()), name: c.name, icon: iconId };
              })
            : [],
        };
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_DATA;
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

  const [activeTab, setActiveTab] = useState('inicio'); // inicio | estadisticas | deseos | config
  const [hideBalances, setHideBalances] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  // Modal de nuevo movimiento
  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState('gasto'); // ingreso | gasto
  const [txAmount, setTxAmount] = useState('');
  const [txAccount, setTxAccount] = useState('');
  const [txCategoryName, setTxCategoryName] = useState('');
  const [txCategoryIcon, setTxCategoryIcon] = useState('none');
  const [txNote, setTxNote] = useState('');
  const [txError, setTxError] = useState('');

  // Secciones minimizables en Configuración
  const [openSections, setOpenSections] = useState({
    perfil: true,
    apariencia: true,
    cuentas: true,
    categorias: true,
    deudas: true,
  });

  // Secciones minimizables en Estadísticas
  const [openStats, setOpenStats] = useState({
    gastosCat: false,
    ingresosCat: false,
  });

  // Inputs de Configuración
  const [newAccName, setNewAccName] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('none');
  const [newDebtName, setNewDebtName] = useState('');
  const [newDebtAmount, setNewDebtAmount] = useState('');
  const [configNotice, setConfigNotice] = useState('');

  // Confirmación de borrado de categorías
  const [catToDelete, setCatToDelete] = useState(null);
  const [showReenableCatPrompt, setShowReenableCatPrompt] = useState(false);

  // Confirmación de borrado de cuentas
  const [accToDelete, setAccToDelete] = useState(null);
  const [showReenableAccPrompt, setShowReenableAccPrompt] = useState(false);

  // Inputs y reordenamiento de Deseos
  const [wishName, setWishName] = useState('');
  const [wishPrice, setWishPrice] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const touchStartY = useRef(0);
  const touchIndex = useRef(null);
  const importInputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.error(e);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [data]);

  const isDark = data.theme === 'system' ? systemPrefersDark : data.theme === 'dark';

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

  const { totalAvailable, totalDebts, todayIncome, todayExpense } = useMemo(() => {
    const avail = data.accounts.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);
    const debts = data.debts.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
    const todayStr = new Date().toISOString().slice(0, 10);
    let inc = 0;
    let exp = 0;
    for (let i = 0; i < data.transactions.length; i += 1) {
      const t = data.transactions[i];
      if (t.date && t.date.startsWith(todayStr)) {
        if (t.type === 'ingreso') inc += Number(t.amount) || 0;
        else exp += Number(t.amount) || 0;
      }
    }
    return { totalAvailable: avail, totalDebts: debts, todayIncome: inc, todayExpense: exp };
  }, [data.accounts, data.debts, data.transactions]);

  const toggleSection = useCallback((key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleStat = useCallback((key) => {
    setOpenStats((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const goToAddCategory = () => {
    setShowTxModal(false);
    setDrawerOpen(false);
    setActiveTab('config');
    setOpenSections((s) => ({ ...s, categorias: true }));
  };

  // --- Cuentas ---
  const handleAddAccount = (e) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
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

  // --- Categorías ---
  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const created = {
      id: Date.now().toString(),
      name: newCatName.trim(),
      icon: ALLOWED_ICON_IDS.has(newCatIcon) ? newCatIcon : 'none',
    };
    setData((prev) => ({ ...prev, categories: [...prev.categories, created] }));
    setNewCatName('');
    setNewCatIcon('none');
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
    if (!newDebtName.trim()) return;
    const amount = parseMoneyInput(newDebtAmount);
    const created = {
      id: Date.now().toString(),
      name: newDebtName.trim(),
      amount,
    };
    setData((prev) => ({ ...prev, debts: [...prev.debts, created] }));
    setNewDebtName('');
    setNewDebtAmount('');
  };

  const handleDeleteDebt = (id) => {
    setData((prev) => ({
      ...prev,
      debts: prev.debts.filter((d) => d.id !== id),
    }));
  };

  // --- Movimientos ---
  const openTransactionModal = () => {
    setTxType('gasto');
    setTxAmount('');
    setTxAccount(data.accounts[0]?.id || '');
    setTxCategoryName('');
    setTxCategoryIcon('none');
    setTxNote('');
    setTxError('');
    setShowTxModal(true);
  };

  const handleSaveTransaction = (e) => {
    e.preventDefault();
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
          `No puedes gastar ${formatCOP(amount)} en ${accountObj.name}: solo tienes ${formatCOP(currentAccBal)} disponibles.`
        );
        return;
      }
    }

    const newTx = {
      id: Date.now().toString(),
      type: txType,
      amount,
      accountId: accountObj?.id || '',
      accountName: accountObj?.name || 'Sin cuenta',
      categoryName: txCategoryName.trim() || 'General',
      categoryIcon: ALLOWED_ICON_IDS.has(txCategoryIcon) ? txCategoryIcon : 'none',
      note: txNote.trim(),
      date: new Date().toISOString(),
    };

    const updatedAccounts = data.accounts.map((acc) => {
      if (acc.id !== txAccount) return acc;
      const delta = txType === 'ingreso' ? amount : -amount;
      return { ...acc, balance: Math.max(0, (Number(acc.balance) || 0) + delta) };
    });

    setData((prev) => ({
      ...prev,
      accounts: updatedAccounts,
      transactions: [newTx, ...prev.transactions],
    }));
    setShowTxModal(false);
  };

  const handleDeleteTransaction = (tx) => {
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
  };

  // --- Exportar / Importar / Descargar PDF ---
  const handleExportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `artpay-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setConfigNotice('Información exportada.');
    setTimeout(() => setConfigNotice(''), 2500);
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        setData((prev) => ({ ...prev, ...DEFAULT_DATA, ...parsed }));
        setConfigNotice('Información importada correctamente.');
      } catch {
        setConfigNotice('El archivo seleccionado no es un respaldo válido.');
      }
      setTimeout(() => setConfigNotice(''), 3000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadPDF = () => {
    const rowsHtml = data.transactions
      .slice(0, 30)
      .map(
        (t) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${t.categoryName}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${t.accountName}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${t.type === 'ingreso' ? 'Ingreso' : 'Gasto'}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:bold;">${formatCOP(t.amount)}</td>
        </tr>`
      )
      .join('');

    const wishesHtml = data.wishes
      .map(
        (w, i) =>
          `<li style="margin-bottom:4px;">#${i + 1} <strong>${w.name}</strong> — ${formatCOP(w.price)}</li>`
      )
      .join('');

    const printWin = window.open('', '_blank', 'width=680,height=800');
    if (!printWin) return;
    printWin.document.write(`
      <html>
        <head>
          <title>Reporte ArtPay</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin-bottom: 4px; }
            .grid { display: flex; gap: 16px; margin: 16px 0; }
            .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; flex: 1; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
          </style>
        </head>
        <body>
          <h1>ArtPay — Resumen Financiero</h1>
          <p style="color:#64748b;margin-top:0;">${data.userName ? `Usuario: ${data.userName} • ` : ''}Fecha: ${new Date().toLocaleDateString('es-CO')}</p>
          <div class="grid">
            <div class="box"><div>Plata disponible</div><strong>${formatCOP(totalAvailable)}</strong></div>
            <div class="box"><div>Deudas</div><strong>${formatCOP(totalDebts)}</strong></div>
            <div class="box"><div>Deseos estimados</div><strong>${formatCOP(data.wishes.reduce((s, w) => s + (Number(w.price) || 0), 0))}</strong></div>
          </div>
          <h3>Últimos movimientos</h3>
          <table>
            <thead>
              <tr>
                <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #94a3b8;">Categoría</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #94a3b8;">Cuenta</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #94a3b8;">Tipo</th>
                <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #94a3b8;">Valor</th>
              </tr>
            </thead>
            <tbody>${rowsHtml || '<tr><td colspan="4" style="padding:10px;">Sin movimientos</td></tr>'}</tbody>
          </table>
          <h3 style="margin-top:20px;">Lista de deseos</h3>
          <ol>${wishesHtml || '<li>Sin deseos registrados</li>'}</ol>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // --- Deseos ---
  const handleAddWish = (e) => {
    e.preventDefault();
    if (!wishName.trim()) return;
    const price = parseMoneyInput(wishPrice);
    const created = {
      id: Date.now().toString(),
      name: wishName.trim(),
      price,
    };
    setData((prev) => ({ ...prev, wishes: [...prev.wishes, created] }));
    setWishName('');
    setWishPrice('');
  };

  const handleDeleteWish = (id) => {
    setData((prev) => ({
      ...prev,
      wishes: prev.wishes.filter((w) => w.id !== id),
    }));
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
            // En modo oscuro: aún más claro y plateado
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
          }
        : {
            bg: '#F4F6F9',
            headerBg: '#F4F6F9',
            card: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
            // En modo claro: cuadro principal de Plata disponible oscuro / negro con toque plateado
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
            iconCircleBg: 'linear-gradient(160deg, #272B33 0%, #090B0E 100%)',
            iconCircleColor: '#E2E8F0',
            iconCircleBorder: '1.5px solid #94A3B8',
            inputBg: '#F8FAFC',
            navBg: '#FFFFFF',
            danger: '#DC2626',
            dangerBg: 'rgba(220, 38, 38, 0.1)',
            success: '#059669',
            successBg: 'rgba(5, 150, 105, 0.1)',
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

  const renderMoney = (val) => (hideBalances ? '••••••' : formatCOP(val));

  const { expenseByCategory, incomeByCategory, totalAllExpenses, totalAllIncomes, totalCompare } = useMemo(() => {
    const expCat = {};
    const incCat = {};
    let expSum = 0;
    let incSum = 0;
    for (let i = 0; i < data.transactions.length; i += 1) {
      const t = data.transactions[i];
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
  }, [data.transactions]);

  const totalWishesValue = useMemo(
    () => data.wishes.reduce((acc, w) => acc + (Number(w.price) || 0), 0),
    [data.wishes]
  );

  const getWishRankStyle = (idx) => {
    if (idx === 0) {
      return {
        badgeBg: '#F59E0B',
        badgeColor: '#090B0E',
        cardBorder: 'rgba(245, 158, 11, 0.45)',
        amountColor: '#FBBF24',
      };
    }
    if (idx === 1) {
      return {
        badgeBg: '#CBD5E1',
        badgeColor: '#090B0E',
        cardBorder: 'rgba(203, 213, 225, 0.35)',
        amountColor: '#E2E8F0',
      };
    }
    if (idx === 2) {
      return {
        badgeBg: '#60A5FA',
        badgeColor: '#090B0E',
        cardBorder: 'rgba(96, 165, 250, 0.38)',
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
            transform: translateY(12px) scale(0.99);
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
        .ios-screen-enter {
          animation: iosTabEnter 0.36s ${iosEase};
        }
        .ios-drawer-enter {
          animation: iosDrawerSlide 0.34s ${iosEase};
        }
        .ios-sheet-enter {
          animation: iosSheetSlide 0.36s ${iosEase};
        }
      `}</style>

      {/* Menú lateral deslizable (Principal y Configuración) */}
      {drawerOpen && (
        <div
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                  src="/logo.png"
                  alt="ArtPay"
                  style={{ width: '34px', height: '34px', borderRadius: '10px', objectFit: 'cover' }}
                />
                <span style={{ fontSize: '17px', fontWeight: 800 }}>ArtPay</span>
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
              { id: 'estadisticas', label: 'Estadísticas' },
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
                  {item.label}
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
                transition: `transform 0.2s ${iosEase}`,
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
              <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.4px' }}>
                ArtPay
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('config');
                  setOpenSections((s) => ({ ...s, perfil: true }));
                }}
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
              transition: `transform 0.2s ${iosEase}, background-color 0.25s ${iosEase}`,
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
            {/* Cuadro Principal: Plata disponible (oscuro en modo claro, más claro y plateado en modo oscuro) */}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
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
                      transition: `all 0.3s ${iosEase}`,
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
                  {data.accounts.length} {data.accounts.length === 1 ? 'cuenta' : 'cuentas'}
                </span>
              </div>

              <div
                style={{
                  fontSize: '34px',
                  fontWeight: 800,
                  letterSpacing: '-1px',
                  background: theme.silverGradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  marginBottom: '16px',
                }}
              >
                {renderMoney(totalAvailable)}
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
              onClick={() => {
                setActiveTab('config');
                setOpenSections((s) => ({ ...s, deudas: true }));
              }}
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '18px',
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: `transform 0.2s ${iosEase}, border-color 0.2s ${iosEase}`,
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
                <div style={{ fontSize: '22px', fontWeight: 800, color: theme.textPrimary }}>
                  {renderMoney(totalDebts)}
                </div>
                <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '2px' }}>
                  {data.debts.length === 0
                    ? 'Sin deudas • Toca para agregar en Configuración'
                    : `${data.debts.length} ${data.debts.length === 1 ? 'deuda activa' : 'deudas activas'}`}
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

            {/* Botón Principal Azul: Registrar movimiento */}
            <button
              type="button"
              onClick={openTransactionModal}
              style={{
                width: '100%',
                padding: '15px',
                borderRadius: '16px',
                border: 'none',
                backgroundColor: theme.accentBlue,
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(37, 99, 235, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: `transform 0.2s ${iosEase}, box-shadow 0.2s ${iosEase}`,
              }}
            >
              <span style={{ fontSize: '19px', lineHeight: 1 }}>+</span> Registrar movimiento
            </button>

            {/* Lista de Movimientos */}
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
                  {data.transactions.length} en total
                </span>
              </div>

              {data.transactions.length === 0 ? (
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      style={{
                        backgroundColor: theme.cardSolid,
                        border: `1px solid ${theme.border}`,
                        borderRadius: '14px',
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        transition: `transform 0.22s ${iosEase}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        {tx.categoryIcon && tx.categoryIcon !== 'none' ? (
                          <CategoryGlyph iconId={tx.categoryIcon} size={18} color={theme.textSecondary} />
                        ) : null}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: theme.textPrimary }}>
                            {tx.categoryName}
                          </div>
                          <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '2px' }}>
                            {tx.accountName}
                            {tx.note ? ` • ${tx.note}` : ''}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            color: tx.type === 'ingreso' ? theme.success : theme.danger,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {tx.type === 'ingreso' ? '+' : '-'}
                          {renderMoney(tx.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTransaction(tx)}
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================= PESTAÑA ESTADÍSTICAS ================= */}
        {activeTab === 'estadisticas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h2 style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>Estadísticas</h2>

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
                      transition: `width 0.45s ${iosEase}`,
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
                      transition: `width 0.45s ${iosEase}`,
                    }}
                  />
                </div>
              </div>
            </section>

            {/* Minimizable: Gasto por categoría */}
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
                onClick={() => toggleStat('gastosCat')}
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
                <span style={{ fontSize: '14px', fontWeight: 700 }}>Gasto por categoría</span>
                <span style={{ fontSize: '12px', color: theme.textSecondary, transition: `transform 0.25s ${iosEase}` }}>
                  {openStats.gastosCat ? '▲' : '▼'}
                </span>
              </button>

              {openStats.gastosCat && (
                <div className="ios-screen-enter" style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.keys(expenseByCategory).length === 0 ? (
                    <div style={{ fontSize: '13px', color: theme.textMuted }}>Sin gastos registrados aún.</div>
                  ) : (
                    Object.entries(expenseByCategory)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, amt]) => (
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
                          <span style={{ fontWeight: 700, color: theme.danger }}>{renderMoney(amt)}</span>
                        </div>
                      ))
                  )}
                </div>
              )}
            </section>

            {/* Minimizable: Ingresos por categoría */}
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
                onClick={() => toggleStat('ingresosCat')}
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
                <span style={{ fontSize: '14px', fontWeight: 700 }}>Ingresos por categoría</span>
                <span style={{ fontSize: '12px', color: theme.textSecondary, transition: `transform 0.25s ${iosEase}` }}>
                  {openStats.ingresosCat ? '▲' : '▼'}
                </span>
              </button>

              {openStats.ingresosCat && (
                <div className="ios-screen-enter" style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.keys(incomeByCategory).length === 0 ? (
                    <div style={{ fontSize: '13px', color: theme.textMuted }}>Sin ingresos registrados aún.</div>
                  ) : (
                    Object.entries(incomeByCategory)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, amt]) => (
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
                          <span style={{ fontWeight: 700, color: theme.success }}>{renderMoney(amt)}</span>
                        </div>
                      ))
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================= PESTAÑA DESEOS ================= */}
        {activeTab === 'deseos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>Lista de Deseos</h2>
                <p style={{ fontSize: '12px', color: theme.textSecondary, margin: '3px 0 0' }}>
                  Mantén presionado el agarre izquierdo para ordenar
                </p>
              </div>
              {data.wishes.length > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: theme.textMuted }}>Total estimado</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: theme.accentBlueText }}>
                    {renderMoney(totalWishesValue)}
                  </div>
                </div>
              )}
            </div>

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
                  onChange={(e) => setWishName(e.target.value)}
                  style={baseInputStyle}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej: 180.000"
                  value={wishPrice}
                  onChange={(e) => setWishPrice(formatMoneyInput(e.target.value))}
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
                          onClick={() => handleDeleteWish(wish.id)}
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

            {/* 1. PERFIL */}
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
                <span style={{ fontSize: '14px', fontWeight: 700 }}>Perfil</span>
                <span style={{ fontSize: '12px', color: theme.textSecondary }}>
                  {openSections.perfil ? '▲' : '▼'}
                </span>
              </button>

              {openSections.perfil && (
                <div className="ios-screen-enter" style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                  <div style={{ fontSize: '11px', color: theme.textMuted, lineHeight: 1.35 }}>
                    Exportar guarda una copia de tus datos en archivo; Importar carga un respaldo guardado antes.
                  </div>
                </div>
              )}
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

              {openSections.apariencia && (
                <div className="ios-screen-enter" style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
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
              )}
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

              {openSections.cuentas && (
                <div className="ios-screen-enter" style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                        Volver a preguntar
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleAddAccount} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Ej: Nequi"
                        value={newAccName}
                        onChange={(e) => setNewAccName(e.target.value)}
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
                </div>
              )}
            </section>

            {/* 4. CATEGORÍAS */}
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
                  Categorías ({data.categories.length})
                </span>
                <span style={{ fontSize: '12px', color: theme.textSecondary }}>
                  {openSections.categorias ? '▲' : '▼'}
                </span>
              </button>

              {openSections.categorias && (
                <div className="ios-screen-enter" style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                      Agrega una categoría. Elegir un ícono es opcional (puedes dejar <strong>✕</strong> sin ícono).
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {data.categories.map((cat) => (
                        <div
                          key={cat.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: theme.cardSubtle,
                            border: `1px solid ${theme.border}`,
                            borderRadius: '999px',
                            padding: '6px 12px',
                            fontSize: '13px',
                          }}
                        >
                          {cat.icon && cat.icon !== 'none' ? (
                            <CategoryGlyph iconId={cat.icon} size={14} color={theme.textSecondary} />
                          ) : null}
                          <span>{cat.name}</span>
                          <button
                            type="button"
                            onClick={() => requestDeleteCategory(cat)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: theme.textMuted,
                              cursor: 'pointer',
                              fontSize: '13px',
                              padding: 0,
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
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

                  <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                              transition: `all 0.2s ${iosEase}`,
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
                        onChange={(e) => setNewCatName(e.target.value)}
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
              )}
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

              {openSections.deudas && (
                <div className="ios-screen-enter" style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                      {data.debts.map((debt) => (
                        <div
                          key={debt.id}
                          style={{
                            backgroundColor: theme.cardSubtle,
                            border: `1px solid ${theme.border}`,
                            borderRadius: '12px',
                            padding: '10px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>{debt.name}</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: theme.danger }}>
                              {renderMoney(debt.amount)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteDebt(debt.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: theme.textMuted,
                              cursor: 'pointer',
                              fontSize: '14px',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleAddDebt} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Ej: Tarjeta"
                        value={newDebtName}
                        onChange={(e) => setNewDebtName(e.target.value)}
                        style={baseInputStyle}
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Ej: 200.000"
                        value={newDebtAmount}
                        onChange={(e) => setNewDebtAmount(formatMoneyInput(e.target.value))}
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
              )}
            </section>

            {/* Botón directo al final: Descargar PDF + nota pequeña */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <button
                type="button"
                onClick={handleDownloadPDF}
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
                Crea una vista imprimible o para guardar como PDF con tu saldo disponible, deudas, movimientos y deseos.
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ================= MODAL REGISTRAR MOVIMIENTO ================= */}
      {showTxModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <form
            className="ios-sheet-enter"
            onSubmit={handleSaveTransaction}
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
              maxHeight: '90dvh',
              overflowY: 'auto',
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
                  transition: `all 0.2s ${iosEase}`,
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
                  transition: `all 0.2s ${iosEase}`,
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

            <select
              value={txAccount}
              onChange={(e) => {
                setTxAccount(e.target.value);
                if (txError) setTxError('');
              }}
              style={{ ...baseInputStyle, fontSize: '14px', padding: '12px' }}
            >
              <option value="">Selecciona una cuenta</option>
              {data.accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({formatCOP(acc.balance)})
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

            {/* Categorías agregadas + botón Agregar categoría */}
            <div>
              <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '6px' }}>
                Categoría
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {data.categories.map((cat) => {
                  const selected = txCategoryName === cat.name;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setTxCategoryName(selected ? '' : cat.name);
                        setTxCategoryIcon(selected ? 'none' : cat.icon || 'none');
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
                        transition: `all 0.2s ${iosEase}`,
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

            <input
              type="text"
              placeholder="Nota corta (Ej: Almuerzo)"
              value={txNote}
              onChange={(e) => setTxNote(e.target.value)}
              style={{ ...baseInputStyle, fontSize: '14px', padding: '12px' }}
            />

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '14px',
                border: 'none',
                backgroundColor: theme.accentBlue,
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Guardar movimiento
            </button>
          </form>
        </div>
      )}

      {/* ================= MODAL CONFIRMAR BORRAR CATEGORÍA ================= */}
      {catToDelete && (
        <div
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
              Esta categoría se quitará de tu lista.
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

      {/* ================= BARRA DE NAVEGACIÓN INFERIOR (4 PESTAÑAS) ================= */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          backgroundColor: theme.navBg,
          borderTop: `1px solid ${theme.border}`,
          padding: '8px 8px calc(10px + env(safe-area-inset-bottom))',
          transition: `background-color 0.32s ${iosEase}, border-color 0.32s ${iosEase}`,
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '4px',
          }}
        >
          {[
            {
              id: 'inicio',
              label: 'Inicio',
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              ),
            },
            {
              id: 'estadisticas',
              label: 'Estadísticas',
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              ),
            },
            {
              id: 'deseos',
              label: 'Deseos',
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ),
            },
            {
              id: 'config',
              label: 'Configuración',
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              ),
            },
          ].map((tab) => {
            const active = activeTab === tab.id;
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
                  fontSize: '11px',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  transform: active ? 'translateY(-1px)' : 'translateY(0)',
                  transition: `all 0.22s ${iosEase}`,
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}