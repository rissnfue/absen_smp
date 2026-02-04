// ==========================================
// KONFIGURASI
// ==========================================
// PASTIKAN GANTI KE URL BARU HASIL DEPLOY
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyX4SQ_BvAT04is6CO3onC21Rb9nrPl3n5kZ9FKCAh_i2qr-P3QP-4ty5aLEePqnmA0og/exec'; 
const PASSWORD_WALI = { "7": "wali7", "8": "wali8", "9": "wali9" };

const DB_SISWA = {
    "7": [
        { id: 701, nama: "AHMAD WIRAHADI KUSUMA" },
        { id: 702, nama: "FATHIR PUTRA NEGARA" },
        { id: 703, nama: "NURUL HASANAH" },
        { id: 704, nama: "RIZKI ADITIA PRATAMA" },
        { id: 705, nama: "SERI BANUN" }
    ],
    "8": [
        { id: 801, nama: "DAVID AL ROSYID" },
        { id: 802, nama: "HENDRA PRATAMA" },
        { id: 803, nama: "HUZAINI ADITYA" },
        { id: 804, nama: "MIZA KALIANA PUTRI" },
        { id: 805, nama: "MUHAMAD ALI FIKRI" },
        { id: 806, nama: "WANDI KILAL FAROZI" },
        { id: 807, nama: "WARDATUL AZZAZIAH" },
        { id: 808, nama: "WARDATUL MARDIAH" },
        { id: 809, nama: "ZIADATUL KHAIR" }
    ],
    "9": [
        { id: 1, nama: "Asrina" },
        { id: 2, nama: "Muhammad Amir Usroni" },
        { id: 3, nama: "Muhammad Nurdin Irwan" },
        { id: 4, nama: "Muhammad Ihwan Masjudin" },
        { id: 5, nama: "Seftiana Rianti" }
    ]
};

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
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "l, j F Y",
        defaultDate: "today",
        locale: "id", 
        disableMobile: "true",
        allowInput: false,
        // Saat tanggal berubah, cek database
        onChange: function(selectedDates, dateStr, instance) {
            currentDateVal = dateStr;
            cekAbsensiHariIni();
        }
    });
    
    // Simpan tanggal awal untuk cek pertama kali
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    currentDateVal = `${year}-${month}-${day}`;

    const configTime = { enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: true, disableMobile: "true" };
    const fpMulai = flatpickr("#jamMulai", {...configTime, defaultDate: new Date()});
    const nextHour = new Date(); nextHour.setHours(nextHour.getHours() + 1);
    flatpickr("#jamSelesai", {...configTime, defaultDate: nextHour});

    document.getElementById('wrapperJamMulai').addEventListener('click', () => fpMulai.open());
    document.getElementById('wrapperJamSelesai').addEventListener('click', () => document.querySelector('#jamSelesai')._flatpickr.open());

    renderSiswa(); 
    // Cek absensi saat pertama kali buka
    cekAbsensiHariIni();
});

function gantiKelas() {
    currentKelas = document.getElementById('pilihKelas').value;
    renderSiswa();
    document.getElementById('panelWaliKelas').classList.add('hidden');
    // Cek lagi karena kelas berubah
    cekAbsensiHariIni();
}

// --- FUNGSI CEK STATUS TERAKHIR DI SERVER ---
function cekAbsensiHariIni() {
    const notif = document.getElementById('syncNotif');
    notif.classList.remove('hidden');
    notif.innerHTML = '<i class="fas fa-sync fa-spin"></i> Cek data absensi tanggal ini...';

    fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: 'get_latest_status',
            header: {
                kelas: currentKelas,
                tanggal_raw: currentDateVal
            }
        })
    })
    .then(res => res.json())
    .then(response => {
        if (response.result === 'success' && response.found) {
            // DATA KETEMU! ISI OTOMATIS
            notif.className = "mb-4 bg-green-100 border-l-4 border-green-500 text-green-700 p-3 rounded shadow-md text-xs font-bold flex items-center gap-2";
            notif.innerHTML = '<i class="fas fa-check-circle"></i> Data absensi hari ini ditemukan. Formulir diisi otomatis.';
            
            const statuses = response.statuses; // Array ['Hadir', 'Sakit', ...]
            const siswaList = DB_SISWA[currentKelas];

            // Loop siswa dan set radio button sesuai urutan array
            siswaList.forEach((siswa, index) => {
                if (statuses[index]) {
                    // Cari radio button dengan value yang sesuai dan centang
                    const radio = document.querySelector(`input[name="status_${siswa.id}"][value="${statuses[index].trim()}"]`);
                    if (radio) {
                        radio.checked = true;
                    }
                }
            });
            updateSummary(); // Update angka dashboard

        } else {
            // DATA KOSONG (Belum ada yang absen hari ini)
            notif.className = "mb-4 bg-gray-100 border-l-4 border-gray-500 text-gray-700 p-3 rounded shadow-md text-xs font-bold flex items-center gap-2";
            notif.innerHTML = '<i class="fas fa-info-circle"></i> Belum ada data absensi untuk tanggal/kelas ini.';
            
            // Reset ke default (kosongkan atau set hadir semua terserah, di sini kita biarkan apa adanya/kosong)
            // document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
            updateSummary();
        }
        
        // Sembunyikan notif setelah 3 detik
        setTimeout(() => {
            notif.classList.add('hidden');
        }, 3000);
    })
    .catch(err => {
        console.error(err);
        notif.classList.add('hidden');
    });
}

