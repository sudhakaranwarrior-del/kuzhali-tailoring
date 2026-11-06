import React, { useState, useEffect, useMemo, useRef } from 'react';

// --- APPLICATION CONSTANTS & VERSIONING ---
const APP_VERSION = "2.1.0";
const DB_VERSION = 2;
const DB_NAME = "KuzhaliTailoringDB";

// Default Shop Configuration
const INITIAL_SHOP_CONFIG = {
  shopNameTamil: "குழலி தையலகம்",
  shopNameEnglish: "Kuzhali Tailoring",
  tagline: "Smart Tailoring Business Manager",
  ownerName: "Tamil Selvi",
  contactNumber: "8940204536",
  address: "12/4, Main Bazaar Street, Thenkarai, Tamil Nadu - 625501",
  mapLocationUrl: "https://maps.google.com/?q=Thenkarai,TamilNadu",
  logoUrl: "",
  ownerPin: "1234", // Default PIN
  isPinLocked: false,
  lastBackupDate: null,
  currencySymbol: "₹",
  language: "ta" // 'ta' | 'en'
};

// --- ROBUST INDEXEDDB STORAGE SERVICE ---
class StorageService {
  static db = null;

  static async openDB() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = (e) => reject("IndexedDB connection failed: " + e.target.error);
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        const stores = [
          { name: "customers", key: "id" },
          { name: "measurements", key: "id" },
          { name: "orders", key: "id" },
          { name: "expenses", key: "id" },
          { name: "shg_records", key: "id" },
          { name: "settings", key: "key" },
          { name: "backups_log", key: "id" }
        ];
        stores.forEach(s => {
          if (!db.objectStoreNames.contains(s.name)) {
            db.createObjectStore(s.name, { keyPath: s.key });
          }
        });
      };
    });
  }

  static async getAll(storeName) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  static async put(storeName, item) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  static async delete(storeName, id) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  static async clearAll() {
    const db = await this.openDB();
    const stores = ["customers", "measurements", "orders", "expenses", "shg_records"];
    const tx = db.transaction(stores, "readwrite");
    stores.forEach(s => tx.objectStore(s).clear());
    return new Promise((resolve) => tx.oncomplete = () => resolve(true));
  }
}

