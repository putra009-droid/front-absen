// admin-monthly-report.js
document.addEventListener('DOMContentLoaded', async () => {
    // === 1. PENGATURAN DASAR & ELEMEN DOM ===
    // const API_BASE_URL = 'https://akademik.online'; // Jika tidak di auth_utils.js

    const adminReportInfoArea = document.getElementById('adminReportInfo');
    const logoutButtonAdminReport = document.getElementById('logoutButtonAdminReport');
    const adminReportMessageArea = document.getElementById('adminReportMessageArea');

    // Filter Elements
    const filterYearInput = document.getElementById('filterYear');
    const filterMonthSelect = document.getElementById('filterMonth');
    const generateReportBtn = document.getElementById('generateReportBtn');

    // Report Output Area
    const reportOutputArea = document.getElementById('reportOutputArea');
    const reportPeriodSpan = document.getElementById('reportPeriod');
    const reportGeneratedDateSpan = document.getElementById('reportGeneratedDate');
    const reportDataContainer = document.getElementById('reportDataContainer');

    // Modal Daily Detail
    const dailyDetailModal = document.getElementById('dailyDetailModal');
    const closeDailyDetailModalBtn = document.getElementById('closeDailyDetailModalBtn');
    const dailyDetailModalTitle = document.getElementById('dailyDetailModalTitle');
    const dailyDetailTableBody = document.getElementById('dailyDetailTableBody');

    // === 2. FUNGSI AUTENTIKASI (DIASUMSIKAN DARI auth_utils.js) ===
    // Pastikan `fetchWithAuth` dan `performLogoutClientSide` tersedia global

    // === 3. PENGECEKAN AUTENTIKASI & OTORISASI ADMIN ===
    // ... (Salin blok pengecekan otorisasi SUPER_ADMIN dari file JS admin lainnya) ...
    const loggedInUserString = localStorage.getItem('user');
    if (!loggedInUserString || !localStorage.getItem('accessToken')) {
        performLogoutClientSide('Anda belum login atau sesi telah berakhir.', 'login.html');
        return;
    }
    let loggedInUser;
    try { loggedInUser = JSON.parse(loggedInUserString); }
    catch (e) { performLogoutClientSide('Data sesi tidak valid.', 'login.html'); return; }

    if (!loggedInUser || loggedInUser.role !== 'SUPER_ADMIN') {
        showAdminReportMessage('Akses Ditolak: Halaman ini hanya untuk SUPER_ADMIN.', 'error', false);
        document.querySelector('.filters')?.remove();
        if(reportOutputArea) reportOutputArea.style.display = 'none';
        return;
    }
    if(adminReportInfoArea) adminReportInfoArea.textContent = `Admin: ${loggedInUser.name || loggedInUser.email}`;


    // === 4. FUNGSI LOGOUT ===
    // ... (Salin fungsi logout dari file JS admin lainnya, sesuaikan ID tombol) ...
    if (logoutButtonAdminReport) {
        logoutButtonAdminReport.addEventListener('click', () => performLogoutClientSide('Anda telah logout.', 'login.html'));
    }

    // === 5. FUNGSI UNTUK MENGISI DROPDOWN FILTER BULAN & TAHUN DEFAULT ===
    function populateMonthYearFilters() {
        if (!filterMonthSelect || !filterYearInput) return;

        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1; // getMonth() adalah 0-11

        filterYearInput.value = currentYear;
        filterYearInput.max = currentYear + 5; // Batas atas tahun
        filterYearInput.min = currentYear - 5; // Batas bawah tahun (sesuaikan)

        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        filterMonthSelect.innerHTML = '<option value="">-- Pilih Bulan --</option>';
        months.forEach((monthName, index) => {
            const option = document.createElement('option');
            option.value = index + 1; // 1-12
            option.textContent = monthName;
            if ((index + 1) === currentMonth) {
                option.selected = true; // Pilih bulan saat ini sebagai default
            }
            filterMonthSelect.appendChild(option);
        });
    }

    // === 6. FUNGSI UNTUK MENGAMBIL DAN MENAMPILKAN LAPORAN ===
    async function fetchAndDisplayMonthlyReport() {
        if (!filterYearInput || !filterMonthSelect || !reportOutputArea || !reportDataContainer) return;

        const year = filterYearInput.value;
        const month = filterMonthSelect.value;

        if (!year || !month) {
            showAdminReportMessage('Tahun dan Bulan wajib dipilih untuk menampilkan laporan.', 'error');
            return;
        }

        showAdminReportMessage('Memuat laporan...', 'info', false);
        reportOutputArea.style.display = 'none'; // Sembunyikan area output saat memuat
        reportDataContainer.innerHTML = ''; // Kosongkan kontainer data lama

        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/reports/attendance/monthly?year=${year}&month=${month}`);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: `Gagal memuat laporan (Status: ${response.status})` }));
                throw new Error(errData.message);
            }
            const report = await response.json(); // Ini adalah objek laporan dari backend

            if(reportPeriodSpan) reportPeriodSpan.textContent = `${filterMonthSelect.options[filterMonthSelect.selectedIndex].text} ${year}`;
            if(reportGeneratedDateSpan) reportGeneratedDateSpan.textContent = new Date(report.reportGeneratedAt).toLocaleString('id-ID', { dateStyle:'full', timeStyle:'long'});

            if (!report.data || report.data.length === 0) {
                reportDataContainer.innerHTML = '<p style="text-align:center;">Tidak ada data absensi ditemukan untuk periode ini.</p>';
                showAdminReportMessage('Tidak ada data untuk laporan periode ini.', 'info');
            } else {
                report.data.forEach(userData => {
                    const userSection = document.createElement('div');
                    userSection.className = 'user-section';
                    userSection.innerHTML = `
                        <h4>${userData.userName} (${userData.userEmail})</h4>
                        <table class="user-recap-table">
                            <thead>
                                <tr>
                                    <th>Total Hadir</th>
                                    <th>Total Terlambat</th>
                                    <th>Total Alpha</th>
                                    <th>Total Izin</th>
                                    <th>Total Sakit</th>
                                    <th>Total Cuti</th>
                                    <th>Total Hari Kerja</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>${userData.recap.totalHadir}</td>
                                    <td>${userData.recap.totalTerlambat}</td>
                                    <td>${userData.recap.totalAlpha}</td>
                                    <td>${userData.recap.totalIzin}</td>
                                    <td>${userData.recap.totalSakit}</td>
                                    <td>${userData.recap.totalCuti}</td>
                                    <td>${userData.recap.totalHariKerja}</td>
                                    <td><button class="view-details-btn" data-userid="${userData.userId}">Lihat Detail Harian</button></td>
                                </tr>
                            </tbody>
                        </table>
                    `;
                    reportDataContainer.appendChild(userSection);

                    const detailButton = userSection.querySelector('.view-details-btn');
                    if (detailButton) {
                        detailButton.addEventListener('click', () => {
                            openDailyDetailModal(userData.userName, userData.recap.detailPerHari);
                        });
                    }
                });
                showAdminReportMessage('Laporan berhasil dimuat.', 'success');
            }
            reportOutputArea.style.display = 'block'; // Tampilkan area output

        } catch (error) {
            console.error('Error fetching monthly report:', error);
            showAdminReportMessage(`Error: ${error.message}`, 'error');
            reportOutputArea.style.display = 'none';
        }
    }

    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', fetchAndDisplayMonthlyReport);
    }

    // === 7. LOGIKA MODAL DETAIL HARIAN ===
    function openDailyDetailModal(userName, dailyDetails) {
        if (!dailyDetailModal || !dailyDetailModalTitle || !dailyDetailTableBody) return;

        dailyDetailModalTitle.textContent = `Detail Absensi Harian untuk: ${userName}`;
        dailyDetailTableBody.innerHTML = ''; // Kosongkan isi tabel sebelumnya

        if (!dailyDetails || dailyDetails.length === 0) {
            dailyDetailTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Tidak ada detail harian tersedia.</td></tr>';
        } else {
            dailyDetails.forEach(detail => {
                const row = dailyDetailTableBody.insertRow();
                row.insertCell().textContent = new Date(detail.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                row.insertCell().textContent = detail.status;
                row.insertCell().textContent = detail.clockIn ? new Date(detail.clockIn).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit'}) : '-';
                row.insertCell().textContent = detail.clockOut ? new Date(detail.clockOut).toLocaleTimeString('id-ID',  { hour:'2-digit', minute:'2-digit', second:'2-digit'}) : '-';
                row.insertCell().textContent = detail.latitudeIn && detail.longitudeIn ? `${parseFloat(detail.latitudeIn).toFixed(4)}, ${parseFloat(detail.longitudeIn).toFixed(4)}` : '-';
                row.insertCell().textContent = detail.latitudeOut && detail.longitudeOut ? `${parseFloat(detail.latitudeOut).toFixed(4)}, ${parseFloat(detail.longitudeOut).toFixed(4)}` : '-';
                row.insertCell().textContent = detail.notes || '-';
            });
        }
        dailyDetailModal.style.display = 'block';
    }

    if (closeDailyDetailModalBtn) {
        closeDailyDetailModalBtn.onclick = () => { if(dailyDetailModal) dailyDetailModal.style.display = 'none'; };
    }
    
    // === 8. HELPER UNTUK MENAMPILKAN PESAN ===
    function showAdminReportMessage(message, type = 'info', autohide = true) {
        if (!adminReportMessageArea) return;
        adminReportMessageArea.textContent = message;
        adminReportMessageArea.className = `message ${type}`;
        adminReportMessageArea.style.display = 'block';
        if (autohide) {
            setTimeout(() => { if(adminReportMessageArea) adminReportMessageArea.style.display = 'none'; }, 4000);
        }
    }

    // === 9. INISIALISASI HALAMAN ===
    if (loggedInUser && loggedInUser.role === 'SUPER_ADMIN') {
        populateMonthYearFilters();
        // Anda bisa memilih untuk otomatis memuat laporan bulan ini, atau menunggu user klik tombol.
        // await fetchAndDisplayMonthlyReport(); // Jika ingin otomatis muat laporan bulan ini
    }
    
    // Tutup modal jika klik di luar
    if(dailyDetailModal) {
        window.addEventListener('click', function(event) {
            if (event.target == dailyDetailModal) {
                dailyDetailModal.style.display = "none";
            }
        });
    }
});