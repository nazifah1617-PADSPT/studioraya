
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Konfigurasi Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDex4zM27ee0IyUNn_3XllTenOjkmxZL80",
    authDomain: "studio-sg-bakap.firebaseapp.com",
    projectId: "studio-sg-bakap",
    storageBucket: "studio-sg-bakap.firebasestorage.app",
    messagingSenderId: "802779149217",
    appId: "1:802779149217:web:fd5aff579858cd658f51e0",
    measurementId: "G-9SDLZWDZB5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const appId = 'studio-raya-2026';

let bookings = [];
let user = null;
let selectedSlot = null;
let payType = 'full';
let totalCalculated = 0;
let payNow = 0;
let currentBookingData = null;

const qrMap = {
    maybank: "https://i.postimg.cc/Lh7CqX4L/maybank-qr.jpg",
    tngo: "https://i.postimg.cc/mP386yYm/tng-qr.jpg"
};

// Global exports for inline HTML handlers
(window as any).showToast = (msg, icon = '✅') => {
    const toast = document.getElementById('toast');
    if(!toast) return;
    document.getElementById('toast-msg').innerText = msg;
    document.getElementById('toast-icon').innerText = icon;
    toast.classList.replace('translate-y-[-150%]', 'translate-y-0');
    toast.classList.replace('opacity-0', 'opacity-100');
    setTimeout(() => {
        toast.classList.replace('translate-y-0', 'translate-y-[-150%]');
        toast.classList.replace('opacity-100', 'opacity-0');
    }, 3000);
};