// --- CSV EXPORTER HELPER ---
function exportArrayToCSV(filename, rows) {
  if (!rows || !rows.length) return alert("பதிவிறக்க தரவு இல்லை (No data to export)");
  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    '\uFEFF' + // UTF-8 BOM for Tamil font support in MS Excel
    keys.join(separator) +
    '\n' +
    rows.map(row => {
      return keys.map(k => {
        let cell = row[k] === null || row[k] === undefined ? '' : row[k];
        cell = cell instanceof Date ? cell.toLocaleString() : cell.toString().replace(/"/g, '""');
        if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
        return cell;
      }).join(separator);
    }).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// --- MAIN REACT APPLICATION COMPONENT ---
export default function KuzhaliTailoringApp() {
  // Navigation State
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, customers, orders, expenses, reports, ai_assistant, settings
  const [lang, setLang] = useState("ta");

  // App & Security State
  const [settings, setSettings] = useState(INITIAL_SHOP_CONFIG);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState("");

  // Business Data Collections
  const [customers, setCustomers] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [shgRecords, setShgRecords] = useState([]);

  // Active Selection Modals & Compare States
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [compareVersions, setCompareVersions] = useState({ vA: null, vB: null });
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isMeasurementModalOpen, setIsMeasurementModalOpen] = useState(false);
  const [selectedOrderForBill, setSelectedOrderForBill] = useState(null);

  // Gemini AI Chat State
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem("GEMINI_KEY") || "");
  const [aiChatMessages, setAiChatMessages] = useState([
    { sender: "ai", text: "வணக்கம்! நான் உங்கள் குழலி தையலக AI உதவியாளர். புதிய வாடிக்கையாளர் அளவுகள், பிளவுஸ் வெட்டும் முறைகள் அல்லது கணக்கு விபரங்கள் பற்றி நீங்கள் கேட்கலாம்." }
  ]);
  const [aiInputPrompt, setAiInputPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // UI Form Scratchpads
  const [newCustomerForm, setNewCustomerForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [newMeasurementForm, setNewMeasurementForm] = useState({
    garmentType: "Blouse",
    unit: "inches",
    notes: "",
    designPhotoUrl: "",
    data: {
      length: "",
      chest: "",
      waist: "",
      shoulder: "",
      sleeveLength: "",
      sleeveLoose: "",
      frontNeck: "",
      backNeck: "",
      armHole: "",
      bustPoint: "",
      crossFront: ""
    }
  });

  const [newOrderForm, setNewOrderForm] = useState({
    customerId: "",
    garmentType: "Blouse",
    measurementVersionId: "",
    deliveryDate: "",
    stitchingCharge: 0,
    aariCharge: 0,
    liningCharge: 0,
    additionalCharge: 0,
    discount: 0,
    advancePaid: 0,
    paymentMethod: "Cash",
    notes: "",
    // Cost tracking for order-wise profit
    materialExpense: 0,
    aariWorkerLabor: 0,
    otherExpenses: 0
  });

  // Load All Entities from IndexedDB on Boot
  useEffect(() => {
    async function loadAllData() {
      try {
        const storedSettings = await StorageService.getAll("settings");
        if (storedSettings.length > 0) {
          const cfg = storedSettings.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
          setSettings(prev => ({ ...prev, ...cfg }));
          if (!cfg.isPinLocked) setIsUnlocked(true);
        } else {
          // Initialize settings table
          Object.entries(INITIAL_SHOP_CONFIG).forEach(([k, v]) => {
            StorageService.put("settings", { key: k, value: v });
          });
          setIsUnlocked(true);
        }

        const [cList, mList, oList, eList, sList] = await Promise.all([
          StorageService.getAll("customers"),
          StorageService.getAll("measurements"),
          StorageService.getAll("orders"),
          StorageService.getAll("expenses"),
          StorageService.getAll("shg_records")
        ]);

        setCustomers(cList);
        setMeasurements(mList);
        setOrders(oList);
        setExpenses(eList);
        setShgRecords(sList);
      } catch (err) {
        console.error("Critical database initialization error:", err);
      }
    }
    loadAllData();
  }, []);

  // --- PIN LOCK VALIDATION ---
  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (enteredPin === settings.ownerPin) {
      setIsUnlocked(true);
      setPinError("");
      setEnteredPin("");
    } else {
      setPinError("தவறான PIN எண்! மீண்டும் முயற்சிக்கவும்.");
    }
  };

  // --- FINANCIAL CALCULATIONS AUDIT ENGINE ---
  const financialAnalytics = useMemo(() => {
    const totalOrdersValue = orders.reduce((sum, o) => {
      const bill = (Number(o.stitchingCharge) || 0) +
                   (Number(o.aariCharge) || 0) +
                   (Number(o.liningCharge) || 0) +
                   (Number(o.additionalCharge) || 0) -
                   (Number(o.discount) || 0);
      return sum + bill;
    }, 0);

    const totalCashCollected = orders.reduce((sum, o) => {
      const adv = Number(o.advancePaid) || 0;
      const balPaid = Number(o.balancePaid) || 0;
      return sum + adv + balPaid;
    }, 0);

    const totalCustomerPending = orders.reduce((sum, o) => {
      const bill = (Number(o.stitchingCharge) || 0) +
                   (Number(o.aariCharge) || 0) +
                   (Number(o.liningCharge) || 0) +
                   (Number(o.additionalCharge) || 0) -
                   (Number(o.discount) || 0);
      const paid = (Number(o.advancePaid) || 0) + (Number(o.balancePaid) || 0);
      return sum + Math.max(0, bill - paid);
    }, 0);

    const totalOrderSpecificExpenses = orders.reduce((sum, o) => {
      const mat = Number(o.materialExpense) || 0;
      const aariLab = Number(o.aariWorkerLabor) || 0;
      const oth = Number(o.otherExpenses) || 0;
      return sum + mat + aariLab + oth;
    }, 0);

    const generalShopExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalBusinessExpenses = totalOrderSpecificExpenses + generalShopExpenses;

    // True Earned Net Profit = Delivered/Billed Revenue - (Order Direct Costs + General Shop Costs)
    const netBusinessProfit = totalOrdersValue - totalBusinessExpenses;

    return {
      totalOrdersValue,
      totalCashCollected,
      totalCustomerPending,
      totalOrderSpecificExpenses,
      generalShopExpenses,
      totalBusinessExpenses,
      netBusinessProfit
    };
  }, [orders, expenses]);

  // --- CRUD: CUSTOMERS & MEASUREMENTS ---
  const handleSaveCustomer = async () => {
    if (!newCustomerForm.name || !newCustomerForm.phone) {
      alert("தயவுசெய்து பெயர் மற்றும் தொலைபேசி எண்ணை உள்ளிடவும்.");
      return;
    }
    const newCust = {
      id: "CUST_" + Date.now(),
      name: newCustomerForm.name,
      phone: newCustomerForm.phone,
      address: newCustomerForm.address,
      notes: newCustomerForm.notes,
      createdAt: new Date().toISOString()
    };
    await StorageService.put("customers", newCust);
    setCustomers(prev => [newCust, ...prev]);
    setNewCustomerForm({ name: "", phone: "", address: "", notes: "" });
    setIsCustomerModalOpen(false);
  };

  const handleSaveMeasurement = async () => {
    if (!selectedCustomerId) {
      alert("வாடிக்கையாளரை தேர்ந்தெடுக்கவும்.");
      return;
    }
    // Calculate version number for this garment type
    const previousVersions = measurements.filter(
      m => m.customerId === selectedCustomerId && m.garmentType === newMeasurementForm.garmentType
    );
    const versionNumber = previousVersions.length + 1;

    const newRecord = {
      id: "MEAS_" + Date.now(),
      customerId: selectedCustomerId,
      garmentType: newMeasurementForm.garmentType,
      version: versionNumber,
      unit: newMeasurementForm.unit,
      data: { ...newMeasurementForm.data },
      notes: newMeasurementForm.notes,
      designPhotoUrl: newMeasurementForm.designPhotoUrl,
      createdAt: new Date().toISOString()
    };

    await StorageService.put("measurements", newRecord);
    setMeasurements(prev => [newRecord, ...prev]);
    setIsMeasurementModalOpen(false);
    alert(`பதிவு செய்யப்பட்டது! (Version v${versionNumber} Saved)`);
  };

  // --- CRUD: ORDERS WITH ACCURATE COST ALLOCATION ---
  const handleSaveOrder = async () => {
    if (!newOrderForm.customerId || !newOrderForm.deliveryDate) {
      alert("வாடிக்கையாளர் மற்றும் டெலிவரி தேதியை குறிப்பிடவும்.");
      return;
    }

    const billAmount = (Number(newOrderForm.stitchingCharge) || 0) +
                       (Number(newOrderForm.aariCharge) || 0) +
                       (Number(newOrderForm.liningCharge) || 0) +
                       (Number(newOrderForm.additionalCharge) || 0) -
                       (Number(newOrderForm.discount) || 0);

    const directCost = (Number(newOrderForm.materialExpense) || 0) +
                       (Number(newOrderForm.aariWorkerLabor) || 0) +
                       (Number(newOrderForm.otherExpenses) || 0);

    const estimatedProfit = billAmount - directCost;

    const newOrder = {
      id: "ORD_" + Date.now(),
      ...newOrderForm,
      totalBill: billAmount,
      totalCost: directCost,
      estimatedProfit: estimatedProfit,
      balancePaid: 0,
      status: "In Progress", // In Progress, Completed, Delivered, Cancelled
      createdAt: new Date().toISOString()
    };

    await StorageService.put("orders", newOrder);
    setOrders(prev => [newOrder, ...prev]);
    setIsOrderModalOpen(false);
    alert("ஆர்டர் வெற்றிகரமாக பதிவு செய்யப்பட்டது!");
  };

  // --- BACKUP & RESTORE SAFETY WORKFLOW ---
  const executeCompleteBackup = async () => {
    try {
      const backupPayload = {
        app: "குழலி தையலகம்",
        appVersion: APP_VERSION,
        dbVersion: DB_VERSION,
        timestamp: new Date().toISOString(),
        tables: {
          customers,
          measurements,
          orders,
          expenses,
          shgRecords,
          settings
        }
      };

      const jsonStr = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const fileName = `Kuzhali_Backup_${new Date().toISOString().slice(0, 10)}.json`;

      // Download locally
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Update last backup timestamp
      const now = new Date().toLocaleString();
      await StorageService.put("settings", { key: "lastBackupDate", value: now });
      setSettings(prev => ({ ...prev, lastBackupDate: now }));

      alert("முழுமையான தரவு காப்புப்பிரதி (Backup) பதிவிறக்கம் செய்யப்பட்டது! Google Drive அல்லது மெமரி கார்டில் சேமிக்கவும்.");
    } catch (e) {
      alert("காப்புப்பிரதி எடுப்பதில் தவறு: " + e.message);
    }
  };

  const handleRestoreUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const payload = JSON.parse(evt.target.result);
        if (!payload.tables || !payload.tables.customers || !payload.tables.orders) {
          throw new Error("தவறான காப்புப்பிரதி கோப்பு அமைப்பு (Invalid Backup JSON Structure)");
        }

        const confirmRestore = window.confirm(
          "எச்சரிக்கை: தற்போதைய தரவுகள் மீட்டமைக்கப்படும். தொடர முன் பாதுகாப்பான அவசர காப்புப்பிரதி (Emergency Safety Backup) எடுக்கப்படும். தொடரலாமா?"
        );
        if (!confirmRestore) return;

        // 1. Create immediate emergency rollback snapshot in LocalStorage
        const safetyDump = {
          timestamp: new Date().toISOString(),
          tables: { customers, measurements, orders, expenses, shgRecords, settings }
        };
        localStorage.setItem("EMERGENCY_PRE_RESTORE_SNAPSHOT", JSON.stringify(safetyDump));

        // 2. Clear current DB tables
        await StorageService.clearAll();

        // 3. Inject verified records
        for (const c of payload.tables.customers) await StorageService.put("customers", c);
        for (const m of payload.tables.measurements) await StorageService.put("measurements", m);
        for (const o of payload.tables.orders) await StorageService.put("orders", o);
        for (const ex of payload.tables.expenses || []) await StorageService.put("expenses", ex);
        for (const s of payload.tables.shgRecords || []) await StorageService.put("shg_records", s);

        alert("தரவுகள் வெற்றிகரமாக மீட்டமைக்கப்பட்டன (Restore Completed Successfully)! பக்கம் புதுப்பிக்கப்படும்.");
        window.location.reload();
      } catch (err) {
        alert("மீட்டமைப்பில் பிழை: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  // --- GEMINI AI ASSISTANT DISPATCHER ---
  const sendPromptToGemini = async () => {
    if (!aiInputPrompt.trim()) return;
    if (!geminiApiKey) {
      alert("தயவுசெய்து அமைப்புகளில் உங்கள் Gemini API Key உள்ளிடவும்.");
      setActiveTab("settings");
      return;
    }

    const userText = aiInputPrompt;
    setAiChatMessages(prev => [...prev, { sender: "user", text: userText }]);
    setAiInputPrompt("");
    setAiLoading(true);

    try {
      const systemInstruction = `You are the expert tailoring and business assistant for "குழலி தையலகம்" (Owner: Tamil Selvi, Contact: 8940204536).
Answer in clear Tamil or Tanglish as preferred. Provide exact tailoring measurement formulas, blouse dart corrections, Aari work pricing calculations, or app usage steps.
Never invent customer records or financial details. Always be polite and practical for a village/town tailoring entrepreneur.`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${systemInstruction}\n\nUser Question: ${userText}` }] }]
        })
      });

      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "மன்னிக்கவும், பதிலளிக்க முடியவில்லை. API Key சரிபார்க்கவும்.";
      setAiChatMessages(prev => [...prev, { sender: "ai", text: reply }]);
    } catch (err) {
      setAiChatMessages(prev => [...prev, { sender: "ai", text: "இணைப்பில் பிழை: " + err.message }]);
    } finally {
      setAiLoading(false);
    }
  };

  // --- PIN LOCK PROTECTION SCREEN ---
  if (settings.isPinLocked && !isUnlocked) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#581c87', padding: '20px', fontFamily: 'sans-serif' }}>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '30px', maxWidth: '380px', width: '100%', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>🧵</div>
          <h2 style={{ color: '#581c87', margin: '0 0 5px' }}>{settings.shopNameTamil}</h2>
          <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>உரிமையாளர் பாதுகாப்பு PIN ஐ உள்ளிடவும்</p>
          <form onSubmit={handlePinSubmit}>
            <input
              type="password"
              maxLength="6"
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value)}
              placeholder="••••"
              style={{ width: '100%', padding: '14px', fontSize: '24px', textAlign: 'center', letterSpacing: '8px', border: '2px solid #e5e7eb', borderRadius: '8px', outline: 'none', marginBottom: '15px' }}
              autoFocus
            />
            {pinError && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>{pinError}</div>}
            <button type="submit" style={{ width: '100%', background: '#7e22ce', color: '#fff', border: 'none', padding: '14px', fontSize: '16px', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer' }}>
              திறக்கவும் (Unlock)
            </button>
          </form>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '16px' }}>இயல்புநிலை PIN: 1234</div>
        </div>
      </div>
    );
  }
  // --- MAIN APP RENDER ---
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* TOP BRANDING BAR */}
      <header style={{ background: 'linear-gradient(135deg, #6b21a8 0%, #4c1d95 100%)', color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', background: '#fff' }} />
          ) : (
            <span style={{ fontSize: '32px' }}>🪡</span>
          )}
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.3px' }}>{settings.shopNameTamil}</div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>{settings.ownerName} • 📞 {settings.contactNumber}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px' }}>v{APP_VERSION}</span>
          <button onClick={() => { setIsUnlocked(false); }} title="Lock Shop" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
            🔒 பூட்டு
          </button>
        </div>
      </header>

      {/* HORIZONTAL NAV TABS (TOUCH OPTIMIZED) */}
      <nav style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #e5e7eb', overflowX: 'auto', padding: '4px 10px' }}>
        {[
          { key: "dashboard", label: "முகப்பு (Dashboard)", icon: "📊" },
          { key: "customers", label: "வாடிக்கையாளர்கள் (Customers)", icon: "👥" },
          { key: "orders", label: "ஆர்டர்கள் (Orders)", icon: "✂️" },
          { key: "expenses", label: "செலவுகள் (Expenses)", icon: "💸" },
          { key: "reports", label: "கணக்கு அறிக்கை (Reports)", icon: "📈" },
          { key: "ai_assistant", label: "AI தையல் உதவியாளர்", icon: "🤖" },
          { key: "settings", label: "அமைப்புகள் (Settings)", icon: "⚙️" }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === t.key ? '3px solid #7e22ce' : '3px solid transparent',
              color: activeTab === t.key ? '#7e22ce' : '#4b5563',
              fontWeight: activeTab === t.key ? 'bold' : 'normal',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px'
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* WORKSPACE CONTENT BODY */}
      <main style={{ flex: 1, padding: '20px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* --- 1. DASHBOARD OVERVIEW TAB --- */}
        {activeTab === "dashboard" && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#1f2937' }}>வணிக மேலோட்டம் (Business Overview)</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setIsCustomerModalOpen(true)} style={{ background: '#7e22ce', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  + புதிய வாடிக்கையாளர்
                </button>
                <button onClick={() => setIsOrderModalOpen(true)} style={{ background: '#059669', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  + புதிய ஆர்டர்
                </button>
              </div>
            </div>

            {/* KPI STAT CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: '#fff', padding: '18px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '5px solid #7e22ce' }}>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>மொத்த ஆர்டர் மதிப்பு (Total Orders)</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginTop: '6px' }}>₹{financialAnalytics.totalOrdersValue.toLocaleString()}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{orders.length} மொத்த ஆர்டர்கள்</div>
              </div>

              <div style={{ background: '#fff', padding: '18px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '5px solid #059669' }}>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>வசூலான ரொக்கம் (Cash Collected)</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#059669', marginTop: '6px' }}>₹{financialAnalytics.totalCashCollected.toLocaleString()}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>முன்பணம் + நிலுவை வரவு</div>
              </div>

              <div style={{ background: '#fff', padding: '18px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '5px solid #dc2626' }}>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>வாடிக்கையாளர் நிலுவை (Pending Balance)</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626', marginTop: '6px' }}>₹{financialAnalytics.totalCustomerPending.toLocaleString()}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>வரவேண்டிய தொகை</div>
              </div>

              <div style={{ background: '#fff', padding: '18px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '5px solid #2563eb' }}>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>நிகர லாபம் (Net Business Profit)</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb', marginTop: '6px' }}>₹{financialAnalytics.netBusinessProfit.toLocaleString()}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>செலவுகள் கழிக்கப்பட்ட பின்</div>
              </div>
            </div>
             {/* PENDING DELIVERIES SECTION */}
            <div style={{ background: '#fff', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 16px', color: '#374151' }}>விரைவில் டெலிவரி செய்ய வேண்டியவை (Upcoming Deliveries)</h3>
              {orders.filter(o => o.status !== "Delivered").length === 0 ? (
                <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>நிலுவையில் உள்ள ஆர்டர்கள் எதுவும் இல்லை.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '10px' }}>ஆர்டர் ID</th>
                        <th style={{ padding: '10px' }}>வாடிக்கையாளர்</th>
                        <th style={{ padding: '10px' }}>வகை</th>
                        <th style={{ padding: '10px' }}>டெலிவரி தேதி</th>
                        <th style={{ padding: '10px' }}>மதிப்பு</th>
                        <th style={{ padding: '10px' }}>நிலை</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.filter(o => o.status !== "Delivered").slice(0, 5).map(o => {
                        const cust = customers.find(c => c.id === o.customerId);
                        return (
                          <tr key={o.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{o.id.slice(-6)}</td>
                            <td style={{ padding: '10px' }}>{cust ? cust.name : "Unknown"}</td>
                            <td style={{ padding: '10px' }}>{o.garmentType}</td>
                            <td style={{ padding: '10px', color: '#b91c1c', fontWeight: 'bold' }}>{o.deliveryDate}</td>
                            <td style={{ padding: '10px' }}>₹{o.totalBill}</td>
                            <td style={{ padding: '10px' }}><span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>{o.status}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          )}

        {/* --- 2. CUSTOMERS & MEASUREMENT CARDS TAB --- */}
        {activeTab === "customers" && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: '#1f2937' }}>வாடிக்கையாளர் பட்டியல் (Customer Profiles)</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => exportArrayToCSV("Kuzhali_Customers", customers)} style={{ background: '#1f2937', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  📥 Excel/CSV ஏற்றுமதி
                </button>
                <button onClick={() => setIsCustomerModalOpen(true)} style={{ background: '#7e22ce', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                  + புதிய வாடிக்கையாளர்
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selectedCustomerId ? '1fr 1.6fr' : '1fr', gap: '20px' }}>
              {/* Customer List Column */}
              <div style={{ background: '#fff', borderRadius: '8px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', maxHeight: '75vh', overflowY: 'auto' }}>
                {customers.map(c => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    style={{
                      padding: '12px',
                      borderRadius: '6px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      backgroundColor: selectedCustomerId === c.id ? '#f3e8ff' : '#f9fafb',
                      borderLeft: selectedCustomerId === c.id ? '4px solid #7e22ce' : '4px solid transparent'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', color: '#111827' }}>{c.name}</div>
                    <div style={{ fontSize: '13px', color: '#4b5563' }}>📞 {c.phone}</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{c.address || "முகவரி இல்லை"}</div>
                  </div>
                ))}
              </div>

              {/* Dedicated Customer Measurement Card */}
              {selectedCustomerId && (() => {
                const customer = customers.find(c => c.id === selectedCustomerId);
                const custMeasurements = measurements.filter(m => m.customerId === selectedCustomerId);
                return (
                  <div style={{ background: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px', marginBottom: '16px' }}>
                      <div>
                        <h3 style={{ margin: 0, color: '#7e22ce' }}>{customer?.name}</h3>
                        <div style={{ fontSize: '13px', color: '#4b5563', marginTop: '2px' }}>📞 {customer?.phone} | {customer?.address}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => {
                            const text = `வணக்கம் ${customer?.name}, குழலி தையலகத்திற்கு தங்களின் வருகைக்கு நன்றி! உங்கள் புதிய ஆடை அளவுகள் பதிவு செய்யப்பட்டுள்ளன.`;
                            window.open(`https://wa.me/91${customer?.phone}?text=${encodeURIComponent(text)}`, '_blank');
                          }}
                          style={{ background: '#25D366', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                        >
                          WhatsApp
                        </button>
                        <button
                          onClick={() => setIsMeasurementModalOpen(true)}
                          style={{ background: '#7e22ce', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                        >
                          + புதிய அளவு சேர்
                        </button>
                      </div>
                    </div>

                    <h4 style={{ margin: '0 0 10px', color: '#374151' }}>அளவு வரலாறு (Measurement History)</h4>
                    {custMeasurements.length === 0 ? (
                      <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>அளவுகள் எதுவும் இதுவரை பதிவு செய்யப்படவில்லை.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {custMeasurements.map(m => (
                          <div key={m.id} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span style={{ fontWeight: 'bold', color: '#111827' }}>{m.garmentType} (Version {m.version})</span>
                              <span style={{ fontSize: '12px', color: '#6b7280' }}>{new Date(m.createdAt).toLocaleDateString()} ({m.unit})</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', fontSize: '12px', background: '#f9fafb', padding: '10px', borderRadius: '4px' }}>
                              {Object.entries(m.data || {}).map(([key, val]) => (
                                <div key={key}>
                                  <span style={{ color: '#6b7280', textTransform: 'capitalize' }}>{key}: </span>
                                  <span style={{ fontWeight: 'bold' }}>{val || "-"}</span>
                                </div>
                              ))}
                            </div>
                            {m.notes && <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '6px' }}>குறிப்பு: {m.notes}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        {/* --- 3. ORDERS & PROFIT AUDITING TAB --- */}
        {activeTab === "orders" && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: '#1f2937' }}>தையல் ஆர்டர்கள் & லாப விவரங்கள் (Orders & Profit Audit)</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => exportArrayToCSV("Kuzhali_Orders", orders)} style={{ background: '#1f2937', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  📥 Excel/CSV ஏற்றுமதி
                </button>
                <button onClick={() => setIsOrderModalOpen(true)} style={{ background: '#059669', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                  + புதிய ஆர்டர்
                </button>
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '10px' }}>ஆர்டர் ID</th>
                    <th style={{ padding: '10px' }}>வாடிக்கையாளர்</th>
                    <th style={{ padding: '10px' }}>ஆடை</th>
                    <th style={{ padding: '10px' }}>பில் தொகை</th>
                    <th style={{ padding: '10px' }}>முன்பணம்</th>
                    <th style={{ padding: '10px' }}>நிலுவை</th>
                    <th style={{ padding: '10px' }}>உண்மை அடக்கச் செலவு</th>
                    <th style={{ padding: '10px' }}>நிகர லாபம்</th>
                    <th style={{ padding: '10px' }}>ரசீது / நடவடிக்கை</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const cust = customers.find(c => c.id === o.customerId);
                    const bal = Math.max(0, o.totalBill - ((Number(o.advancePaid) || 0) + (Number(o.balancePaid) || 0)));
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px', fontWeight: 'bold' }}>{o.id.slice(-6)}</td>
                        <td style={{ padding: '10px' }}>{cust ? cust.name : "Unknown"}</td>
                        <td style={{ padding: '10px' }}>{o.garmentType}</td>
                        <td style={{ padding: '10px', fontWeight: 'bold' }}>₹{o.totalBill}</td>
                        <td style={{ padding: '10px', color: '#059669' }}>₹{o.advancePaid}</td>
                        <td style={{ padding: '10px', color: bal > 0 ? '#dc2626' : '#4b5563', fontWeight: bal > 0 ? 'bold' : 'normal' }}>
                          ₹{bal}
                        </td>
                        <td style={{ padding: '10px', color: '#6b7280' }}>₹{o.totalCost}</td>
                        <td style={{ padding: '10px', color: '#2563eb', fontWeight: 'bold' }}>₹{o.estimatedProfit}</td>
                        <td style={{ padding: '10px' }}>
                          <button
                            onClick={() => setSelectedOrderForBill(o)}
                            style={{ background: '#7e22ce', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                          >
                            🖨️ பில்
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
          {/* --- 4. EXPENSES TRACKER TAB --- */}
        {activeTab === "expenses" && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: '#1f2937' }}>பொதுக் கடைச் செலவுகள் (General Shop Expenses)</h2>
              <button
                onClick={async () => {
                  const desc = prompt("செலவு விவரம் (Expense description):");
                  const amt = prompt("தொகை (Amount in ₹):");
                  if (desc && amt) {
                    const newEx = {
                      id: "EXP_" + Date.now(),
                      description: desc,
                      amount: Number(amt) || 0,
                      date: new Date().toISOString()
                    };
                    await StorageService.put("expenses", newEx);
                    setExpenses(prev => [newEx, ...prev]);
                  }
                }}
                style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                + புதிய செலவு சேர்
              </button>
            </div>

            <div style={{ background: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              {expenses.length === 0 ? (
                <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>செலவுப் பதிவுகள் எதுவும் இல்லை.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '10px' }}>தேதி</th>
                      <th style={{ padding: '10px' }}>விவரம்</th>
                      <th style={{ padding: '10px' }}>தொகை</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(e => (
                      <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px' }}>{new Date(e.date).toLocaleDateString()}</td>
                        <td style={{ padding: '10px' }}>{e.description}</td>
                        <td style={{ padding: '10px', color: '#dc2626', fontWeight: 'bold' }}>₹{e.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
         {/* --- 5. FINANCIAL REPORTS & AUDIT STATEMENT --- */}
        {activeTab === "reports" && (
          <div style={{ background: '#fff', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 16px', color: '#1f2937' }}>முறையான வணிக கணக்காய்வு அறிக்கை (Audit Statement)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              <div style={{ border: '1px solid #e5e7eb', padding: '16px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 12px', color: '#059669' }}>வருவாய் விவரங்கள் (Revenue Breakdown)</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>மொத்த ஆர்டர் பில் மதிப்பு:</span>
                  <span style={{ fontWeight: 'bold' }}>₹{financialAnalytics.totalOrdersValue}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>நேரடி ரொக்க வசூல்:</span>
                  <span style={{ fontWeight: 'bold', color: '#059669' }}>₹{financialAnalytics.totalCashCollected}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>வசூலாக வேண்டிய நிலுவை:</span>
                  <span style={{ fontWeight: 'bold', color: '#dc2626' }}>₹{financialAnalytics.totalCustomerPending}</span>
                </div>
              </div>

              <div style={{ border: '1px solid #e5e7eb', padding: '16px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 12px', color: '#dc2626' }}>செலவு விவரங்கள் (Expense Breakdown)</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>ஆர்டர் நேரடி செலவுகள் (Lining/Aari):</span>
                  <span style={{ fontWeight: 'bold' }}>₹{financialAnalytics.totalOrderSpecificExpenses}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>பொது கடைச் செலவுகள்:</span>
                  <span style={{ fontWeight: 'bold' }}>₹{financialAnalytics.generalShopExpenses}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: '8px' }}>
                  <span>மொத்த வணிகச் செலவு:</span>
                  <span style={{ fontWeight: 'bold', color: '#dc2626' }}>₹{financialAnalytics.totalBusinessExpenses}</span>
                </div>
              </div>
            </div>

            <div style={{ background: '#f5f3ff', padding: '18px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '16px', color: '#6b21a8' }}>உண்மை நிகர லாபம் (True Net Profit)</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#581c87', marginTop: '6px' }}>₹{financialAnalytics.netBusinessProfit}</div>
              <div style={{ fontSize: '12px', color: '#7c3aed', marginTop: '4px' }}>(மொத்த ஆர்டர் பில் மதிப்பு - நேரடி & கடை செலவுகள்)</div>
            </div>
          </div>
        )}
          {/* --- 6. GEMINI TAILORING AI ASSISTANT --- */}
        {activeTab === "ai_assistant" && (
          <div style={{ background: '#fff', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', height: '70vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 12px', color: '#7e22ce' }}>🤖 குழலி தையலக AI உதவியாளர்</h3>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', background: '#f9fafb', borderRadius: '8px', marginBottom: '16px' }}>
              {aiChatMessages.map((msg, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start', marginBottom: '12px' }}>
                  <div style={{
                    maxWidth: '80%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    background: msg.sender === 'user' ? '#7e22ce' : '#fff',
                    color: msg.sender === 'user' ? '#fff' : '#111827',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {aiLoading && <div style={{ fontSize: '13px', color: '#9ca3af' }}>AI பதிலளிக்கிறது...</div>}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={aiInputPrompt}
                onChange={(e) => setAiInputPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendPromptToGemini()}
                placeholder="எ.கா. 36 மார்பளவு பிளவுஸ் ஆர்ம்ஹோல் வெட்டும் முறை என்ன?"
                style={{ flex: 1, padding: '12px', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none' }}
              />
              <button
                onClick={sendPromptToGemini}
                disabled={aiLoading}
                style={{ background: '#7e22ce', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                கேள்
              </button>
            </div>
          </div>
        )}
          {/* --- 7. SHOP SETTINGS & GOOGLE DRIVE BACKUP SYSTEM --- */}
        {activeTab === "settings" && (
          <div style={{ background: '#fff', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 20px', color: '#1f2937' }}>கடை அமைப்புகள் & தரவு பாதுகாப்பு (Settings & Backup)</h2>

            {/* Shop Identity Form */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>கடை பெயர் (தமிழ்)</label>
                <input
                  type="text"
                  value={settings.shopNameTamil}
                  onChange={(e) => setSettings({ ...settings, shopNameTamil: e.target.value })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', marginTop: '4px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>தையலர் பெயர் (Owner Name)</label>
                <input
                  type="text"
                  value={settings.ownerName}
                  onChange={(e) => setSettings({ ...settings, ownerName: e.target.value })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', marginTop: '4px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>தொடர்பு எண் (Phone)</label>
                <input
                  type="text"
                  value={settings.contactNumber}
                  onChange={(e) => setSettings({ ...settings, contactNumber: e.target.value })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', marginTop: '4px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>முகவரி (Address)</label>
                <input
                  type="text"
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', marginTop: '4px' }}
                />
              </div>
            </div>

            {/* Google Drive & Local Backup Console */}
            <div style={{ border: '2px dashed #7e22ce', borderRadius: '8px', padding: '20px', background: '#faf5ff', marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 10px', color: '#581c87' }}>☁️ Google Drive & உள்ளூர் காப்புப்பிரதி (Backup & Restore)</h3>
              <p style={{ fontSize: '13px', color: '#6b21a8', margin: '0 0 16px' }}>
                கடைசி காப்புப்பிரதி: <strong>{settings.lastBackupDate || "இன்னும் எடுக்கப்படவில்லை"}</strong>
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <button
                  onClick={executeCompleteBackup}
                  style={{ background: '#7e22ce', color: '#fff', border: 'none', padding: '12px 18px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  📥 புதிய Backup எடுக்கவும் (Export JSON)
                </button>
                <label style={{ background: '#059669', color: '#fff', padding: '12px 18px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                  📤 Backup மீட்டமைக்க (Restore)
                  <input type="file" accept=".json" onChange={handleRestoreUpload} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            {/* Security PIN & Gemini Key Config */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>பாதுகாப்பு PIN எண்</label>
                <input
                  type="password"
                  maxLength="6"
                  value={settings.ownerPin}
                  onChange={(e) => setSettings({ ...settings, ownerPin: e.target.value })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', marginTop: '4px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>Gemini API Key</label>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => {
                    setGeminiApiKey(e.target.value);
                    localStorage.setItem("GEMINI_KEY", e.target.value);
                  }}
                  placeholder="AIzaSy..."
                  style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', marginTop: '4px' }}
                />
              </div>
            </div>

            <button
              onClick={async () => {
                for (const [k, v] of Object.entries(settings)) {
                  await StorageService.put("settings", { key: k, value: v });
                }
                alert("அமைப்புகள் வெற்றிகரமாக சேமிக்கப்பட்டன!");
              }}
              style={{ marginTop: '20px', background: '#111827', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              அமைப்புகளை சேமிக்கவும் (Save Settings)
            </button>
          </div>
        )}
      </main>
        {/* --- MODAL: NEW CUSTOMER --- */}
      {isCustomerModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '10px', padding: '24px', maxWidth: '420px', width: '100%' }}>
            <h3 style={{ margin: '0 0 16px', color: '#7e22ce' }}>புதிய வாடிக்கையாளர் பதிவு</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                placeholder="பெயர் (Customer Name)"
                value={newCustomerForm.name}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
              />
              <input
                type="tel"
                placeholder="தொலைபேசி எண் (Phone 10-digits)"
                value={newCustomerForm.phone}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
              />
              <textarea
                placeholder="முகவரி (Address)"
                value={newCustomerForm.address}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', height: '60px' }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button onClick={() => setIsCustomerModalOpen(false)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff' }}>ரத்து</button>
                <button onClick={handleSaveCustomer} style={{ flex: 1, padding: '10px', background: '#7e22ce', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>சேமி</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: NEW MEASUREMENT ENTRY --- */}
      {isMeasurementModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '10px', padding: '24px', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', color: '#7e22ce' }}>புதிய அளவு விவரங்கள் (New Measurement)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={newMeasurementForm.garmentType}
                  onChange={(e) => setNewMeasurementForm({ ...newMeasurementForm, garmentType: e.target.value })}
                  style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                >
                  <option value="Blouse">பிளவுஸ் (Blouse)</option>
                  <option value="Churidar">சுடிதார் (Churidar)</option>
                  <option value="Kurti">குர்தி (Kurti)</option>
                  <option value="Salwar">சல்வார் (Salwar)</option>
                  <option value="Kids Frock">குழந்தை பிராக் (Kids Frock)</option>
                  <option value="Gown">கவுன் (Gown)</option>
                </select>
                <select
                  value={newMeasurementForm.unit}
                  onChange={(e) => setNewMeasurementForm({ ...newMeasurementForm, unit: e.target.value })}
                  style={{ width: '100px', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                >
                  <option value="inches">அங்குலம் (Inches)</option>
                  <option value="cm">செ.மீ (Centimeters)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {Object.keys(newMeasurementForm.data).map(field => (
                  <div key={field}>
                    <label style={{ fontSize: '11px', color: '#4b5563', textTransform: 'capitalize' }}>{field}</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={newMeasurementForm.data[field]}
                      onChange={(e) => setNewMeasurementForm({
                        ...newMeasurementForm,
                        data: { ...newMeasurementForm.data, [field]: e.target.value }
                      })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                    />
                  </div>
                ))}
              </div>

              <input
                type="text"
                placeholder="மாதிரி/டிசைன் குறிப்பு"
                value={newMeasurementForm.notes}
                onChange={(e) => setNewMeasurementForm({ ...newMeasurementForm, notes: e.target.value })}
                style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button onClick={() => setIsMeasurementModalOpen(false)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff' }}>ரத்து</button>
                <button onClick={handleSaveMeasurement} style={{ flex: 1, padding: '10px', background: '#7e22ce', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>சேமிக்கவும்</button>
              </div>
            </div>
          </div>
        </div>
      )}

       {/* --- MODAL: NEW ORDER WITH PROFIT CALCULATION --- */}
      {isOrderModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '10px', padding: '24px', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', color: '#059669' }}>புதிய ஆர்டர் & லாபக் கணக்கு</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <select
                value={newOrderForm.customerId}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, customerId: e.target.value })}
                style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
              >
                <option value="">வாடிக்கையாளரை தேர்ந்தெடுக்கவும்...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>)}
              </select>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#4b5563' }}>ஆடை வகை</label>
                  <select
                    value={newOrderForm.garmentType}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, garmentType: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  >
                    <option value="Blouse">Blouse</option>
                    <option value="Churidar">Churidar</option>
                    <option value="Kurti">Kurti</option>
                    <option value="Salwar">Salwar</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#4b5563' }}>டெலிவரி தேதி</label>
                  <input
                    type="date"
                    value={newOrderForm.deliveryDate}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, deliveryDate: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  />
                </div>
              </div>

              {/* Bill Details */}
              <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>வாடிக்கையாளர் பில் விபரம் (Customer Charges)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    type="number"
                    placeholder="தையல் கூலி"
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, stitchingCharge: Number(e.target.value) })}
                    style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  />
                  <input
                    type="number"
                    placeholder="ஆரி/எம்பிராய்டரி கட்டணம்"
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, aariCharge: Number(e.target.value) })}
                    style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  />
                  <input
                    type="number"
                    placeholder="லைனிங்/துணி கட்டணம்"
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, liningCharge: Number(e.target.value) })}
                    style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  />
                  <input
                    type="number"
                    placeholder="முன்பணம் (Advance Paid)"
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, advancePaid: Number(e.target.value) })}
                    style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  />
                </div>
              </div>
                {/* Direct Expenses */}
              <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#991b1b', marginBottom: '8px' }}>உண்மை அடக்கச் செலவு (Direct Expenses)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    type="number"
                    placeholder="லைனிங் துணி வாங்கிய விலை"
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, materialExpense: Number(e.target.value) })}
                    style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  />
                  <input
                    type="number"
                    placeholder="ஆரி தொழிலாளி கூலி"
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, aariWorkerLabor: Number(e.target.value) })}
                    style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button onClick={() => setIsOrderModalOpen(false)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff' }}>ரத்து</button>
                <button onClick={handleSaveOrder} style={{ flex: 1, padding: '10px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>ஆர்டர் சேமி</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: PRINTABLE RECEIPT BILL --- */}
      {selectedOrderForBill && (() => {
        const cust = customers.find(c => c.id === selectedOrderForBill.customerId);
        const bal = Math.max(0, selectedOrderForBill.totalBill - ((Number(selectedOrderForBill.advancePaid) || 0) + (Number(selectedOrderForBill.balancePaid) || 0)));
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#fff', padding: '30px', maxWidth: '400px', width: '100%', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #9ca3af', paddingBottom: '12px', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, color: '#6b21a8' }}>{settings.shopNameTamil}</h3>
                <div style={{ fontSize: '12px', color: '#4b5563' }}>{settings.ownerName} • 📞 {settings.contactNumber}</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>{settings.address}</div>
              </div>

              <div style={{ fontSize: '13px', marginBottom: '12px' }}>
                <div><strong>வாடிக்கையாளர்:</strong> {cust?.name} (📞 {cust?.phone})</div>
                <div><strong>ஆர்டர் எண்:</strong> {selectedOrderForBill.id.slice(-6)}</div>
                <div><strong>டெலிவரி தேதி:</strong> {selectedOrderForBill.deliveryDate}</div>
              </div>

              <div style={{ borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '8px 0', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>{selectedOrderForBill.garmentType} தையல் கூலி:</span>
                  <span>₹{selectedOrderForBill.stitchingCharge}</span>
                </div>
                {selectedOrderForBill.aariCharge > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>ஆரி / எம்பிராய்டரி:</span>
                    <span>₹{selectedOrderForBill.aariCharge}</span>
                  </div>
                )}
                {selectedOrderForBill.liningCharge > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>லைனிங் துணி:</span>
                    <span>₹{selectedOrderForBill.liningCharge}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '6px', borderTop: '1px dashed #d1d5db', paddingTop: '4px' }}>
                  <span>மொத்த பில்:</span>
                  <span>₹{selectedOrderForBill.totalBill}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', marginTop: '2px' }}>
                  <span>செலுத்திய முன்பணம்:</span>
                  <span>₹{selectedOrderForBill.advancePaid}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: 'bold', marginTop: '2px' }}>
                  <span>மீதமுள்ள நிலுவை:</span>
                  <span>₹{bal}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
                <button onClick={() => setSelectedOrderForBill(null)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff' }}>மூடு</button>
                <button onClick={() => window.print()} style={{ flex: 1, padding: '10px', background: '#7e22ce', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>🖨️ பிரிண்ட்</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
