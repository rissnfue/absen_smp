// ==========================================
// KONFIGURASI UTAMA
// ==========================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyeL2D-gu2wxNwcmcsAkp2cYOZxiet8V5LdwKQ7mcG_qKbxmX5VkcUQxk5tU3ZZtnJ-Zg/exec'; 

const SPREADSHEET_ID = "1dJzZGCJ4wbXd544GBjc7PATynD74zxiGAz7HQDlxmwE"; 

const SHEET_GIDS = {
    "7": "2076466100", 
    "8": "0",          
    "9": "462314653"   
};

const PASSWORD_WALI = { "7": "wali7", "8": "wali8", "9": "wali9" };

let DB_SISWA = { "7": [], "8": [], "9": [] };

let currentKelas = "9"; 
let lastInsertedInfo = null;
let isSubmitting = false; 
let currentDateVal = ""; 

function updateClock() {
    document.getElementById('clock').innerText = new Date().toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute:'2-digit' }).replace('.',':');
}
setInterval(updateClock, 1000);

document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    
    flatpickr("#inputTanggal", {
        dateFormat: "Y-m-d", altInput: true, altFormat: "l, j F Y", defaultDate: "today", locale: "id", disableMobile: "true", allowInput: false,
        onChange: function(selectedDates, dateStr, instance) {
            currentDateVal = dateStr;
            cekAbsensiHariIni();
        }
    });
    
    const today = new Date();
    currentDateVal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const configTime = { enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: true, disableMobile: "true" };
    const fpMulai = flatpickr("#jamMulai", {...configTime, defaultDate: new Date()});
    const nextHour = new Date(); nextHour.setHours(nextHour.getHours() + 1);
    flatpickr("#jamSelesai", {...configTime, defaultDate: nextHour});

    document.getElementById('wrapperJamMulai').addEventListener('click', () => fpMulai.open());
    document.getElementById('wrapperJamSelesai').addEventListener('click', () => document.querySelector('#jamSelesai')._flatpickr.open());

    fetchDataMaster();
    updateDownloadLinks(); 
});

// --- PERBAIKAN UTAMA: FUNGSI DOWNLOAD SINGLE SHEET ---
function updateDownloadLinks() {
    const gid = SHEET_GIDS[currentKelas];
    if (!gid && gid !== "0") return; 

    const baseUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export`;
    
    // Parameter 'single=true' memastikan hanya gid tersebut yang diunduh
    const pdfUrl = `${baseUrl}?format=pdf&gid=${gid}&single=true&size=A4&portrait=true&fitw=true&gridlines=false`;
    const xlsxUrl = `${baseUrl}?format=xlsx&gid=${gid}&single=true`;

    document.getElementById('btnDownloadPdf').href = pdfUrl;
    document.getElementById('btnDownloadExcel').href = xlsxUrl;
}

function fetchDataMaster() {
    const selectGuru = document.getElementById('namaGuru');
    if(selectGuru) selectGuru.innerHTML = '<option>⏳ Sedang mengambil data...</option>';
    
    const containerSiswa = document.getElementById('listSiswa');
    if(containerSiswa) containerSiswa.innerHTML = '<div class="col-span-full text-center py-10 text-gray-200 font-bold animate-pulse text-lg">Sedang mengunduh data siswa & guru dari server...</div>';

    fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'get_master_data' })
    })
    .then(res => res.json())
    .then(response => {
        if(response.result === 'success') {
            DB_SISWA = response.students;
            
            if(selectGuru) {
                selectGuru.innerHTML = '<option value="" disabled selected> Pilih Guru </option>';
                response.gurus.forEach(guru => {
                    let option = document.createElement("option");
                    option.text = guru;
                    option.value = guru;
                    selectGuru.add(option);
                });
            }

            renderSiswa();
            cekAbsensiHariIni();
        }
    })
    .catch(err => {
        console.error(err);
        Swal.fire('Gagal Load Data', 'Periksa koneksi internet.', 'error');
    });
}

function gantiKelas() {
    currentKelas = document.getElementById('pilihKelas').value;
    renderSiswa();
    logoutWaliKelas();
    cekAbsensiHariIni();
    updateDownloadLinks(); 
}

function renderSiswa() {
    const container = document.getElementById('listSiswa');
    container.innerHTML = '';
    const siswaList = DB_SISWA[currentKelas];
    
    if (!siswaList || siswaList.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-10 text-white/50 italic">Belum ada data siswa untuk Kelas ${currentKelas}.</div>`;
        return;
    }
    
    let html = '';
    siswaList.forEach(siswa => {
        html += `
        <div class="bg-white rounded-xl p-4 shadow-md border-b-4 border-blue-200 hover:border-blue-400 transition-all duration-300">
            <div class="flex items-center gap-3 mb-4 pb-2 border-b border-gray-100">
                <div class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-md">
                    ${siswa.nama.substring(0,2).toUpperCase()}
                </div>
                <h4 class="font-bold text-gray-800 text-sm truncate uppercase tracking-tight">${siswa.nama}</h4>
            </div>
            
            <div class="grid grid-cols-4 gap-2">
                ${renderTombol(siswa.id, 'Hadir', 'check', 'text-green-600')}
                ${renderTombol(siswa.id, 'Sakit', 'procedures', 'text-yellow-600')}
                ${renderTombol(siswa.id, 'Izin', 'envelope-open-text', 'text-blue-600')}
                ${renderTombol(siswa.id, 'Alfa', 'times-circle', 'text-red-600')}
            </div>
        </div>`;
    });
    container.innerHTML = html;
    updateSummary();
}