const format12h = (time24) => {
    if(!time24) return '--:--';
    const [hours, minutes] = time24.split(':');
    let h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${minutes} ${ampm}`;
};

const initFirebase = async () => {
    try {
        let signedIn = false;
        // @ts-ignore
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            try { 
                // @ts-ignore
                await signInWithCustomToken(auth, __initial_auth_token); 
                signedIn = true; 
            } 
            catch (e) { console.warn("Fallback."); }
        }
        if (!signedIn) await signInAnonymously(auth);

        onAuthStateChanged(auth, (u) => {
            user = u;
            if (user) {
                const statusEl = document.getElementById('connection-status');
                if(statusEl) {
                    statusEl.innerText = "Sistem Aktif & Terhubung";
                    statusEl.classList.replace('text-slate-400', 'text-emerald-500');
                }
                setupDataListener();
            }
        });
    } catch (err) { console.error(err); }
};

const setupDataListener = () => {
    if (!user) return;
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
    onSnapshot(colRef, (snap) => {
        bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        (window as any).renderTimeSlots();
        (window as any).renderAdminDashboard();
    }, (err) => console.error(err));
};

(window as any).updateCalculations = () => {
    const base = parseInt((document.getElementById('package-select') as HTMLSelectElement).value);
    const pax = parseInt((document.getElementById('extra-pax') as HTMLInputElement).value) || 1;
    let extra = pax > 6 ? (pax - 6) * 5 : 0;
    totalCalculated = base + extra;
    payNow = payType === 'full' ? totalCalculated : 39;
    const balance = totalCalculated - payNow;

    document.getElementById('ui-pay-now').innerText = `RM ${payNow.toFixed(2)}`;
    const balanceBox = document.getElementById('ui-balance-box');
    if (balanceBox) {
        if (balance > 0) {
            document.getElementById('ui-balance-amount').innerText = `RM ${balance.toFixed(2)}`;
            balanceBox.classList.remove('hidden');
        } else balanceBox.classList.add('hidden');
    }
};

(window as any).setPaymentType = (type) => {
    payType = type;
    const btnFull = document.getElementById('pay-type-full');
    const btnBooking = document.getElementById('pay-type-booking');
    if (type === 'full') {
        btnFull.className = 'p-3 sm:p-4 text-[9px] sm:text-[10px] font-black border-2 rounded-xl sm:rounded-2xl border-amber-800 bg-amber-50 text-amber-900 transition-all uppercase tracking-wider shadow-sm';
        btnBooking.className = 'p-3 sm:p-4 text-[9px] sm:text-[10px] font-black border-2 rounded-xl sm:rounded-2xl border-slate-100 text-slate-400 transition-all uppercase tracking-wider';
    } else {
        btnBooking.className = 'p-3 sm:p-4 text-[9px] sm:text-[10px] font-black border-2 rounded-xl sm:rounded-2xl border-amber-800 bg-amber-50 text-amber-900 transition-all uppercase tracking-wider shadow-sm';
        btnFull.className = 'p-3 sm:p-4 text-[9px] sm:text-[10px] font-black border-2 rounded-xl sm:rounded-2xl border-slate-100 text-slate-400 transition-all uppercase tracking-wider';
    }
    (window as any).updateCalculations();
};

(window as any).renderTimeSlots = () => {
    const dayGrid = document.getElementById('day-slots-grid');
    const nightGrid = document.getElementById('night-slots-grid');
    const date = (document.getElementById('booking-date') as HTMLInputElement).value;
    if(!dayGrid || !nightGrid) return;
    
    dayGrid.innerHTML = '';
    nightGrid.innerHTML = '';
    const booked = bookings.filter(b => b.date === date && b.verified).map(b => b.slot);
    
    const createSlot = (time24, container) => {
        const isBooked = booked.includes(time24);
        const el = document.createElement('div');
        el.className = `p-3 sm:p-4 text-center border-2 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black tracking-tight transition-all ${isBooked ? 'slot-booked' : 'slot-available bg-white border-slate-100'}`;
        el.innerText = format12h(time24);
        
        if(!isBooked) el.onclick = () => {
            document.querySelectorAll('.slot-available').forEach(s => s.classList.remove('bg-amber-800', 'text-white', 'border-amber-800', 'shadow-lg', 'shadow-amber-900/20'));
            el.classList.add('bg-amber-800', 'text-white', 'border-amber-800', 'shadow-lg', 'shadow-amber-900/20');
            selectedSlot = time24;
            document.getElementById('ui-selected-slot').innerText = format12h(time24);
            document.getElementById('selection-summary').classList.remove('hidden');
            if (window.innerWidth < 640) {
                document.getElementById('selection-summary').scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        };
        container.appendChild(el);
    };

    for(let h=9; h<19; h++) {
        [0, 30].forEach(m => {
            const time24 = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            createSlot(time24, dayGrid);
        });
    }

    const nightTimes = ['20:30', '21:00', '21:30', '22:00', '22:30'];
    nightTimes.forEach(time24 => {
        createSlot(time24, nightGrid);
    });
};

(window as any).selectQR = (provider) => {
    const mBtn = document.getElementById('qr-btn-maybank');
    const tBtn = document.getElementById('qr-btn-tngo');
    const img = document.getElementById('qr-image') as HTMLImageElement;
    if(provider === 'maybank') {
        mBtn.classList.add('qr-selected'); mBtn.classList.remove('opacity-50');
        tBtn.classList.remove('qr-selected'); tBtn.classList.add('opacity-50');
        img.src = qrMap.maybank;
    } else {
        tBtn.classList.add('qr-selected'); tBtn.classList.remove('opacity-50');
        mBtn.classList.remove('qr-selected'); mBtn.classList.add('opacity-50');
        img.src = qrMap.tngo;
    }
};

(window as any).submitBooking = () => {
    const input = document.getElementById('receipt-input') as HTMLInputElement;
    const file = input ? input.files[0] : null;
    if(!file) return (window as any).showToast('Sila muat naik bukti pembayaran!', '⚠️');
    
    const btn = document.getElementById('btn-submit') as HTMLButtonElement;
    btn.disabled = true; btn.innerText = "Hantar...";

    const reader = new FileReader();
    reader.onload = async (e) => {
        const packageSelect = document.getElementById('package-select') as HTMLSelectElement;
        const packageName = packageSelect.options[packageSelect.selectedIndex].text.split(' (')[0];
        const paxCount = (document.getElementById('extra-pax') as HTMLInputElement).value;

        const bookingData = {
            name: (document.getElementById('cust-name') as HTMLInputElement).value,
            phone: (document.getElementById('cust-phone') as HTMLInputElement).value,
            date: (document.getElementById('booking-date') as HTMLInputElement).value,
            slot: selectedSlot,
            pax: paxCount,
            packageName: packageName,
            amount: payNow, 
            totalPrice: totalCalculated,
            verified: true,
            balancePaid: false, 
            receipt: e.target.result,
            createdAt: new Date().toISOString()
        };
        try {
            const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bookings'), bookingData);
            (window as any).showToast('Tempahan berjaya disimpan!');
            currentBookingData = { ...bookingData, id: docRef.id };
            (window as any).showSuccessReceipt(currentBookingData);
        } catch (err) {
            (window as any).showToast('Gagal menghantar tempahan', '❌');
            btn.disabled = false; btn.innerText = "Hantar Tempahan";
        }
    };
    reader.readAsDataURL(file);
};

(window as any).showSuccessReceipt = (data) => {
    (window as any).closePaymentModal();
    document.getElementById('rcpt-ref').innerText = `#RAYA-${data.id.substring(0, 5).toUpperCase()}`;
    document.getElementById('rcpt-name').innerText = data.name;
    document.getElementById('rcpt-phone').innerText = data.phone;
    document.getElementById('rcpt-date').innerText = new Date(data.date).toLocaleDateString('ms-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('rcpt-slot').innerText = format12h(data.slot);
    document.getElementById('rcpt-pax').innerText = `${data.packageName} (${data.pax} Pax)`;
    document.getElementById('rcpt-amount').innerText = `RM ${data.amount.toFixed(2)}`;
    document.getElementById('rcpt-balance').innerText = `RM ${(data.totalPrice - data.amount).toFixed(2)}`;
    document.getElementById('success-modal').classList.remove('hidden');
};

(window as any).sendToWhatsApp = () => {
    if(!currentBookingData) return;
    const b = currentBookingData;
    const ref = b.id.substring(0, 5).toUpperCase();
    const dateStr = new Date(b.date).toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const balance = (b.totalPrice - b.amount).toFixed(2);
    
    const message = `📸 *PENGESAHAN TEMPAHAN STUDIO RAYA*%0A%0AId Rujukan: *#RAYA-${ref}*%0ANama: *${b.name}*%0APakej: *${b.packageName} (${b.pax} Pax)*%0ATarikh: *${dateStr}*%0AMasa: *${format12h(b.slot)}*%0A%0A----------------------------%0ADeposit Dibayar: *RM ${b.amount.toFixed(2)}*%0ABaki Di Studio: *RM ${balance}*%0A----------------------------%0A%0A*Nota:* Bukti pembayaran telah dimuat naik. Sila semak. Terima kasih!`;

    window.open(`https://wa.me/601151929350?text=${message}`, '_blank');
};

(window as any).renderAdminDashboard = () => {
    const dateEl = document.getElementById('admin-filter-date') as HTMLInputElement;
    const body = document.getElementById('admin-table-body');
    if(!dateEl || !body) return;
    const fDate = dateEl.value;
    const filtered = bookings.filter(b => b.date === fDate).sort((a,b) => a.slot.localeCompare(b.slot));
    body.innerHTML = '';
    
    let onlineTotal = 0, balancePendingTotal = 0, balanceCollectedTotal = 0;
    
    filtered.forEach(b => {
        const amountPaid = b.amount || 0;
        const totalPrice = b.totalPrice || amountPaid;
        const balanceAtStudio = totalPrice - amountPaid;
        const isBalancePaid = b.balancePaid || false;
        
        onlineTotal += amountPaid; 
        if(isBalancePaid) balanceCollectedTotal += balanceAtStudio;
        else balancePendingTotal += balanceAtStudio;
        
        const tr = document.createElement('tr');
        tr.className = isBalancePaid ? 'bg-emerald-50/40 transition-colors' : 'hover:bg-slate-50 transition-colors';
        tr.innerHTML = `
            <td class="px-6 py-4 sm:px-8 sm:py-6 font-black text-slate-800">${format12h(b.slot)}</td>
            <td class="px-6 py-4 sm:px-8 sm:py-6 whitespace-nowrap text-nowrap">
                <div class="font-bold text-slate-900">${b.name}</div>
                <div class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">${b.phone}</div>
            </td>
            <td class="px-6 py-4 sm:px-8 sm:py-6 text-center">
                <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-700">Sah</span>
            </td>
            <td class="px-6 py-4 sm:px-8 sm:py-6 text-center font-bold text-emerald-600">RM ${amountPaid.toFixed(2)}</td>
            <td class="px-6 py-4 sm:px-8 sm:py-6 text-center font-black ${balanceAtStudio > 0 ? (isBalancePaid ? 'text-emerald-700' : 'text-amber-800') : 'text-slate-300'}">
                ${balanceAtStudio > 0 ? 'RM ' + balanceAtStudio.toFixed(2) : '-'}
                ${isBalancePaid ? '<span class="block text-[8px] uppercase text-emerald-500 font-black mt-0.5 tracking-widest leading-none">(SETEL)</span>' : ''}
            </td>
            <td class="px-6 py-4 sm:px-8 sm:py-6 text-right">
                <div class="flex items-center justify-end space-x-3">
                    <input type="checkbox" ${isBalancePaid ? 'checked' : ''} 
                           class="w-5 h-5 rounded-lg border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer admin-check" data-id="${b.id}">
                    <button class="text-indigo-600 font-bold text-[10px] uppercase tracking-widest hover:underline view-receipt" data-id="${b.id}">Resit</button>
                    <button class="text-red-400 p-1 remove-booking" data-id="${b.id}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </td>`;
        body.appendChild(tr);
    });

    // Re-bind listeners for dynamic content
    document.querySelectorAll('.admin-check').forEach(el => {
        el.addEventListener('change', (e: any) => (window as any).updateBalancePaidStatus(e.target.dataset.id, e.target.checked));
    });
    document.querySelectorAll('.view-receipt').forEach(el => {
        el.addEventListener('click', (e: any) => (window as any).viewReceipt(e.target.dataset.id));
    });
    document.querySelectorAll('.remove-booking').forEach(el => {
        el.addEventListener('click', (e: any) => (window as any).removeBooking(e.currentTarget.dataset.id));
    });

    document.getElementById('stat-total').innerText = filtered.length.toString();
    document.getElementById('stat-online').innerText = `RM ${onlineTotal.toFixed(0)}`;
    document.getElementById('stat-balance-pending').innerText = `RM ${balancePendingTotal.toFixed(0)}`;
    document.getElementById('stat-balance-collected').innerText = `RM ${balanceCollectedTotal.toFixed(0)}`;
};

(window as any).updateBalancePaidStatus = async (id, status) => {
    try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'bookings', id);
        await updateDoc(docRef, { balancePaid: status });
        (window as any).showToast(status ? 'Baki setel!' : 'Rekod dikemaskini');
    } catch (err) { console.error(err); }
};

