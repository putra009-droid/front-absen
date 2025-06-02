// admin-attendances.js
document.addEventListener('DOMContentLoaded', async () => {
    // === 1. PENGATURAN DASAR & ELEMEN DOM ===
    // const API_BASE_URL = 'https://akademik.online'; // Jika tidak di auth_utils.js

    const adminAttendancesInfoArea = document.getElementById('adminAttendancesInfo');
    const logoutButtonAdminAttendances = document.getElementById('logoutButtonAdminAttendances');
    const adminAttendancesTableBody = document.getElementById('adminAttendancesTableBody');
    const adminAttendancesMessageArea = document.getElementById('adminAttendancesMessageArea');

    // Filter elements
    const filterUserSelect = document.getElementById('filterUser');
    const filterStartDateInput = document.getElementById('filterStartDate');
    const filterEndDateInput = document.getElementById('filterEndDate');
    const filterStatusSelect = document.getElementById('filterStatus');
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');

    // Pagination elements
    const paginationControls = document.getElementById('paginationControls');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageInfoSpan = document.getElementById('pageInfo');
    let currentPage = 1;
    let totalPages = 1;
    const limitPerPage = 15; // Jumlah item per halaman

    // Modal Ubah Status Manual
    const manualAttendanceStatusModal = document.getElementById('manualAttendanceStatusModal');
    const manualStatusModalTitle = document.getElementById('manualStatusModalTitle');
    const closeManualStatusModalBtn = document.getElementById('closeManualStatusModalBtn');
    const manualAttendanceStatusForm = document.getElementById('manualAttendanceStatusForm');
    const manualStatusUserNameP = document.getElementById('manualStatusUserName');
    const manualStatusUserIdInput = document.getElementById('manualStatusUserId');
    const manualStatusDateInput = document.getElementById('manualStatusDate');
    const manualStatusNewStatusSelect = document.getElementById('manualStatusNewStatus');
    const manualStatusNotesInput = document.getElementById('manualStatusNotes');
    const manualStatusSubmitBtn = document.getElementById('manualStatusSubmitBtn');
    const manualStatusModalMessageArea = document.getElementById('manualStatusModalMessageArea');
    
    // Status yang bisa di-set manual oleh admin
    const manualSetStatuses = ['IZIN', 'SAKIT', 'ALPHA', 'CUTI'];
    // Semua status absensi (untuk filter)
    const allAttendanceStatuses = ['HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'ALPHA', 'CUTI', 'SELESAI', 'BELUM'];


    // === 2. FUNGSI AUTENTIKASI (DIASUMSIKAN DARI auth_utils.js) ===
    // Pastikan `fetchWithAuth` dan `performLogoutClientSide` tersedia global

    // === 3. PENGECEKAN AUTENTIKASI & OTORISASI ADMIN ===
    // ... (Salin blok pengecekan otorisasi SUPER_ADMIN dari admin.js atau settings.js)
    // Ganti pesan error dan elemen yang disembunyikan jika perlu
    const loggedInUserString = localStorage.getItem('user');
    if (!loggedInUserString || !localStorage.getItem('accessToken')) {
        performLogoutClientSide('Anda belum login atau sesi telah berakhir.', 'login.html');
        return;
    }
    let loggedInUser;
    try {
        loggedInUser = JSON.parse(loggedInUserString);
    } catch (e) {
        performLogoutClientSide('Data sesi tidak valid.', 'login.html');
        return;
    }

    if (!loggedInUser || loggedInUser.role !== 'SUPER_ADMIN') {
        showAdminAttendancesMessage('Akses Ditolak: Halaman ini hanya untuk SUPER_ADMIN.', 'error');
        document.querySelector('.filters')?.remove();
        document.querySelector('.list-container')?.remove();
        return;
    }
    if(adminAttendancesInfoArea) adminAttendancesInfoArea.textContent = `Admin: ${loggedInUser.name || loggedInUser.email}`;


    // === 4. FUNGSI LOGOUT ===
    // ... (Salin fungsi logout dari admin.js atau settings.js, sesuaikan ID tombol jika berbeda)
    if (logoutButtonAdminAttendances) {
        logoutButtonAdminAttendances.addEventListener('click', async () => {
            const currentRefreshToken = localStorage.getItem('refreshToken');
            logoutButtonAdminAttendances.disabled = true;
            logoutButtonAdminAttendances.textContent = 'Logging out...';
            try {
                await fetchWithAuth(`${API_BASE_URL}/api/logout`, {
                    method: 'POST',
                    body: JSON.stringify({ refreshToken: currentRefreshToken })
                });
            } catch (error) { console.error('Error API logout:', error);
            } finally {
                performLogoutClientSide('Anda telah logout.', 'login.html');
            }
        });
    }

    // === 5. FUNGSI UNTUK MENGISI DROPDOWN FILTER ===
    async function populateFilterDropdowns() {
        // Isi filter pengguna
        if (filterUserSelect) {
            try {
                const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users`);
                if (!response.ok) throw new Error('Gagal memuat daftar pengguna untuk filter.');
                const users = await response.json();
                users.sort((a, b) => a.name.localeCompare(b.name)); // Urutkan berdasarkan nama
                users.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = `${user.name} (${user.email})`;
                    filterUserSelect.appendChild(option);
                });
            } catch (error) {
                console.error("Error populating user filter:", error);
                showAdminAttendancesMessage("Gagal memuat daftar pengguna untuk filter.", "error");
            }
        }
        // Isi filter status
        if (filterStatusSelect) {
            allAttendanceStatuses.forEach(status => {
                const option = document.createElement('option');
                option.value = status;
                option.textContent = status;
                filterStatusSelect.appendChild(option);
            });
        }
        // Isi dropdown status di modal manual
        if (manualStatusNewStatusSelect) {
            manualSetStatuses.forEach(status => {
                const option = document.createElement('option');
                option.value = status;
                option.textContent = status;
                manualStatusNewStatusSelect.appendChild(option);
            });
        }
    }

    // === 6. FUNGSI UNTUK MENGAMBIL DAN MENAMPILKAN DATA ABSENSI ===
    async function fetchAndDisplayAttendances(page = 1) {
        if (!adminAttendancesTableBody || !pageInfoSpan || !prevPageBtn || !nextPageBtn) return;
        currentPage = page;
        adminAttendancesTableBody.innerHTML = `<tr><td colspan="11" style="text-align:center;">Memuat data absensi...</td></tr>`;
        showAdminAttendancesMessage('Memuat data...', 'info', false);

        const params = new URLSearchParams({
            page: currentPage.toString(),
            limit: limitPerPage.toString(),
        });

        if (filterUserSelect && filterUserSelect.value) params.append('userId', filterUserSelect.value);
        if (filterStartDateInput && filterStartDateInput.value) params.append('startDate', filterStartDateInput.value);
        if (filterEndDateInput && filterEndDateInput.value) params.append('endDate', filterEndDateInput.value);
        if (filterStatusSelect && filterStatusSelect.value) params.append('status', filterStatusSelect.value);

        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/attendances?${params.toString()}`);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: `Gagal memuat data absensi (Status: ${response.status})` }));
                throw new Error(errData.message);
            }
            const result = await response.json();
            const attendances = result.data;
            totalPages = result.totalPages || 1;

            adminAttendancesTableBody.innerHTML = '';
            if (attendances.length === 0) {
                adminAttendancesTableBody.innerHTML = `<tr><td colspan="11" style="text-align:center;">Tidak ada data absensi ditemukan untuk filter ini.</td></tr>`;
                showAdminAttendancesMessage('Tidak ada data absensi ditemukan.', 'info');
            } else {
                attendances.forEach((att, index) => {
                    const row = adminAttendancesTableBody.insertRow();
                    row.insertCell().textContent = (currentPage - 1) * limitPerPage + index + 1;
                    row.insertCell().textContent = att.clockIn ? new Date(att.clockIn).toLocaleDateString('id-ID') : '-';
                    row.insertCell().textContent = att.user ? att.user.name : 'N/A';
                    row.insertCell().textContent = att.user ? att.user.email : 'N/A';
                    row.insertCell().textContent = att.clockIn ? new Date(att.clockIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second:'2-digit' }) : '-';
                    row.insertCell().textContent = att.clockOut ? new Date(att.clockOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second:'2-digit' }) : '-';
                    row.insertCell().textContent = att.status;
                    row.insertCell().textContent = att.notes || '-';
                    row.insertCell().textContent = att.latitudeIn && att.longitudeIn ? `${parseFloat(att.latitudeIn).toFixed(4)}, ${parseFloat(att.longitudeIn).toFixed(4)}` : '-';
                    row.insertCell().textContent = att.latitudeOut && att.longitudeOut ? `${parseFloat(att.latitudeOut).toFixed(4)}, ${parseFloat(att.longitudeOut).toFixed(4)}` : '-';
                    
                    const actionsCell = row.insertCell();
                    actionsCell.className = 'actions';
                    const changeStatusBtn = document.createElement('button');
                    changeStatusBtn.textContent = 'Ubah Status';
                    changeStatusBtn.className = 'change-status-btn';
                    changeStatusBtn.onclick = () => openManualStatusModal(att.user, att.clockIn ? new Date(att.clockIn).toISOString().split('T')[0] : null, att.id);
                    actionsCell.appendChild(changeStatusBtn);
                });
                showAdminAttendancesMessage(`Data absensi (Halaman ${currentPage}/${totalPages}) berhasil dimuat.`, 'success');
            }
            updatePaginationControls();
        } catch (error) {
            console.error('Error fetching admin attendances:', error);
            adminAttendancesTableBody.innerHTML = `<tr><td colspan="11" style="text-align:center;">Error: ${error.message}</td></tr>`;
            showAdminAttendancesMessage(error.message, 'error');
        }
    }
    
    // === 7. FUNGSI UNTUK UPDATE KONTROL PAGINASI ===
    function updatePaginationControls() {
        if (!pageInfoSpan || !prevPageBtn || !nextPageBtn) return;
        pageInfoSpan.textContent = `Halaman ${currentPage} dari ${totalPages}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    }

    // Event listener untuk tombol paginasi
    if (prevPageBtn) prevPageBtn.addEventListener('click', () => { if (currentPage > 1) fetchAndDisplayAttendances(currentPage - 1); });
    if (nextPageBtn) nextPageBtn.addEventListener('click', () => { if (currentPage < totalPages) fetchAndDisplayAttendances(currentPage + 1); });

    // Event listener untuk filter
    if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', () => fetchAndDisplayAttendances(1)); // Selalu ke halaman 1 saat filter baru
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            if(filterUserSelect) filterUserSelect.value = '';
            if(filterStartDateInput) filterStartDateInput.value = '';
            if(filterEndDateInput) filterEndDateInput.value = '';
            if(filterStatusSelect) filterStatusSelect.value = '';
            fetchAndDisplayAttendances(1);
        });
    }

    // === 8. LOGIKA MODAL UBAH STATUS MANUAL ===
    function openManualStatusModal(user, dateString, recordId = null) {
        if (!manualAttendanceStatusModal || !manualAttendanceStatusForm || !manualStatusUserNameP || !manualStatusUserIdInput || !manualStatusDateInput || !manualStatusNewStatusSelect || !manualStatusNotesInput) return;
        
        manualAttendanceStatusForm.reset();
        manualStatusUserNameP.textContent = user ? `${user.name} (${user.email})` : 'Karyawan tidak terpilih';
        manualStatusUserIdInput.value = user ? user.id : '';
        
        // Set tanggal: jika ada dateString, gunakan itu. Jika tidak, gunakan hari ini.
        const targetDate = dateString ? new Date(dateString) : new Date();
        // Format tanggal ke YYYY-MM-DD untuk input type="date"
        const year = targetDate.getFullYear();
        const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
        const day = targetDate.getDate().toString().padStart(2, '0');
        manualStatusDateInput.value = `${year}-${month}-${day}`;

        // Jika ada recordId, kita mungkin ingin memuat status & catatan yang ada (tapi API POST hanya untuk set baru)
        // Untuk API POST /api/admin/attendance/status, recordId tidak terlalu relevan di frontend form ini
        // karena API akan mencari atau membuat record berdasarkan userId dan date.
        // document.getElementById('manualStatusRecordId').value = recordId || ''; 

        if(manualStatusModalMessageArea) manualStatusModalMessageArea.style.display = 'none';
        manualAttendanceStatusModal.style.display = 'block';
    }

    if (closeManualStatusModalBtn) {
        closeManualStatusModalBtn.onclick = () => { if(manualAttendanceStatusModal) manualAttendanceStatusModal.style.display = 'none'; };
    }

    if (manualAttendanceStatusForm) {
        manualAttendanceStatusForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!manualStatusSubmitBtn || !manualStatusUserIdInput || !manualStatusDateInput || !manualStatusNewStatusSelect) return;

            manualStatusSubmitBtn.disabled = true;
            manualStatusSubmitBtn.textContent = 'Menyimpan...';
            if (manualStatusModalMessageArea) manualStatusModalMessageArea.style.display = 'none';

            const payload = {
                userId: manualStatusUserIdInput.value,
                date: manualStatusDateInput.value,
                status: manualStatusNewStatusSelect.value,
                notes: manualStatusNotesInput ? manualStatusNotesInput.value : null,
            };

            if (!payload.userId || !payload.date || !payload.status) {
                showManualStatusModalMessage('User, Tanggal, dan Status Baru wajib diisi.', 'error');
                finalizeManualStatusSubmit(); return;
            }

            try {
                const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/attendance/status`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                if (!response.ok) { // API backend Anda mengembalikan 200 atau 201 jika sukses
                    throw new Error(result.message || `Gagal mengubah status absensi.`);
                }
                showManualStatusModalMessage(result.message || 'Status absensi berhasil diperbarui!', 'success');
                await fetchAndDisplayAttendances(currentPage); // Refresh tabel
                if(manualAttendanceStatusModal) {
                    setTimeout(() => {
                        manualAttendanceStatusModal.style.display = 'none';
                    }, 1500);
                }
            } catch (error) {
                showManualStatusModalMessage(error.message, 'error');
            } finally {
                finalizeManualStatusSubmit();
            }

            function finalizeManualStatusSubmit() {
                if(manualStatusSubmitBtn) {
                    manualStatusSubmitBtn.disabled = false;
                    manualStatusSubmitBtn.textContent = 'Simpan Status';
                }
            }
        });
    }

    // === 9. HELPER UNTUK MENAMPILKAN PESAN ===
    function showAdminAttendancesMessage(message, type = 'info', autohide = true) {
        if (!adminAttendancesMessageArea) return;
        adminAttendancesMessageArea.textContent = message;
        adminAttendancesMessageArea.className = `message ${type}`;
        adminAttendancesMessageArea.style.display = 'block';
        if (autohide) {
            setTimeout(() => { adminAttendancesMessageArea.style.display = 'none'; }, 4000);
        }
    }
    function showManualStatusModalMessage(message, type = 'info') {
        if (!manualStatusModalMessageArea) return;
        manualStatusModalMessageArea.textContent = message;
        manualStatusModalMessageArea.className = `message ${type}`;
        manualStatusModalMessageArea.style.display = 'block';
    }

    // === 10. INISIALISASI HALAMAN ===
    if (loggedInUser && loggedInUser.role === 'SUPER_ADMIN') {
        if (typeof fetchWithAuth === 'function') {
            await populateFilterDropdowns();
            await fetchAndDisplayAttendances(1); // Muat data halaman pertama saat load
        } else {
            console.error("Fungsi fetchWithAuth tidak ditemukan. Pastikan auth_utils.js di-include.");
            showAdminAttendancesMessage("Error: Fungsi autentikasi tidak termuat.", "error", false);
        }
    }
    
    // Tutup modal jika klik di luar area konten modal
    if (manualAttendanceStatusModal) {
        window.addEventListener('click', function(event) {
            if (event.target == manualAttendanceStatusModal) {
                manualAttendanceStatusModal.style.display = "none";
            }
        });
    }
});