function renderTombol(id, val, icon, colorClass) {
    return `
    <label class="cursor-pointer group block relative h-20">
        <input type="radio" name="status_${id}" value="${val}" class="hidden peer" onchange="updateSummary()">
        <div class="w-full h-full rounded-xl border-2 border-gray-100 bg-gray-50 text-gray-400 
                    transition-all duration-200 ease-in-out
                    hover:bg-gray-100 hover:border-gray-300 active:scale-95
                    peer-checked:scale-100 peer-checked:shadow-lg peer-checked:border-transparent
                    flex flex-col items-center justify-center gap-1">
            <i class="fas fa-${icon} text-3xl mb-1 ${colorClass} opacity-40 group-hover:opacity-80 peer-checked:opacity-100 transition-opacity"></i>
            <span class="text-[11px] font-black uppercase tracking-widest peer-checked:text-white">${val}</span>
        </div>
        <div class="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-gray-200 peer-checked:bg-white transition-colors shadow-sm"></div>
    </label>`;
}

function updateSummary() {
    document.getElementById("count-hadir").innerText = document.querySelectorAll('input[value="Hadir"]:checked').length;
    document.getElementById("count-sakit").innerText = document.querySelectorAll('input[value="Sakit"]:checked').length;
    document.getElementById("count-izin").innerText = document.querySelectorAll('input[value="Izin"]:checked').length;
    document.getElementById("count-alfa").innerText = document.querySelectorAll('input[value="Alfa"]:checked').length;
}

function setAllHadir() {
    document.querySelectorAll('input[value="Hadir"]').forEach(r => r.checked = true);
    updateSummary();
}

function loginWaliKelas() {
    Swal.fire({
        title: `Wali Kelas ${currentKelas}`, input: 'password', inputPlaceholder: 'Kode Akses...', confirmButtonColor: '#f97316', showCancelButton: true
    }).then((result) => {
        if (result.value === PASSWORD_WALI[currentKelas]) {
            document.getElementById('panelWaliKelas').classList.remove('hidden');
            document.getElementById('labelWaliKelas').innerText = `Kelas ${currentKelas}`;
            document.getElementById('btnMasukWali').classList.add('hidden');
            document.getElementById('btnKeluarWali').classList.remove('hidden');
        } else if (result.value) { Swal.fire('Gagal', 'Kode salah.', 'error'); }
    });
}

