import React, { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'artpay_data_v2';

const DEFAULT_DATA = {
  userName: '',
  theme: 'dark',
  accounts: [],
  categories: [],
  debts: [],
  transactions: [],
  wishes: [],
  skipCategoryDeleteConfirm: false,
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
        return { ...DEFAULT_DATA, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_DATA;
  });

  const [activeTab, setActiveTab] = useState('inicio'); // inicio | estadisticas | deseos | config
  const [hideBalances, setHideBalances] = useState(false);

  // Modal de nuevo movimiento
  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState('gasto'); // ingreso | gasto
  const [txAmount, setTxAmount] = useState('');
  const [txAccount, setTxAccount] = useState('');
  const [txCategory, setTxCategory] = useState('');
  const [txNote, setTxNote] = useState('');

  // Secciones minimizables en Configuración
  const [openSections, setOpenSections] = useState({
    perfil: true,
    apariencia: false,
    cuentas: true,
    categorias: true,
    deudas: true,
  });

  // Inputs de Configuración
  const [newAccName, setNewAccName] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState('gasto');
  const [newDebtName, setNewDebtName] = useState('');
  const [newDebtAmount, setNewDebtAmount] = useState('');

  // Confirmación de borrado de categorías
  const [catToDelete, setCatToDelete] = useState(null);
  const [showReenablePrompt, setShowReenablePrompt] = useState(false);

  // Inputs y reordenamiento de Deseos
  const [wishName, setWishName] = useState('');
  const [wishPrice, setWishPrice] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const touchStartY = useRef(0);
  const touchIndex = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error(e);
    }
  }, [data]);

  const isDark = data.theme === 'dark';

  // Cálculos financieros
  const totalAvailable = data.accounts.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);
  const totalDebts = data.debts.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTxs = data.transactions.filter((t) => t.date.startsWith(todayStr));
  const todayIncome = todayTxs
    .filter((t) => t.type === 'ingreso')
    .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const todayExpense = todayTxs
    .filter((t) => t.type === 'gasto')
    .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
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

  const handleDeleteAccount = (id) => {
    setData((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== id),
    }));
  };

  // --- Categorías ---
  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const created = {
      id: Date.now().toString(),
      name: newCatName.trim(),
      type: newCatType,
    };
    setData((prev) => ({ ...prev, categories: [...prev.categories, created] }));
    setNewCatName('');
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
    setTxCategory('');
    setTxNote('');
    setShowTxModal(true);
  };

  const handleSaveTransaction = (e) => {
    e.preventDefault();
    const amount = parseMoneyInput(txAmount);
    if (!amount || amount <= 0) return;

    const accountObj = data.accounts.find((a) => a.id === txAccount);
    const categoryObj = data.categories.find((c) => c.id === txCategory);

    const newTx = {
      id: Date.now().toString(),
      type: txType,
      amount,
      accountId: accountObj?.id || '',
      accountName: accountObj?.name || 'Sin cuenta',
      categoryName: categoryObj?.name || (txType === 'ingreso' ? 'Ingreso general' : 'Gasto general'),
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

  const theme = isDark
    ? {
        bg: '#050608',
        headerBg: 'rgba(5, 6, 8, 0.88)',
        card: 'linear-gradient(180deg, #16191f 0%, #0b0d10 100%)',
        cardSolid: '#0e1014',
        cardSubtle: '#13161c',
        border: 'rgba(255, 255, 255, 0.11)',
        borderStrong: 'rgba(255, 255, 255, 0.22)',
        textPrimary: '#FFFFFF',
        textSecondary: '#B6BDC8',
        textMuted: '#78808E',
        silverGradient: 'linear-gradient(180deg, #FFFFFF 0%, #B8C0CC 100%)',
        accentBlue: '#2563EB',
        accentBlueSoft: 'rgba(37, 99, 235, 0.16)',
        accentBlueText: '#60A5FA',
        whiteCircleBg: '#FFFFFF',
        whiteCircleIcon: '#060709',
        inputBg: '#090B0E',
        navBg: 'rgba(8, 10, 13, 0.94)',
        danger: '#F87171',
        dangerBg: 'rgba(239, 68, 68, 0.14)',
        success: '#34D399',
        successBg: 'rgba(16, 185, 129, 0.14)',
      }
    : {
        bg: '#F4F6F9',
        headerBg: 'rgba(244, 246, 249, 0.9)',
        card: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
        cardSolid: '#FFFFFF',
        cardSubtle: '#EEF2F6',
        border: 'rgba(15, 23, 42, 0.09)',
        borderStrong: 'rgba(15, 23, 42, 0.18)',
        textPrimary: '#0B0D11',
        textSecondary: '#475569',
        textMuted: '#64748B',
        silverGradient: 'linear-gradient(180deg, #0B0D11 0%, #334155 100%)',
        accentBlue: '#2563EB',
        accentBlueSoft: 'rgba(37, 99, 235, 0.1)',
        accentBlueText: '#2563EB',
        whiteCircleBg: '#0B0D11',
        whiteCircleIcon: '#FFFFFF',
        inputBg: '#F8FAFC',
        navBg: 'rgba(255, 255, 255, 0.95)',
        danger: '#DC2626',
        dangerBg: 'rgba(220, 38, 38, 0.1)',
        success: '#059669',
        successBg: 'rgba(5, 150, 105, 0.1)',
      };

  const renderMoney = (val) => (hideBalances ? '••••••' : formatCOP(val));

  const expenseByCategory = data.transactions
    .filter((t) => t.type === 'gasto')
    .reduce((acc, t) => {
      acc[t.categoryName] = (acc[t.categoryName] || 0) + Number(t.amount);
      return acc;
    }, {});

  const totalAllExpenses = Object.values(expenseByCategory).reduce((a, b) => a + b, 0);
  const totalAllIncomes = data.transactions
    .filter((t) => t.type === 'ingreso')
    .reduce((a, b) => a + Number(b.amount), 0);

  const totalWishesValue = data.wishes.reduce((acc, w) => acc + (Number(w.price) || 0), 0);

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: theme.bg,
        color: theme.textPrimary,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
        paddingBottom: '94px',
        transition: 'background-color 0.25s ease, color 0.25s ease',
      }}
    >
      {/* Header superior */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backgroundColor: theme.headerBg,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${theme.border}`,
          padding: '14px 18px',
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
            <img
              src="/logo.png"
              alt="ArtPay"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '11px',
                objectFit: 'cover',
                border: '1px solid rgba(255,255,255,0.18)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.45)',
              }}
            />
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
      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '16px' }}>
        {/* ================= PESTAÑA INICIO ================= */}
        {activeTab === 'inicio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Tarjeta Principal: Plata disponible con círculo blanco contrastado */}
            <section
              style={{
                background: theme.card,
                border: `1px solid ${theme.borderStrong}`,
                borderRadius: '20px',
                padding: '20px',
                boxShadow: isDark ? '0 14px 32px rgba(0, 0, 0, 0.55)' : '0 8px 24px rgba(15, 23, 42, 0.06)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: theme.whiteCircleBg,
                      color: theme.whiteCircleIcon,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isDark ? '0 0 16px rgba(255,255,255,0.22)' : 'none',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                      <rect x="2" y="5" width="20" height="14" rx="3" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.8px',
                      color: theme.textSecondary,
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
                    color: theme.accentBlueText,
                    backgroundColor: theme.accentBlueSoft,
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

              {/* Resumen HOY */}
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.7px',
                  color: theme.textMuted,
                  marginBottom: '8px',
                }}
              >
                HOY
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div
                  style={{
                    backgroundColor: theme.cardSubtle,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '14px',
                    padding: '12px',
                  }}
                >
                  <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>
                    Ingresos
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: theme.success }}>
                    +{renderMoney(todayIncome)}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: theme.cardSubtle,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '14px',
                    padding: '12px',
                  }}
                >
                  <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>
                    Gastos
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: theme.danger }}>
                    -{renderMoney(todayExpense)}
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
                  borderRadius: '12px',
                  backgroundColor: theme.accentBlueSoft,
                  color: theme.accentBlueText,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: theme.textPrimary }}>
                          {tx.categoryName}
                        </div>
                        <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '2px' }}>
                          {tx.accountName}
                          {tx.note ? ` • ${tx.note}` : ''}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div
                style={{
                  background: theme.card,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '16px',
                  padding: '16px',
                }}
              >
                <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>
                  Total Ingresos
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: theme.success }}>
                  {renderMoney(totalAllIncomes)}
                </div>
              </div>

              <div
                style={{
                  background: theme.card,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '16px',
                  padding: '16px',
                }}
              >
                <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>
                  Total Gastos
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: theme.danger }}>
                  {renderMoney(totalAllExpenses)}
                </div>
              </div>
            </div>

            <section
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '18px',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>
                Gastos por categoría
              </div>

              {Object.keys(expenseByCategory).length === 0 ? (
                <div style={{ fontSize: '13px', color: theme.textMuted }}>
                  Aún no tienes gastos registrados para mostrar porcentajes.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {Object.entries(expenseByCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, amt]) => {
                      const pct = totalAllExpenses > 0 ? Math.round((amt / totalAllExpenses) * 100) : 0;
                      return (
                        <div key={cat}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '13px',
                              marginBottom: '5px',
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{cat}</span>
                            <span style={{ color: theme.textSecondary }}>
                              {renderMoney(amt)} ({pct}%)
                            </span>
                          </div>
                          <div
                            style={{
                              height: '8px',
                              borderRadius: '999px',
                              backgroundColor: theme.cardSubtle,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                backgroundColor: theme.accentBlue,
                                borderRadius: '999px',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
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
                  Ordena tus prioridades sin afectar tus cuentas
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
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Ej: Gafas oscuras"
                  value={wishName}
                  onChange={(e) => setWishName(e.target.value)}
                  style={{
                    backgroundColor: theme.inputBg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '12px',
                    padding: '11px 12px',
                    color: theme.textPrimary,
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej: 180.000"
                  value={wishPrice}
                  onChange={(e) => setWishPrice(formatMoneyInput(e.target.value))}
                  style={{
                    backgroundColor: theme.inputBg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '12px',
                    padding: '11px 12px',
                    color: theme.textPrimary,
                    fontSize: '14px',
                    outline: 'none',
                  }}
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
                + Agregar a mi lista
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
                Tu lista de deseos está vacía. Agrega algo que quieras comprar arriba y ordénalo por prioridad.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.wishes.map((wish, idx) => (
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
                          : `1px solid ${theme.border}`,
                      borderRadius: '15px',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      opacity: dragIndex === idx ? 0.72 : 1,
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div
                        onTouchStart={(e) => handleTouchStartGrip(idx, e)}
                        onTouchMove={handleTouchMoveGrip}
                        onTouchEnd={handleTouchEndGrip}
                        title="Mantén presionado y arrastra para mover"
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
                          backgroundColor: idx === 0 ? theme.whiteCircleBg : theme.cardSubtle,
                          color: idx === 0 ? theme.whiteCircleIcon : theme.textSecondary,
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
                        <div style={{ fontSize: '13px', fontWeight: 600, color: theme.accentBlueText }}>
                          {renderMoney(wish.price)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => reorderWishes(idx, idx - 1)}
                        title="Subir prioridad"
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
                        title="Bajar prioridad"
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
                        title="Eliminar deseo"
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
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= PESTAÑA CONFIGURACIÓN ================= */}
        {activeTab === 'config' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 style={{ fontSize: '19px', fontWeight: 700, margin: '0 0 2px' }}>Configuración</h2>

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
                <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', color: theme.textSecondary }}>Tu nombre</label>
                  <input
                    type="text"
                    placeholder="Ej: Roynhel"
                    value={data.userName}
                    onChange={(e) => setData((prev) => ({ ...prev, userName: e.target.value }))}
                    style={{
                      backgroundColor: theme.inputBg,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '12px',
                      padding: '11px 12px',
                      color: theme.textPrimary,
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  />
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
                <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setData((prev) => ({ ...prev, theme: 'dark' }))}
                    style={{
                      padding: '11px',
                      borderRadius: '12px',
                      border: isDark ? `1.5px solid ${theme.accentBlue}` : `1px solid ${theme.border}`,
                      backgroundColor: isDark ? theme.accentBlueSoft : theme.cardSubtle,
                      color: theme.textPrimary,
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Negro / Plateado
                  </button>
                  <button
                    type="button"
                    onClick={() => setData((prev) => ({ ...prev, theme: 'light' }))}
                    style={{
                      padding: '11px',
                      borderRadius: '12px',
                      border: !isDark ? `1.5px solid ${theme.accentBlue}` : `1px solid ${theme.border}`,
                      backgroundColor: !isDark ? theme.accentBlueSoft : theme.cardSubtle,
                      color: theme.textPrimary,
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Modo Claro
                  </button>
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
                <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                      Aún no tienes cuentas. Agrega una abajo (por ejemplo: <strong>Nequi</strong> con saldo{' '}
                      <strong>50.000</strong> o <strong>Efectivo</strong>).
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
                          <span style={{ fontSize: '14px', fontWeight: 600 }}>{acc.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={Number(acc.balance).toLocaleString('es-CO')}
                              onChange={(e) => handleUpdateAccountBalance(acc.id, e.target.value)}
                              style={{
                                width: '110px',
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
                              onClick={() => handleDeleteAccount(acc.id)}
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

                  <form onSubmit={handleAddAccount} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Ej: Nequi / Efectivo"
                        value={newAccName}
                        onChange={(e) => setNewAccName(e.target.value)}
                        style={{
                          backgroundColor: theme.inputBg,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '10px',
                          padding: '10px',
                          color: theme.textPrimary,
                          fontSize: '13px',
                        }}
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Ej: 50.000"
                        value={newAccBalance}
                        onChange={(e) => setNewAccBalance(formatMoneyInput(e.target.value))}
                        style={{
                          backgroundColor: theme.inputBg,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '10px',
                          padding: '10px',
                          color: theme.textPrimary,
                          fontSize: '13px',
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      style={{
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
                <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                      Aún no tienes categorías. Crea las tuyas abajo (por ejemplo: <strong>Comida</strong> o{' '}
                      <strong>Trabajo</strong>).
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {data.categories.map((cat) => (
                        <div
                          key={cat.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            backgroundColor: theme.cardSubtle,
                            border: `1px solid ${theme.border}`,
                            borderRadius: '999px',
                            padding: '6px 12px',
                            fontSize: '13px',
                          }}
                        >
                          <span
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              backgroundColor: cat.type === 'ingreso' ? theme.success : theme.danger,
                            }}
                          />
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
                        onClick={() => setShowReenablePrompt(true)}
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Ej: Comida / Transporte"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        style={{
                          backgroundColor: theme.inputBg,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '10px',
                          padding: '10px',
                          color: theme.textPrimary,
                          fontSize: '13px',
                        }}
                      />
                      <select
                        value={newCatType}
                        onChange={(e) => setNewCatType(e.target.value)}
                        style={{
                          backgroundColor: theme.inputBg,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '10px',
                          padding: '10px',
                          color: theme.textPrimary,
                          fontSize: '13px',
                        }}
                      >
                        <option value="gasto">Gasto</option>
                        <option value="ingreso">Ingreso</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      style={{
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
                      + Agregar categoría
                    </button>
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
                <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                      No tienes deudas registradas (por ejemplo: <strong>Tarjeta</strong> por{' '}
                      <strong>200.000</strong>).
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Ej: Tarjeta / Préstamo"
                        value={newDebtName}
                        onChange={(e) => setNewDebtName(e.target.value)}
                        style={{
                          backgroundColor: theme.inputBg,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '10px',
                          padding: '10px',
                          color: theme.textPrimary,
                          fontSize: '13px',
                        }}
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Ej: 200.000"
                        value={newDebtAmount}
                        onChange={(e) => setNewDebtAmount(formatMoneyInput(e.target.value))}
                        style={{
                          backgroundColor: theme.inputBg,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '10px',
                          padding: '10px',
                          color: theme.textPrimary,
                          fontSize: '13px',
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      style={{
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
                onClick={() => setTxType('gasto')}
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
                onClick={() => setTxType('ingreso')}
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
              onChange={(e) => setTxAmount(formatMoneyInput(e.target.value))}
              required
              style={{
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '12px',
                padding: '12px',
                color: theme.textPrimary,
                fontSize: '16px',
                fontWeight: 700,
              }}
            />

            <select
              value={txAccount}
              onChange={(e) => setTxAccount(e.target.value)}
              style={{
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '12px',
                padding: '12px',
                color: theme.textPrimary,
                fontSize: '14px',
              }}
            >
              <option value="">Selecciona una cuenta (opcional)</option>
              {data.accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({formatCOP(acc.balance)})
                </option>
              ))}
            </select>

            <select
              value={txCategory}
              onChange={(e) => setTxCategory(e.target.value)}
              style={{
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '12px',
                padding: '12px',
                color: theme.textPrimary,
                fontSize: '14px',
              }}
            >
              <option value="">Selecciona una categoría (opcional)</option>
              {data.categories
                .filter((c) => c.type === txType)
                .map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
            </select>

            <input
              type="text"
              placeholder="Nota corta (Ej: Almuerzo)"
              value={txNote}
              onChange={(e) => setTxNote(e.target.value)}
              style={{
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '12px',
                padding: '12px',
                color: theme.textPrimary,
                fontSize: '14px',
              }}
            />

            <button
              type="submit"
              style={{
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

      {/* ================= MODAL VOLVER A PREGUNTAR ================= */}
      {showReenablePrompt && (
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
              ¿Quieres que te vuelva a preguntar cada vez que vayas a eliminar algo?
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button
                type="button"
                onClick={() => setShowReenablePrompt(false)}
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
                  setShowReenablePrompt(false);
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
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: `1px solid ${theme.border}`,
          padding: '8px 8px calc(10px + env(safe-area-inset-bottom))',
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