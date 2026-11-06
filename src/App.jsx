import React, { useState, useEffect, useMemo } from 'react';

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
  ownerPin: "1234",
  isPinLocked: false,
  lastBackupDate: null,
  currencySymbol: "₹",
  language: "ta"
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
    '\uFEFF' +
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
export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [settings, setSettings] = useState(INITIAL_SHOP_CONFIG);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState("");

  const [customers, setCustomers] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isMeasurementModalOpen, setIsMeasurementModalOpen] = useState(false);
  const [selectedOrderForBill, setSelectedOrderForBill] = useState(null);

  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem("GEMINI_KEY") || "");
  const [aiChatMessages, setAiChatMessages] = useState([
    { sender: "ai", text: "வணக்கம்! நான் உங்கள் குழலி தையலக AI உதவியாளர். ஆடை அளவுகள், வெட்டும் முறைகள் அல்லது கணக்கு விபரங்கள் பற்றி நீங்கள் கேட்கலாம்." }
  ]);
  const [aiInputPrompt, setAiInputPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [newCustomerForm, setNewCustomerForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [newMeasurementForm, setNewMeasurementForm] = useState({
    garmentType: "Blouse",
    unit: "inches",
    notes: "",
    data: { length: "", chest: "", waist: "", shoulder: "", sleeveLength: "", sleeveLoose: "", frontNeck: "", backNeck: "", armHole: "" }
  });

  const [newOrderForm, setNewOrderForm] = useState({
    customerId: "",
    garmentType: "Blouse",
    deliveryDate: "",
    stitchingCharge: 0,
    aariCharge: 0,
    liningCharge: 0,
    additionalCharge: 0,
    discount: 0,
    advancePaid: 0,
    materialExpense: 0,
    aariWorkerLabor: 0,
    otherExpenses: 0
  });

  useEffect(() => {
    async function loadAllData() {
      try {
        const storedSettings = await StorageService.getAll("settings");
        if (storedSettings.length > 0) {
          const cfg = storedSettings.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
          setSettings(prev => ({ ...prev, ...cfg }));
          if (!cfg.isPinLocked) setIsUnlocked(true);
        } else {
          Object.entries(INITIAL_SHOP_CONFIG).forEach(([k, v]) => {
            StorageService.put("settings", { key: k, value: v });
          });
          setIsUnlocked(true);
        }

        const [cList, mList, oList, eList] = await Promise.all([
          StorageService.getAll("customers"),
          StorageService.getAll("measurements"),
          StorageService.getAll("orders"),
          StorageService.getAll("expenses")
        ]);

        setCustomers(cList);
        setMeasurements(mList);
        setOrders(oList);
        setExpenses(eList);
      } catch (err) {
        console.error("DB Error:", err);
      }
    }
    loadAllData();
  }, []);

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

  const financialAnalytics = useMemo(() => {
    const totalOrdersValue = orders.reduce((sum, o) => {
      const bill = (Number(o.stitchingCharge) || 0) + (Number(o.aariCharge) || 0) + (Number(o.liningCharge) || 0) + (Number(o.additionalCharge) || 0) - (Number(o.discount) || 0);
      return sum + bill;
    }, 0);

    const totalCashCollected = orders.reduce((sum, o) => sum + (Number(o.advancePaid) || 0) + (Number(o.balancePaid) || 0), 0);
    const totalCustomerPending = orders.reduce((sum, o) => {
      const bill = (Number(o.stitchingCharge) || 0) + (Number(o.aariCharge) || 0) + (Number(o.liningCharge) || 0) + (Number(o.additionalCharge) || 0) - (Number(o.discount) || 0);
      const paid = (Number(o.advancePaid) || 0) + (Number(o.balancePaid) || 0);
      return sum + Math.max(0, bill - paid);
    }, 0);

    const totalOrderSpecificExpenses = orders.reduce((sum, o) => sum + (Number(o.materialExpense) || 0) + (Number(o.aariWorkerLabor) || 0) + (Number(o.otherExpenses) || 0), 0);
    const generalShopExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalBusinessExpenses = totalOrderSpecificExpenses + generalShopExpenses;
    const netBusinessProfit = totalOrdersValue - totalBusinessExpenses;

    return { totalOrdersValue, totalCashCollected, totalCustomerPending, totalBusinessExpenses, netBusinessProfit };
  }, [orders, expenses]);

  const handleSaveCustomer = async () => {
    if (!newCustomerForm.name || !newCustomerForm.phone) return alert("பெயர் மற்றும் போன் நம்பர் உள்ளிடவும்.");
    const newCust = { id: "CUST_" + Date.now(), ...newCustomerForm, createdAt: new Date().toISOString() };
    await StorageService.put("customers", newCust);
    setCustomers(prev => [newCust, ...prev]);
    setNewCustomerForm({ name: "", phone: "", address: "", notes: "" });
    setIsCustomerModalOpen(false);
  };

  const handleSaveMeasurement = async () => {
    if (!selectedCustomerId) return alert("வாடிக்கையாளரை தேர்ந்தெடுக்கவும்.");
    const prev = measurements.filter(m => m.customerId === selectedCustomerId && m.garmentType === newMeasurementForm.garmentType);
    const newRecord = {
      id: "MEAS_" + Date.now(),
      customerId: selectedCustomerId,
      garmentType: newMeasurementForm.garmentType,
      version: prev.length + 1,
      unit: newMeasurementForm.unit,
      data: { ...newMeasurementForm.data },
      notes: newMeasurementForm.notes,
      createdAt: new Date().toISOString()
    };
    await StorageService.put("measurements", newRecord);
    setMeasurements(prev => [newRecord, ...prev]);
    setIsMeasurementModalOpen(false);
    alert(`அளவு பதிவு செய்யப்பட்டது! (Version v${newRecord.version})`);
  };

  const handleSaveOrder = async () => {
    if (!newOrderForm.customerId || !newOrderForm.deliveryDate) return alert("வாடிக்கையாளர் & டெலிவரி தேதி தேவை.");
    const billAmount = (Number(newOrderForm.stitchingCharge) || 0) + (Number(newOrderForm.aariCharge) || 0) + (Number(newOrderForm.liningCharge) || 0) + (Number(newOrderForm.additionalCharge) || 0) - (Number(newOrderForm.discount) || 0);
    const directCost = (Number(newOrderForm.materialExpense) || 0) + (Number(newOrderForm.aariWorkerLabor) || 0) + (Number(newOrderForm.otherExpenses) || 0);

    const newOrder = {
      id: "ORD_" + Date.now(),
      ...newOrderForm,
      totalBill: billAmount,
      totalCost: directCost,
      estimatedProfit: billAmount - directCost,
      balancePaid: 0,
      status: "In Progress",
      createdAt: new Date().toISOString()
    };

    await StorageService.put("orders", newOrder);
    setOrders(prev => [newOrder, ...prev]);
    setIsOrderModalOpen(false);
    alert("ஆர்டர் பதிவு செய்யப்பட்டது!");
  };

  const executeCompleteBackup = async () => {
    const backupPayload = { app: "குழலி தையலகம்", appVersion: APP_VERSION, timestamp: new Date().toISOString(), tables: { customers, measurements, orders, expenses, settings } };
    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Kuzhali_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const sendPromptToGemini = async () => {
    if (!aiInputPrompt.trim() || !geminiApiKey) return alert("API Key தேவை.");
    const userText = aiInputPrompt;
    setAiChatMessages(prev => [...prev, { sender: "user", text: userText }]);
    setAiInputPrompt("");
    setAiLoading(true);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `Answer in Tamil: ${userText}` }] }] })
      });
      const data = await res.json();
      setAiChatMessages(prev => [...prev, { sender: "ai", text: data?.candidates?.[0]?.content?.parts?.[0]?.text || "பதிலளிக்க முடியவில்லை." }]);
    } catch (err) {
      setAiChatMessages(prev => [...prev, { sender: "ai", text: "பிழை: " + err.message }]);
    } finally {
      setAiLoading(false);
    }
  };

  if (settings.isPinLocked && !isUnlocked) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#581c87', padding: '20px', fontFamily: 'sans-serif' }}>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '30px', maxWidth: '380px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>🧵</div>
          <h2 style={{ color: '#581c87', margin: '0 0 5px' }}>{settings.shopNameTamil}</h2>
          <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>பாதுகாப்பு PIN ஐ உள்ளிடவும்</p>
          <form onSubmit={handlePinSubmit}>
            <input type="password" maxLength="6" value={enteredPin} onChange={(e) => setEnteredPin(e.target.value)} placeholder="••••" style={{ width: '100%', padding: '14px', fontSize: '24px', textAlign: 'center', letterSpacing: '8px', border: '2px solid #e5e7eb', borderRadius: '8px', marginBottom: '15px', boxSizing: 'border-box' }} autoFocus />
            {pinError && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>{pinError}</div>}
            <button type="submit" style={{ width: '100%', background: '#7e22ce', color: '#fff', border: 'none', padding: '14px', fontSize: '16px', fontWeight: 'bold', borderRadius: '8px' }}>திறக்கவும்</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ background: 'linear-gradient(135deg, #6b21a8 0%, #4c1d95 100%)', color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '32px' }}>🪡</span>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{settings.shopNameTamil}</div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>{settings.ownerName} • 📞 {settings.contactNumber}</div>
          </div>
        </div>
        <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px' }}>v{APP_VERSION}</span>
      </header>

      <nav style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #e5e7eb', overflowX: 'auto', padding: '4px 10px' }}>
        {[
          { key: "dashboard", label: "முகப்பு", icon: "📊" },
          { key: "customers", label: "வாடிக்கையாளர்கள்", icon: "👥" },
          { key: "orders", label: "ஆர்டர்கள்", icon: "✂️" },
          { key: "expenses", label: "செலவுகள்", icon: "💸" },
          { key: "reports", label: "அறிக்கை", icon: "📈" },
          { key: "ai_assistant", label: "AI உதவியாளர்", icon: "🤖" },
          { key: "settings", label: "அமைப்புகள்", icon: "⚙️" }
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: '12px 14px', border: 'none', background: 'transparent', borderBottom: activeTab === t.key ? '3px solid #7e22ce' : '3px solid transparent', color: activeTab === t.key ? '#7e22ce' : '#4b5563', fontWeight: activeTab === t.key ? 'bold' : 'normal', whiteSpace: 'nowrap', cursor: 'pointer' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      <main style={{ flex: 1, padding: '16px', maxWidth: '1000px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {activeTab === "dashboard" && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', borderLeft: '5px solid #7e22ce', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>மொத்த ஆர்டர்கள்</div>
                <div style={{ fontSize: '22px', fontWeight: 'bold' }}>₹{financialAnalytics.totalOrdersValue}</div>
              </div>
              <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', borderLeft: '5px solid #059669', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>வசூலான ரொக்கம்</div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#059669' }}>₹{financialAnalytics.totalCashCollected}</div>
              </div>
              <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', borderLeft: '5px solid #dc2626', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>வாடிக்கையாளர் நிலுவை</div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#dc2626' }}>₹{financialAnalytics.totalCustomerPending}</div>
              </div>
              <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', borderLeft: '5px solid #2563eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>நிகர லாபம்</div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2563eb' }}>₹{financialAnalytics.netBusinessProfit}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsCustomerModalOpen(true)} style={{ flex: 1, padding: '12px', background: '#7e22ce', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>+ புதிய வாடிக்கையாளர்</button>
              <button onClick={() => setIsOrderModalOpen(true)} style={{ flex: 1, padding: '12px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>+ புதிய ஆர்டர்</button>
            </div>
          </div>
        )}

        {activeTab === "customers" && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3>வாடிக்கையாளர்கள் ({customers.length})</h3>
              <button onClick={() => exportArrayToCSV("Customers", customers)} style={{ padding: '6px 12px', background: '#111827', color: '#fff', border: 'none', borderRadius: '4px' }}>Excel CSV</button>
            </div>
            {customers.map(c => (
              <div key={c.id} onClick={() => setSelectedCustomerId(c.id)} style={{ background: '#fff', padding: '12px', borderRadius: '6px', marginBottom: '8px', border: selectedCustomerId === c.id ? '2px solid #7e22ce' : '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 'bold' }}>{c.name} - 📞 {c.phone}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{c.address}</div>
              </div>
            ))}
            {selectedCustomerId && (
              <button onClick={() => setIsMeasurementModalOpen(true)} style={{ width: '100%', marginTop: '10px', padding: '10px', background: '#7e22ce', color: '#fff', border: 'none', borderRadius: '6px' }}>+ இந்த வாடிக்கையாளருக்கு அளவு சேர்</button>
            )}
          </div>
        )}

        {activeTab === "orders" && (
          <div>
            <h3>ஆர்டர்கள் ({orders.length})</h3>
            {orders.map(o => (
              <div key={o.id} style={{ background: '#fff', padding: '12px', borderRadius: '6px', marginBottom: 