function renderSiswa() {
    const container = document.getElementById('listSiswa');
    container.innerHTML = '';
    const siswaList = DB_SISWA[currentKelas];
    
    let html = '';
    siswaList.forEach(siswa => {
        html += `
        <div class="bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:shadow-md transition">
            <div class="flex items-center gap-3 mb-2">
                <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">${siswa.nama.substring(0,2).toUpperCase()}</div>
                <h4 class="font-bold text-gray-700 text-xs truncate">${siswa.nama}</h4>
            </div>
            <div class="grid grid-cols-4 gap-1">
                ${renderTombol(siswa.id, 'Hadir', 'check')}
                ${renderTombol(siswa.id, 'Sakit', 'bed')}
                ${renderTombol(siswa.id, 'Izin', 'envelope')}
                ${renderTombol(siswa.id, 'Alfa', 'times')}
            </div>
        </div>`;
    });
    container.innerHTML = html;
    updateSummary();
}

function renderTombol(id, val, icon) {
    return `<label class="cursor-pointer group"><input type="radio" name="status_${id}" value="${val}" class="hidden" onchange="updateSummary()"><div class="py-1.5 rounded border border-gray-100 bg-gray-50 text-center text-xs font-semibold text-gray-400 transition group-hover:bg-gray-100 flex flex-col items-center gap-0.5"><i class="fas fa-${icon} text-[10px]"></i><span class="text-[9px]">${val}</span></div></label>`;
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
    Swal.fire({icon: 'success', title: 'Siap!', text: 'Semua Hadir', timer: 800, showConfirmButton: false});
}

function loginWaliKelas() {
    Swal.fire({
        title: `Wali Kelas ${currentKelas}`, input: 'password', inputPlaceholder: 'Kode Akses...', confirmButtonColor: '#f97316', showCancelButton: true
    }).then((result) => {
        if (result.value === PASSWORD_WALI[currentKelas]) {
            document.getElementById('panelWaliKelas').classList.remove('hidden');
            document.getElementById('labelWaliKelas').innerText = `Kelas ${currentKelas}`;
            Swal.fire('Sukses', `Akses Wali Kelas ${currentKelas} Diterima.`, 'success');
        } else if (result.value) { Swal.fire('Gagal', 'Kode salah.', 'error'); }
    });
}

// --- FUNGSI LOGOUT WALI KELAS (BARU) ---
function logoutWaliKelas() {
    document.getElementById('panelWaliKelas').classList.add('hidden');
    Swal.fire({
        icon: 'info',
        title: 'Mode Guru',
        text: 'Anda telah keluar dari mode Wali Kelas.',
        timer: 1500,
        showConfirmButton: false
    });
}

function kirimAbsensi() {
    if (isSubmitting) return;

    const btn = document.getElementById('btnKirim');
    const namaGuru = document.getElementById('namaGuru').value;
    const mapel = document.getElementById('mapel').value;
    const materi = document.getElementById('materi').value;
    const tglInput = document.getElementById('inputTanggal').value; // Mengambil value asli flatpickr
    const jamMulai = document.getElementById('jamMulai').value;
    const jamSelesai = document.getElementById('jamSelesai').value;

    if(!namaGuru || !mapel || !materi || !jamMulai || !jamSelesai || !tglInput) {
        Swal.fire('Data Kurang', 'Pastikan Tanggal & Form Terisi.', 'warning');
        return;
    }

    isSubmitting = true;
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Mengirim...';
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');

    const jamPelajaran = `${jamMulai}-${jamSelesai}`;
    
    let listAbsen = [];
    DB_SISWA[currentKelas].forEach(siswa => {
        const radio = document.querySelector(`input[name="status_${siswa.id}"]:checked`);
        listAbsen.push({ 
            nama: siswa.nama, 
            status: radio ? radio.value : "Alfa" 
        });
    });

    const payload = {
        action: 'simpan',
        header: {
            kelas: currentKelas,
            jam_pelajaran: jamPelajaran,
            tanggal: tglInput, // Kirim format YYYY-MM-DD
            nama_guru: namaGuru,
            mapel: mapel,
            materi: materi
        },
        siswa: listAbsen
    };

    fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(response => {
        if(response.result === 'success') {
            Swal.fire('Terkirim!', `Data Kelas ${currentKelas} Tersimpan.`, 'success');
            lastInsertedInfo = { startRow: response.startRow, count: 1, kelas: currentKelas };
            document.getElementById('undoContainer').classList.remove('hidden');
            
            btn.innerHTML = originalBtnText;
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
            isSubmitting = false; 
        } else { throw new Error("Server Error"); }
    })
    .catch(err => {
        Swal.fire('Gagal', 'Koneksi error.', 'error');
        btn.innerHTML = originalBtnText;
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        isSubmitting = false; 
    });
}

async function batalkanInput() {
    if(!lastInsertedInfo) return;
    if(lastInsertedInfo.kelas !== currentKelas) {
        Swal.fire('Gagal', `Pindah ke Kelas ${lastInsertedInfo.kelas} dulu.`, 'error'); 
        return;
    }

    const result = await Swal.fire({ title: 'Hapus data ini?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus!' });
    if (result.isConfirmed) {
        Swal.fire({title: 'Menghapus...', allowOutsideClick: false, didOpen: () => {Swal.showLoading()}});
        try {
            await fetch(SCRIPT_URL, { 
                method: 'POST', 
                body: JSON.stringify({ 
                    action: 'hapus', 
                    row: lastInsertedInfo.startRow, 
                    count: 1, 
                    header: { kelas: currentKelas } 
                }) 
            });
            Swal.fire('Dihapus!', '', 'success');
            document.getElementById('undoContainer').classList.add('hidden');
            lastInsertedInfo = null;
        } catch (e) { Swal.fire('Gagal', 'Koneksi bermasalah', 'error'); }
    }
}
