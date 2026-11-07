import React, { useState, useEffect, useMemo } from 'react';

// --- APPLICATION CONSTANTS & VERSIONING ---
const APP_VERSION = "2.2.0";
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
          { name: "settings", key: "key" }
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
    const stores = ["customers", "measurements", "orders", "expenses"];
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

  // Gemini AI Chat & Image States
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem("GEMINI_KEY") || "");
  const [aiChatMessages, setAiChatMessages] = useState([
    { sender: "ai", text: "வணக்கம்! நான் உங்கள் குழலி தையலக AI உதவியாளர். தையல் அளவுகள், வெட்டும் முறைகள் அல்லது தையல் மிஷின் பழுது/சிக்கல் படங்களை அப்லோட் செய்து நீங்கள் விளக்கம் கேட்கலாம்." }
  ]);
  const [aiInputPrompt, setAiInputPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiImageBase64, setAiImageBase64] = useState(null);
  const [aiImagePreview, setAiImagePreview] = useState(null);

  // Form States
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

  // Load IndexedDB Data
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
        console.error("DB Initialization Error:", err);
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

  // --- PHOTO HANDLER FOR SEWING MACHINE & DESIGNS ---
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setAiImagePreview(reader.result);
      const base64Data = reader.result.split(',')[1];
      setAiImageBase64({
        inlineData: {
          data: base64Data,
          mimeType: file.type || "image/jpeg"
        }
      });
    };
    reader.readAsDataURL(file);
  };

  // --- GEMINI 3.8 FLASH DISPATCHER ---
  const sendPromptToGemini = async () => {
    if (!aiInputPrompt.trim() && !aiImageBase64) return;
    
    const currentKey = geminiApiKey || localStorage.getItem("GEMINI_KEY") || "";
    if (!currentKey.trim()) {
      alert("தயவுசெய்து அமைப்புகள் (Settings) பக்கத்தில் உங்கள் Gemini API Key-ஐ உள்ளிடவும்.");
      return;
    }

    const userText = aiInputPrompt || "இந்த படத்தில் உள்ள தையல் / மிஷின் பிரச்சனையைப் பார்த்து எளிய தமிழில் தீர்வு சொல்லுங்கள்.";
    setAiChatMessages(prev => [
      ...prev, 
      { sender: "user", text: userText, image: aiImagePreview }
    ]);
    
    const imagePayload = aiImageBase64;
    setAiInputPrompt("");
    setAiImageBase64(null);
    setAiImagePreview(null);
    setAiLoading(true);

    try {
      const cleanKey = currentKey.trim();
      // கட்டாயமாக்கப்பட்ட புதிய gemini-3.8-flash மாடல்
      const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

      const parts = [];
      if (imagePayload) {
        parts.push(imagePayload);
      }
      parts.push({
        text: `நீங்கள் 'குழலி தையலகம்' (உரிமையாளர்: தமிழ் செல்வி) கடையின் தையல் மற்றும் தையல் மிஷின் நிபுணர். 
தையல் மிஷினில் நூல் அறுதல், லூப் தையல், டென்ஷன் பிரச்சனை, ஊசி மாற்றும் முறை, பிளவுஸ் வெட்டும் கணக்குகள் போன்றவற்றிற்கு எளிய, நேரடியான நடைமுறைத் தீர்வுகளை தமிழில் தரவும்.\n\nகேள்வி: ${userText}`
      });

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": cleanKey
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts }]
        })
      });

      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error.message || "API பிழை");
      }

      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) {
        throw new Error("பதில் வரவில்லை");
      }

      setAiChatMessages(prev => [...prev, { sender: "ai", text: reply }]);
    } catch (err) {
      console.error(err);
      setAiChatMessages(prev => [
        ...prev,
        { sender: "ai", text: `மன்னிக்கவும், பிழை ஏற்பட்டது (${err.message}). API Key சரியாக உள்ளதா என சரிபார்க்கவும்.` }
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  // PIN Lock Screen
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
      {/* HEADER */}
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

      {/* NAVIGATION BAR */}
      <nav style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #e5e7eb', overflowX: 'auto', padding: '4px 10px' }}>
        {[
          { key: "dashboard", label: "முகப்பு", icon: "📊" },
          { key: "customers", label: "வாடிக்கையாளர்கள்", icon: "👥" },
          { key: "orders", label: "ஆர்டர்கள்", icon: "✂️" },
          { key: "expenses", label: "செலவுகள்", icon: "💸" },
          { key: "ai_assistant", label: "AI உதவியாளர்", icon: "🤖" },
          { key: "settings", label: "அமைப்புகள்", icon: "⚙️" }
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: '12px 14px', border: 'none', background: 'transparent', borderBottom: activeTab === t.key ? '3px solid #7e22ce' : '3px solid transparent', color: activeTab === t.key ? '#7e22ce' : '#4b5563', fontWeight: activeTab === t.key ? 'bold' : 'normal', whiteSpace: 'nowrap', cursor: 'pointer' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      {/* MAIN CONTAINER */}
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
 <button onClick={() => setIsCustomerModalOpen(true)} style={{ flex: 1, padding: '12px', background: '#7e22ce', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>+ புதிய வாடிக்கையாளர்</button>
              <button onClick={() => setIsOrderModalOpen(true)} style={{ flex: 1, padding: '12px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>+ புதிய ஆர்டர்</button>
            </div>
          </div>
        )}

        {activeTab === "customers" && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3>வாடிக்கையாளர்கள் ({customers.length})</h3>
              <button onClick={() => exportArrayToCSV("Customers", customers)} style={{ padding: '6px 12px', background: '#111827', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Excel CSV</button>
            </div>
            {customers.map(c => (
              <div key={c.id} onClick={() => setSelectedCustomerId(c.id)} style={{ background: '#fff', padding: '12px', borderRadius: '6px', marginBottom: '8px', border: selectedCustomerId === c.id ? '2px solid #7e22ce' : '1px solid #e5e7eb', cursor: 'pointer' }}>
                <div style={{ fontWeight: 'bold' }}>{c.name} - 📞 {c.phone}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{c.address}</div>
              </div>
            ))}
            {selectedCustomerId && (
              <button onClick={() => setIsMeasurementModalOpen(true)} style={{ width: '100%', marginTop: '10px', padding: '10px', background: '#7e22ce', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>+ இந்த வாடிக்கையாளருக்கு அளவு சேர்</button>
            )}
          </div>
        )}

        {activeTab === "orders" && (
          <div>
            <h3>ஆர்டர்கள் ({orders.length})</h3>
            {orders.map(o => (
              <div key={o.id} style={{ background: '#fff', padding: '12px', borderRadius: '6px', marginBottom: '8px', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{o.garmentType} (Bill: ₹{o.totalBill})</strong>
                  <span style={{ color: '#059669', fontWeight: 'bold' }}>லாபம்: ₹{o.estimatedProfit}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>டெலிவரி: {o.deliveryDate} | முன்பணம்: ₹{o.advancePaid}</div>
                <button onClick={() => setSelectedOrderForBill(o)} style={{ marginTop: '8px', padding: '4px 8px', background: '#7e22ce', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>பில் காண்க</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "expenses" && (
          <div>
            <h3>பொதுக் கடைச் செலவுகள்</h3>
            <button
              onClick={async () => {
                const desc = prompt("செலவு விவரம்:");
                const amt = prompt("தொகை (₹):");
                if (desc && amt) {
                  const newEx = { id: "EXP_" + Date.now(), description: desc, amount: Number(amt) || 0, date: new Date().toISOString() };
                  await StorageService.put("expenses", newEx);
                  setExpenses(prev => [newEx, ...prev]);
                }
              }}
              style={{ padding: '8px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', marginBottom: '14px', cursor: 'pointer' }}
            >
              + புதிய செலவு சேர்
            </button>
            {expenses.map(e => (
              <div key={e.id} style={{ background: '#fff', padding: '10px', borderRadius: '6px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span>{e.description}</span>
                <strong style={{ color: '#dc2626' }}>₹{e.amount}</strong>
              </div>
            ))}
          </div>
        )}
        {/* --- AI ASSISTANT TAB WITH IMAGE/CAMERA UPLOAD --- */}
        {activeTab === "ai_assistant" && (
          <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', height: '70vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#7e22ce' }}>🤖 AI தையல் & மிஷின் உதவியாளர்</h3>
            <div style={{ flex: 1, overflowY: 'auto', background: '#f9fafb', padding: '10px', borderRadius: '6px', marginBottom: '10px' }}>
              {aiChatMessages.map((m, i) => (
                <div key={i} style={{ marginBottom: '10px', textAlign: m.sender === 'user' ? 'right' : 'left' }}>
                  {m.image && (
                    <div style={{ marginBottom: '4px' }}>
                      <img src={m.image} alt="User Upload" style={{ width: '120px', borderRadius: '6px', border: '1px solid #ddd' }} />
                    </div>
                  )}
                  <span style={{ display: 'inline-block', padding: '8px 12px', borderRadius: '8px', background: m.sender === 'user' ? '#7e22ce' : '#e5e7eb', color: m.sender === 'user' ? '#fff' : '#000', whiteSpace: 'pre-wrap', maxWidth: '85%' }}>
                    {m.text}
                  </span>
                </div>
              ))}
              {aiLoading && <div style={{ fontSize: '13px', color: '#7e22ce' }}>AI பதிலளிக்கிறது...</div>}
            </div>

            {/* Preview of chosen image */}
            {aiImagePreview && (
              <div style={{ padding: '6px', display: 'flex', alignItems: 'center', gap: '8px', background: '#f3e8ff', borderRadius: '6px', marginBottom: '8px' }}>
                <img src={aiImagePreview} alt="Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                <span style={{ fontSize: '12px', color: '#6b21a8' }}>மிஷின் / டிசைன் படம் சேர்க்கப்பட்டது</span>
                <button onClick={() => { setAiImagePreview(null); setAiImageBase64(null); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ background: '#ede9fe', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '18px' }} title="மிஷின் அல்லது துணி புகைப்படம் எடுக்க">
                📷
                <input type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
              </label>
              <input
                type="text"
                value={aiInputPrompt}
                onChange={(e) => setAiInputPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendPromptToGemini()}
                placeholder="மிஷின் பிரச்சனை அல்லது தையல் சந்தேகம் கேட்கவும்..."
                style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
              />
              <button onClick={sendPromptToGemini} disabled={aiLoading} style={{ padding: '10px 16px', background: '#7e22ce', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                {aiLoading ? '...' : 'கேள்'}
              </button>
            </div>
          </div>
        )}

        {/* --- SETTINGS TAB --- */}
        {activeTab === "settings" && (
          <div style={{ background: '#fff', padding: '16px', borderRadius: '8px' }}>
            <h3>கடை அமைப்புகள் & API சாவி</h3>
            
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Gemini API Key:</label>
              <input
                type="password"
                placeholder="AQ... சாவியை இங்கே பேஸ்ட் செய்யவும்"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={async () => {
                  if (!geminiApiKey.trim()) return alert("API Key காலியாக உள்ளது!");
                  localStorage.setItem("GEMINI_KEY", geminiApiKey.trim());
                  await StorageService.put("settings", { key: "geminiApiKey", value: geminiApiKey.trim() });
                  alert("API Key வெற்றிகரமாக சேமிக்கப்பட்டது!");
                }}
                style={{ padding: '10px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                அமைப்புகளை சேமிக்கவும் (Save Settings)
              </button>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '20px 0' }} />

            <button onClick={executeCompleteBackup} style={{ width: '100%', padding: '12px', background: '#374151', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
              📥 முழு Backup கோப்பை டவுன்லோட் செய் (JSON)
            </button>
          </div>
        )}
      </main>
      {/* --- MODAL: NEW CUSTOMER --- */}
      {isCustomerModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '20px', maxWidth: '360px', width: '100%' }}>
            <h4>வாடிக்கையாளர் சேர்</h4>
            <input type="text" placeholder="பெயர்" value={newCustomerForm.name} onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })} style={{ width: '100%', padding: '8px', marginBottom: '8px', boxSizing: 'border-box' }} />
            <input type="tel" placeholder="போன் நம்பர்" value={newCustomerForm.phone} onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })} style={{ width: '100%', padding: '8px', marginBottom: '8px', boxSizing: 'border-box' }} />
            <input type="text" placeholder="ஊர் / முகவரி" value={newCustomerForm.address} onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })} style={{ width: '100%', padding: '8px', marginBottom: '12px', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setIsCustomerModalOpen(false)} style={{ flex: 1, padding: '8px', cursor: 'pointer' }}>ரத்து</button>
              <button onClick={handleSaveCustomer} style={{ flex: 1, padding: '8px', background: '#7e22ce', color: '#fff', border: 'none', cursor: 'pointer' }}>சேமி</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: BILL VIEW --- */}
      {selectedOrderForBill && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '20px', maxWidth: '340px', width: '100%', textAlign: 'center' }}>
            <h3>{settings.shopNameTamil}</h3>
            <div>ஆடை: {selectedOrderForBill.garmentType}</div>
            <div>மொத்த பில்: ₹{selectedOrderForBill.totalBill}</div>
            <div>முன்பணம்: ₹{selectedOrderForBill.advancePaid}</div>
            <div style={{ color: '#dc2626', fontWeight: 'bold' }}>மீதி நிலுவை: ₹{selectedOrderForBill.totalBill - selectedOrderForBill.advancePaid}</div>
            <button onClick={() => setSelectedOrderForBill(null)} style={{ marginTop: '16px', padding: '8px 16px', background: '#7e22ce', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>மூடு</button>
          </div>
        </div>
      )}
    </div>
  );
}