(window as any).removeBooking = async (id) => {
    if (window.confirm('Padam rekod ini?')) {
        try {
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'bookings', id);
            await deleteDoc(docRef);
            (window as any).showToast('Rekod dipadam', '🗑️');
        } catch (err) { console.error(err); }
    }
};

(window as any).openPaymentModal = () => {
    if(!(document.getElementById('cust-name') as HTMLInputElement).value || !(document.getElementById('cust-phone') as HTMLInputElement).value) 
        return (window as any).showToast('Lengkapkan maklumat anda!', '⚠️');
    if(!selectedSlot) return (window as any).showToast('Pilih slot waktu!', '⚠️');
    document.getElementById('ui-modal-pay').innerText = `RM ${payNow.toFixed(2)}`;
    document.getElementById('payment-modal').classList.remove('hidden');
};

(window as any).closePaymentModal = () => document.getElementById('payment-modal')?.classList.add('hidden');

(window as any).switchView = (v) => {
    document.getElementById('client-view')?.classList.toggle('hidden', v !== 'client');
    document.getElementById('admin-view')?.classList.toggle('hidden', v !== 'admin');
    const btnClient = document.getElementById('nav-client');
    const btnAdmin = document.getElementById('nav-admin');
    if (v === 'admin') {
        btnAdmin.className = 'px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 text-white shadow-lg';
        btnClient.className = 'px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all';
        (window as any).renderAdminDashboard();
    } else {
        btnClient.className = 'px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-amber-800 text-white shadow-lg';
        btnAdmin.className = 'px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all';
    }
};

(window as any).handleAdminAccess = () => {
    if (!document.getElementById('admin-view').classList.contains('hidden')) (window as any).switchView('client');
    else document.getElementById('login-modal')?.classList.remove('hidden');
};

(window as any).closeAdminLogin = () => document.getElementById('login-modal')?.classList.add('hidden');

(window as any).verifyAdmin = () => {
    if((document.getElementById('admin-password') as HTMLInputElement).value === 'iqmal271') {
        (window as any).closeAdminLogin(); (window as any).switchView('admin');
    } else (window as any).showToast('Kata laluan salah!', '❌');
};

(window as any).viewReceipt = (id) => {
    const b = bookings.find(x => x.id === id);
    if(b && b.receipt) { const w = window.open(); w.document.write(`<img src="${b.receipt}" style="max-width:100%; border-radius: 12px;">`); }
    else (window as any).showToast('Tiada resit', 'ℹ️');
};

document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('booking-date') as HTMLInputElement;
    const adminDateInput = document.getElementById('admin-filter-date') as HTMLInputElement;
    if(dateInput) dateInput.value = today;
    if(adminDateInput) adminDateInput.value = today;
    (window as any).updateCalculations();
});