function logoutWaliKelas() {
    document.getElementById('panelWaliKelas').classList.add('hidden');
    document.getElementById('btnMasukWali').classList.remove('hidden');
    document.getElementById('btnKeluarWali').classList.add('hidden');
}

function cekAbsensiHariIni() {
    const notif = document.getElementById('syncNotif');
    if(notif) notif.classList.remove('hidden');

    fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: 'get_latest_status',
            header: { kelas: currentKelas, tanggal_raw: currentDateVal }
        })
    })
    .then(res => res.json())
    .then(response => {
        if (response.result === 'success' && response.found) {
            const statuses = response.statuses; 
            const siswaList = DB_SISWA[currentKelas];
            if(siswaList && statuses) {
                siswaList.forEach((siswa, index) => {
                    if (statuses[index]) {
                        const cleanStatus = statuses[index].trim();
                        const radio = document.querySelector(`input[name="status_${siswa.id}"][value="${cleanStatus}"]`);
                        if (radio) radio.checked = true;
                    }
                });
            }
            updateSummary();
        }
        if(notif) setTimeout(() => { notif.classList.add('hidden'); }, 1500);
    })
    .catch(err => { console.error(err); if(notif) notif.classList.add('hidden'); });
}

function kirimAbsensi() {
    if (isSubmitting) return;
    const btn = document.getElementById('btnKirim');
    const namaGuru = document.getElementById('namaGuru').value;
    const mapel = document.getElementById('mapel').value;
    const materi = document.getElementById('materi').value;
    const tglInput = document.getElementById('inputTanggal').value; 
    const jamMulai = document.getElementById('jamMulai').value;
    const jamSelesai = document.getElementById('jamSelesai').value;

    if(!namaGuru || !mapel || !materi || !jamMulai || !jamSelesai || !tglInput) {
        Swal.fire('Data Kurang', 'Lengkapi formulir.', 'warning');
        return;
    }

    isSubmitting = true;
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Mengirim...';
    btn.disabled = true;

    const jamPelajaran = `${jamMulai}-${jamSelesai}`;
    let listAbsen = [];
    const siswaList = DB_SISWA[currentKelas];
    siswaList.forEach(siswa => {
        const radio = document.querySelector(`input[name="status_${siswa.id}"]:checked`);
        listAbsen.push({ nama: siswa.nama, status: radio ? radio.value : "Alfa" });
    });

    const payload = {
        action: 'simpan',
        header: { kelas: currentKelas, jam_pelajaran: jamPelajaran, tanggal: tglInput, nama_guru: namaGuru, mapel: mapel, materi: materi },
        siswa: listAbsen
    };

    fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(response => {
        if(response.result === 'success') {
            Swal.fire('Terkirim!', `Data Tersimpan.`, 'success');
            lastInsertedInfo = { startRow: response.startRow, count: 1, kelas: currentKelas };
            document.getElementById('undoContainer').classList.remove('hidden');
            btn.innerHTML = originalBtnText;
            btn.disabled = false;
            isSubmitting = false; 
        }
    })
    .catch(err => {
        Swal.fire('Gagal', 'Koneksi error.', 'error');
        btn.innerHTML = originalBtnText;
        btn.disabled = false;
        isSubmitting = false; 
    });
}

async function batalkanInput() {
    if(!lastInsertedInfo) return;
    const result = await Swal.fire({ title: 'Hapus data ini?', icon: 'warning', showCancelButton: true });
    if (result.isConfirmed) {
        fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'hapus', row: lastInsertedInfo.startRow, count: 1, header: { kelas: currentKelas } }) })
        .then(() => {
            Swal.fire('Dihapus!', '', 'success');
            document.getElementById('undoContainer').classList.add('hidden');
        });
    }
}

