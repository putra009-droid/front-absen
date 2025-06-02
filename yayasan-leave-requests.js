// yayasan-leave-requests.js
document.addEventListener('DOMContentLoaded', async () => {
    // === 1. PENGATURAN DASAR & ELEMEN DOM ===
    // const API_BASE_URL = 'https://akademik.online'; // Jika tidak di auth_utils.js

    const yayasanLeaveInfoArea = document.getElementById('yayasanLeaveInfo');
    const logoutButtonYayasanLeave = document.getElementById('logoutButtonYayasanLeave');
    const pendingLeaveRequestsTableBody = document.getElementById('pendingLeaveRequestsTableBody');
    const yayasanLeaveMessageArea = document.getElementById('yayasanLeaveMessageArea');

    // Elemen Modal Penolakan
    const rejectLeaveModal = document.getElementById('rejectLeaveModal');
    const rejectLeaveModalTitle = document.getElementById('rejectLeaveModalTitle'); // Tidak dipakai, tapi bisa untuk info
    const closeRejectLeaveModalBtn = document.getElementById('closeRejectLeaveModalBtn');
    const rejectLeaveForm = document.getElementById('rejectLeaveForm');
    const rejectLeaveRequestIdInput = document.getElementById('rejectLeaveRequestId');
    const rejectLeaveUserNameSpan = document.getElementById('rejectLeaveUserName');
    const rejectionReasonInput = document.getElementById('rejectionReason');
    const rejectLeaveSubmitBtn = document.getElementById('rejectLeaveSubmitBtn');
    const rejectLeaveModalMessageArea = document.getElementById('rejectLeaveModalMessageArea');

    // === 2. FUNGSI AUTENTIKASI (DIASUMSIKAN DARI auth_utils.js) ===
    // Pastikan `fetchWithAuth` dan `performLogoutClientSide` tersedia global

    // === 3. PENGECEKAN AUTENTIKASI & OTORISASI YAYASAN ===
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

    if (!loggedInUser || loggedInUser.role !== 'YAYASAN') { // Pastikan role YAYASAN
        showYayasanLeaveMessage('Akses Ditolak: Halaman ini hanya untuk Yayasan.', 'error');
        document.querySelector('.list-container')?.remove();
        return;
    }
    if(yayasanLeaveInfoArea) yayasanLeaveInfoArea.textContent = `User: ${loggedInUser.name || loggedInUser.email} (Yayasan)`;

    // === 4. FUNGSI LOGOUT ===
    if (logoutButtonYayasanLeave) {
        logoutButtonYayasanLeave.addEventListener('click', async () => {
            const currentRefreshToken = localStorage.getItem('refreshToken');
            // ... (Logika logout standar, panggil performLogoutClientSide)
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

    // === 5. FUNGSI UNTUK MENGAMBIL DAN MENAMPILKAN PENGAJUAN IZIN PENDING ===
    async function fetchAndDisplayPendingLeaveRequests() {
        if (!pendingLeaveRequestsTableBody) return;
        pendingLeaveRequestsTableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Memuat data pengajuan izin...</td></tr>';
        showYayasanLeaveMessage('Memuat data...', 'info', false);

        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/yayasan/leave-requests`); // GET default ke PENDING_APPROVAL
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: `Gagal memuat pengajuan izin (Status: ${response.status})` }));
                throw new Error(errData.message);
            }
            const requests = await response.json();
            pendingLeaveRequestsTableBody.innerHTML = '';

            if (requests.length === 0) {
                pendingLeaveRequestsTableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Tidak ada pengajuan izin yang menunggu persetujuan.</td></tr>';
                showYayasanLeaveMessage('Tidak ada pengajuan izin pending.', 'info');
                return;
            }

            requests.forEach((req, index) => {
                const row = pendingLeaveRequestsTableBody.insertRow();
                row.insertCell().textContent = index + 1;
                row.insertCell().textContent = new Date(req.requestedAt).toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'});
                row.insertCell().textContent = req.user ? req.user.name : 'N/A';
                row.insertCell().textContent = req.user ? req.user.email : 'N/A';
                row.insertCell().textContent = req.leaveType; // Ini adalah enum AttendanceStatus
                row.insertCell().textContent = new Date(req.startDate).toLocaleDateString('id-ID');
                row.insertCell().textContent = new Date(req.endDate).toLocaleDateString('id-ID');
                row.insertCell().textContent = req.reason;

                const attachmentCell = row.insertCell();
                if (req.attachmentUrl) {
                    const link = document.createElement('a');
                    link.href = `${API_BASE_URL}${req.attachmentUrl}`; // Asumsi API_BASE_URL + path sudah benar
                    link.textContent = 'Lihat';
                    link.target = '_blank';
                    link.className = 'view-attachment-btn';
                    attachmentCell.appendChild(link);
                } else {
                    attachmentCell.textContent = '-';
                }
                
                const actionsCell = row.insertCell();
                actionsCell.className = 'actions';

                const approveBtn = document.createElement('button');
                approveBtn.textContent = 'Setujui';
                approveBtn.className = 'approve-btn';
                approveBtn.onclick = () => approveLeaveRequest(req.id, req.user.name);
                actionsCell.appendChild(approveBtn);

                const rejectBtn = document.createElement('button');
                rejectBtn.textContent = 'Tolak';
                rejectBtn.className = 'reject-btn';
                rejectBtn.onclick = () => openRejectLeaveModal(req);
                actionsCell.appendChild(rejectBtn);
            });
            showYayasanLeaveMessage('Data pengajuan izin berhasil dimuat.', 'success');
        } catch (error) {
            console.error('Error fetching pending leave requests:', error);
            if(pendingLeaveRequestsTableBody) pendingLeaveRequestsTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center;">Error: ${error.message}</td></tr>`;
            showYayasanLeaveMessage(error.message, 'error');
        }
    }

    // === 6. FUNGSI UNTUK MENYETUJUI PENGAJUAN IZIN ===
    async function approveLeaveRequest(leaveRequestId, userName) {
        if (!confirm(`Apakah Anda yakin ingin MENYETUJUI pengajuan izin untuk ${userName}?`)) {
            return;
        }
        showYayasanLeaveMessage(`Memproses persetujuan untuk ${userName}...`, 'info', false);
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/yayasan/leave-requests/${leaveRequestId}/approve`, {
                method: 'PUT' // API menggunakan PUT
            });
            const result = await response.json();
            if (!response.ok) { // API mengembalikan status 200 jika sukses
                throw new Error(result.message || 'Gagal menyetujui pengajuan izin.');
            }
            showYayasanLeaveMessage(result.message || 'Pengajuan izin berhasil disetujui!', 'success');
            await fetchAndDisplayPendingLeaveRequests(); // Refresh daftar
        } catch (error) {
            console.error('Error approving leave request:', error);
            showYayasanLeaveMessage(error.message, 'error');
        }
    }

    // === 7. LOGIKA MODAL PENOLAKAN IZIN ===
    function openRejectLeaveModal(request) {
        if (!rejectLeaveModal || !rejectLeaveForm || !rejectLeaveRequestIdInput || !rejectLeaveUserNameSpan || !rejectionReasonInput) return;
        rejectLeaveForm.reset();
        rejectLeaveRequestIdInput.value = request.id;
        rejectLeaveUserNameSpan.textContent = request.user ? request.user.name : 'Karyawan';
        if(rejectLeaveModalMessageArea) rejectLeaveModalMessageArea.style.display = 'none';
        rejectLeaveModal.style.display = 'block';
        rejectionReasonInput.focus();
    }

    if (closeRejectLeaveModalBtn) {
        closeRejectLeaveModalBtn.onclick = () => { if(rejectLeaveModal) rejectLeaveModal.style.display = 'none'; };
    }

    if (rejectLeaveForm) {
        rejectLeaveForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!rejectLeaveSubmitBtn || !rejectLeaveRequestIdInput || !rejectionReasonInput) return;

            const leaveRequestId = rejectLeaveRequestIdInput.value;
            const reason = rejectionReasonInput.value.trim();

            if (!reason) {
                showRejectLeaveModalMessage('Alasan penolakan wajib diisi.', 'error');
                return;
            }

            rejectLeaveSubmitBtn.disabled = true;
            rejectLeaveSubmitBtn.textContent = 'Memproses...';
            if(rejectLeaveModalMessageArea) rejectLeaveModalMessageArea.style.display = 'none';

            try {
                const response = await fetchWithAuth(`${API_BASE_URL}/api/yayasan/leave-requests/${leaveRequestId}/reject`, {
                    method: 'PUT', // API menggunakan PUT
                    body: JSON.stringify({ rejectionReason: reason })
                });
                const result = await response.json(); // API mengembalikan `success: true/false`
                if (!response.ok || !result.success) {
                    throw new Error(result.message || 'Gagal menolak pengajuan izin.');
                }
                showRejectLeaveModalMessage(result.message || 'Pengajuan izin berhasil ditolak!', 'success');
                await fetchAndDisplayPendingLeaveRequests(); // Refresh daftar
                if(rejectLeaveModal) {
                    setTimeout(() => {
                        rejectLeaveModal.style.display = 'none';
                    }, 1500);
                }
            } catch (error) {
                showRejectLeaveModalMessage(error.message, 'error');
            } finally {
                if(rejectLeaveSubmitBtn) {
                    rejectLeaveSubmitBtn.disabled = false;
                    rejectLeaveSubmitBtn.textContent = 'Tolak Pengajuan';
                }
            }
        });
    }

    // === 8. HELPER UNTUK MENAMPILKAN PESAN ===
    function showYayasanLeaveMessage(message, type = 'info', autohide = true) {
        if (!yayasanLeaveMessageArea) return;
        yayasanLeaveMessageArea.textContent = message;
        yayasanLeaveMessageArea.className = `message ${type}`;
        yayasanLeaveMessageArea.style.display = 'block';
        if (autohide) {
            setTimeout(() => { yayasanLeaveMessageArea.style.display = 'none'; }, 4000);
        }
    }
    function showRejectLeaveModalMessage(message, type = 'info') {
        if (!rejectLeaveModalMessageArea) return;
        rejectLeaveModalMessageArea.textContent = message;
        rejectLeaveModalMessageArea.className = `message ${type}`;
        rejectLeaveModalMessageArea.style.display = 'block';
    }

    // === 9. INISIALISASI HALAMAN ===
    if (loggedInUser && loggedInUser.role === 'YAYASAN') {
         if (typeof fetchWithAuth === 'function') {
            await fetchAndDisplayPendingLeaveRequests();
        } else {
            console.error("Fungsi fetchWithAuth tidak ditemukan. Pastikan auth_utils.js di-include.");
            showYayasanLeaveMessage("Error: Fungsi autentikasi tidak termuat.", "error", false);
        }
    }

    // Tutup modal jika klik di luar
    if (rejectLeaveModal) {
        window.addEventListener('click', function(event) {
            if (event.target == rejectLeaveModal) {
                rejectLeaveModal.style.display = "none";
            }
        });
    }
});