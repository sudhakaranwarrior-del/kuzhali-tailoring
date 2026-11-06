import React, { useState, useEffect, useMemo } from 'react';

const APP_VERSION = "2.1.0";
const DB_NAME = "KuzhaliTailoringDB";

class StorageService {
  static db = null;
  static async openDB() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        ['customers', 'orders', 'expenses'].forEach(name => {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        });
      };
    });
  }

  static async getAll(storeName) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  static async put(storeName, item) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const req = tx.objectStore(storeName).put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
}

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [garment, setGarment] = useState("Blouse");
  const [stitching, setStitching] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [cost, setCost] = useState(0);
  const [delDate, setDelDate] = useState("");
  const [selCustId, setSelCustId] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [c, o, e] = await Promise.all([
          StorageService.getAll("customers"),
          StorageService.getAll("orders"),
          StorageService.getAll("expenses")
        ]);
        setCustomers(c);
        setOrders(o);
        setExpenses(e);
      } catch (err) {
        console.error(err);
      }
    }
    loadData();
  }, []);

  const totalBill = useMemo(() => orders.reduce((sum, o) => sum + (Number(o.bill) || 0), 0), [orders]);
  const totalCash = useMemo(() => orders.reduce((sum, o) => sum + (Number(o.advance) || 0), 0), [orders]);
  const totalCost = useMemo(() => orders.reduce((sum, o) => sum + (Number(o.cost) || 0), 0), [orders]);
  const netProfit = totalBill - totalCost;

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!custName || !custPhone) return alert("பெயர் மற்றும் போன் நம்பர் தேவை!");
    const newC = { id: "C_" + Date.now(), name: custName, phone: custPhone };
    await StorageService.put("customers", newC);
    setCustomers(prev => [...prev, newC]);
    setCustName("");
    setCustPhone("");
    alert("வாடிக்கையாளர் சேர்க்கப்பட்டார்!");
  };

  const handleAddOrder = async (e) => {
    e.preventDefault();
    if (!selCustId || !stitching) return alert("வாடிக்கையாளர் மற்றும் தையல் கூலி தேவை!");
    const newO = {
      id: "O_" + Date.now(),
      customerId: selCustId,
      garment,
      bill: Number(stitching),
      advance: Number(advance),
      cost: Number(cost),
      profit: Number(stitching) - Number(cost),
      date: delDate || new Date().toISOString().slice(0, 10)
    };
    await StorageService.put("orders", newO);
    setOrders(prev => [...prev, newO]);
    setStitching(0);
    setAdvance(0);
    setCost(0);
    alert("ஆர்டர் சேர்க்கப்பட்டது!");
  };

  const handleDownloadBackup = () => {
    const data = { customers, orders, expenses, appVersion: APP_VERSION };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Kuzhali_Backup_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif', paddingBottom: '30px' }}>
      <header style={{ backgroundColor: '#6b21a8', color: '#fff', padding: '16px', textAlign: 'center' }}>
        <h2 style={{ margin: 0 }}>குழலி தையலகம்</h2>
        <div style={{ fontSize: '13px', opacity: 0.9 }}>உரிமையாளர்: Tamil Selvi • 📞 8940204536</div>
      </header>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', background: '#fff', padding: '10px', borderBottom: '1px solid #ddd' }}>
        <button onClick={() => setTab("dashboard")} style={{ padding: '8px 12px', background: tab === 'dashboard' ? '#6b21a8' : '#e5e7eb', color: tab === 'dashboard' ? '#fff' : '#000', border: 'none', borderRadius: '4px' }}>முகப்பு</button>
        <button onClick={() => setTab("customers")} style={{ padding: '8px 12px', background: tab === 'customers' ? '#6b21a8' : '#e5e7eb', color: tab === 'customers' ? '#fff' : '#000', border: 'none', borderRadius: '4px' }}>வாடிக்கையாளர்</button>
        <button onClick={() => setTab("orders")} style={{ padding: '8px 12px', background: tab === 'orders' ? '#6b21a8' : '#e5e7eb', color: tab === 'orders' ? '#fff' : '#000', border: 'none', borderRadius: '4px' }}>ஆர்டர்கள்</button>
      </div>

      <div style={{ maxWidth: '600px', margin: '16px auto', padding: '0 12px' }}>
        {tab === "dashboard" && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #6b21a8' }}>
                <div style={{ fontSize: '12px', color: '#666' }}>மொத்த ஆர்டர்</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>₹{totalBill}</div>
              </div>
              <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #059669' }}>
                <div style={{ fontSize: '12px', color: '#666' }}>ரொக்க வரவு</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#059669' }}>₹{totalCash}</div>
              </div>
              <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #dc2626' }}>
                <div style={{ fontSize: '12px', color: '#666' }}>நிலுவை</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc2626' }}>₹{Math.max(0, totalBill - totalCash)}</div>
              </div>
              <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #2563eb' }}>
                <div style={{ fontSize: '12px', color: '#666' }}>நிகர லாபம்</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563eb' }}>₹{netProfit}</div>
              </div>
            </div>

            <button onClick={handleDownloadBackup} style={{ width: '100%', padding: '12px', background: '#374151', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
              📥 முழு Backup கோப்பை டவுன்லோட் செய் (JSON)
            </button>
          </div>
        )}

        {tab === "customers" && (
          <div>
            <form onSubmit={handleAddCustomer} style={{ background: '#fff', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}>
              <h4>புதிய வாடிக்கையாளர் பதிவு</h4>
              <input type="text" placeholder="பெயர்" value={custName} onChange={e => setCustName(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px', boxSizing: 'border-box' }} />
              <input type="tel" placeholder="போன் நம்பர்" value={custPhone} onChange={e => setCustPhone(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px', boxSizing: 'border-box' }} />
              <button type="submit" style={{ width: '100%', padding: '10px', background: '#6b21a8', color: '#fff', border: 'none', borderRadius: '4px' }}>சேமி</button>
            </form>
            <div>
              {customers.map(c => (
                <div key={c.id} style={{ background: '#fff', padding: '10px', borderRadius: '6px', marginBottom: '6px' }}>
                  <strong>{c.name}</strong> - 📞 {c.phone}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "orders" && (
          <div>
            <form onSubmit={handleAddOrder} style={{ background: '#fff', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}>
              <h4>புதிய ஆர்டர் பதிவு</h4>
              <select value={selCustId} onChange={e => setSelCustId(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px' }}>
                <option value="">வாடிக்கையாளரைத் தேர்வு செய்க...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={garment} onChange={e => setGarment(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px' }}>
                <option value="Blouse">பிளவுஸ் (Blouse)</option>
                <option value="Churidar">சுடிதார் (Churidar)</option>
                <option value="Frock">பிராக் (Frock)</option>
              </select>
              <input type="number" placeholder="தையல் கூலி பில் (₹)" value={stitching || ""} onChange={e => setStitching(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px', boxSizing: 'border-box' }} />
              <input type="number" placeholder="செலுத்திய முன்பணம் (₹)" value={advance || ""} onChange={e => setAdvance(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px', boxSizing: 'border-box' }} />
              <input type="number" placeholder="அடக்கச் செலவு - லைனிங்/நூல் (₹)" value={cost || ""} onChange={e => setCost(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px', boxSizing: 'border-box' }} />
              <input type="date" value={delDate} onChange={e => setDelDate(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px', boxSizing: 'border-box' }} />
              <button type="submit" style={{ width: '100%', padding: '10px', background: '#059669', color: '#fff', border: 'none', borderRadius: '4px' }}>ஆர்டர் சேமி</button>
            </form>
            <div>
              {orders.map(o => (
                <div key={o.id} style={{ background: '#fff', padding: '10px', borderRadius: '6px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{o.garment}</strong>
                    <span style={{ color: '#059669', fontWeight: 'bold' }}>லாபம்: ₹{o.profit}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>பில்: ₹{o.bill} | முன்பணம்: ₹{o.advance}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
