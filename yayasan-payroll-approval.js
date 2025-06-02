// yayasan-payroll-approval.js
document.addEventListener('DOMContentLoaded', async () => {
    // API_BASE_URL diasumsikan dari auth_utils.js
    // const API_BASE_URL = 'https://akademik.online';

    const yayasanPayrollInfoArea = document.getElementById('yayasanPayrollInfo');
    const logoutButtonYayasanPayroll = document.getElementById('logoutButtonYayasanPayroll');
    const yayasanPayrollMessageArea = document.getElementById('yayasanPayrollMessageArea');

    const filterPayrollStatusSelect = document.getElementById('filterPayrollStatus');
    const applyPayrollFilterBtn = document.getElementById('applyPayrollFilterBtn');
    const yayasanPayrollRunsTableBody = document.getElementById('yayasanPayrollRunsTableBody');

    const viewEmployeesModal = document.getElementById('viewEmployeesModal');
    const closeViewEmployeesModalBtn = document.getElementById('closeViewEmployeesModalBtn');
    const viewEmployeesModalTitle = document.getElementById('viewEmployeesModalTitle');
    const employeeListInModalDiv = document.getElementById('employeeListInModal');

    const rejectPayrollRunModal = document.getElementById('rejectPayrollRunModal');
    const closeRejectPayrollRunModalBtn = document.getElementById('closeRejectPayrollRunModalBtn');
    const rejectPayrollRunForm = document.getElementById('rejectPayrollRunForm');
    const rejectPayrollRunIdInput = document.getElementById('rejectPayrollRunIdInput');
    const rejectPayrollRunIdDisplay = document.getElementById('rejectPayrollRunIdDisplay');
    const payrollRejectionReasonInput = document.getElementById('payrollRejectionReason');
    const rejectPayrollRunSubmitBtn = document.getElementById('rejectPayrollRunSubmitBtn');
    const rejectPayrollRunModalMessageArea = document.getElementById('rejectPayrollRunModalMessageArea');

    if (typeof performLogoutClientSide !== 'function' || typeof fetchWithAuth !== 'function') {
        console.error("Fungsi autentikasi tidak ditemukan. Pastikan auth_utils.js di-include.");
        if(yayasanPayrollMessageArea) {
            yayasanPayrollMessageArea.textContent = "Kesalahan kritis: Fungsi autentikasi tidak termuat.";
            yayasanPayrollMessageArea.className = 'message error';
            yayasanPayrollMessageArea.style.display = 'block';
        }
        if(applyPayrollFilterBtn) applyPayrollFilterBtn.disabled = true;
        return;
    }

    const loggedInUserString = localStorage.getItem('user');
    if (!loggedInUserString || !localStorage.getItem('accessToken')) {
        performLogoutClientSide('Anda belum login atau sesi telah berakhir.', 'login.html');
        return;
    }
    let loggedInUser;
    try { loggedInUser = JSON.parse(loggedInUserString); }
    catch (e) { performLogoutClientSide('Data sesi tidak valid.', 'login.html'); return; }

    if (!loggedInUser || loggedInUser.role !== 'YAYASAN') {
        showYayasanPayrollMessage('Akses Ditolak: Halaman ini hanya untuk Yayasan.', 'error', false);
        document.querySelector('.filters')?.remove();
        document.querySelector('.list-container')?.remove();
        return;
    }
    if(yayasanPayrollInfoArea) yayasanPayrollInfoArea.textContent = `User: ${loggedInUser.name || loggedInUser.email} (Yayasan)`;

    if (logoutButtonYayasanPayroll) {
        logoutButtonYayasanPayroll.addEventListener('click', async () => {
            const currentRefreshToken = localStorage.getItem('refreshToken');
            logoutButtonYayasanPayroll.disabled = true;
            logoutButtonYayasanPayroll.textContent = 'Logging out...';
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

    async function fetchAndDisplayYayasanPayrollRuns() {
        if (!yayasanPayrollRunsTableBody) return;
        const selectedStatus = filterPayrollStatusSelect ? filterPayrollStatusSelect.value : 'PENDING_APPROVAL';
        yayasanPayrollRunsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">Memuat data payroll runs (${selectedStatus || 'Semua'})...</td></tr>`;
        showYayasanPayrollMessage('Memuat data...', 'info', false);

        let url = `${API_BASE_URL}/api/yayasan/payroll-runs`;
        if (selectedStatus) {
            url += `?status=${selectedStatus}`;
        }

        try {
            const response = await fetchWithAuth(url);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: `Gagal memuat data (Status: ${response.status})` }));
                throw new Error(errData.message);
            }
            const result = await response.json(); // Backend mengembalikan array langsung, atau objek dengan `data`, `currentPage` dll jika paginasi
            const runs = Array.isArray(result) ? result : result.data || []; // Sesuaikan jika backend punya struktur paginasi

            yayasanPayrollRunsTableBody.innerHTML = '';

            if (runs.length === 0) {
                yayasanPayrollRunsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Tidak ada data payroll run ditemukan untuk status "${selectedStatus}".</td></tr>`;
                showYayasanPayrollMessage(`Tidak ada data untuk status "${selectedStatus}".`, 'info');
                return;
            }

            runs.forEach(run => {
                const row = yayasanPayrollRunsTableBody.insertRow();
                row.insertCell().textContent = run.id.substring(0, 8) + '...';
                row.insertCell().textContent = `${new Date(run.periodStart).toLocaleDateString('id-ID')} - ${new Date(run.periodEnd).toLocaleDateString('id-ID')}`;
                row.insertCell().textContent = new Date(run.executionDate).toLocaleString('id-ID', { dateStyle:'medium', timeStyle:'short'});
                row.insertCell().textContent = run.executedBy ? run.executedBy.name : '-';
                
                const statusCell = row.insertCell();
                const statusSpan = document.createElement('span');
                statusSpan.textContent = run.status;
                statusSpan.className = `status-${run.status}`;
                statusCell.appendChild(statusSpan);

                const actionsCell = row.insertCell();
                actionsCell.className = 'actions';

                const viewEmployeesBtn = document.createElement('button');
                viewEmployeesBtn.textContent = 'Lihat Karyawan';
                viewEmployeesBtn.className = 'view-employees-btn';
                viewEmployeesBtn.title = `Lihat daftar karyawan untuk Run ID ${run.id.substring(0,8)}`;
                viewEmployeesBtn.onclick = () => openViewEmployeesModal(run.id, run.periodStart, run.periodEnd);
                actionsCell.appendChild(viewEmployeesBtn);

                if (run.status === 'PENDING_APPROVAL') {
                    const approveBtn = document.createElement('button');
                    approveBtn.textContent = 'Setujui';
                    approveBtn.className = 'approve-payroll-btn';
                    approveBtn.onclick = () => approvePayrollRun(run.id);
                    actionsCell.appendChild(approveBtn);

                    const rejectBtn = document.createElement('button');
                    rejectBtn.textContent = 'Tolak';
                    rejectBtn.className = 'reject-payroll-btn';
                    rejectBtn.onclick = () => openRejectPayrollRunModal(run.id);
                    actionsCell.appendChild(rejectBtn);
                }
            });
            showYayasanPayrollMessage(`Data payroll runs (Status: ${selectedStatus || 'Semua'}) berhasil dimuat.`, 'success');
        } catch (error) {
            console.error('Error fetching yayasan payroll runs:', error);
            if(yayasanPayrollRunsTableBody) yayasanPayrollRunsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Error: ${error.message}</td></tr>`;
            showYayasanPayrollMessage(error.message, 'error');
        }
    }

    if (applyPayrollFilterBtn) {
        applyPayrollFilterBtn.addEventListener('click', fetchAndDisplayYayasanPayrollRuns);
    }

    async function openViewEmployeesModal(runId, periodStart, periodEnd) {
        if (!viewEmployeesModal || !viewEmployeesModalTitle || !employeeListInModalDiv) return;
        const periodText = `${new Date(periodStart).toLocaleDateString('id-ID')} - ${new Date(periodEnd).toLocaleDateString('id-ID')}`;
        viewEmployeesModalTitle.textContent = `Karyawan dalam Payroll Run (${periodText})`;
        employeeListInModalDiv.innerHTML = '<p>Memuat daftar karyawan...</p>';
        viewEmployeesModal.style.display = 'block';

        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/yayasan/payroll-runs/${runId}/employees`);
            if (!response.ok) {
                const err = await response.json().catch(() => ({ message: 'Gagal memuat daftar karyawan.' }));
                throw new Error(err.message);
            }
            const employees = await response.json(); // API backend mengembalikan array objek { name, email, baseSalary }
            
            if (!employees || employees.length === 0) {
                employeeListInModalDiv.innerHTML = '<p>Tidak ada karyawan yang diproses dalam payroll run ini.</p>';
            } else {
                const ul = document.createElement('ul');
                employees.forEach(emp => {
                    const li = document.createElement('li');
                    li.textContent = `${emp.name} (${emp.email}) - Gaji Pokok: ${emp.baseSalary ? parseFloat(emp.baseSalary).toLocaleString('id-ID', {style:'currency', currency:'IDR'}) : 'N/A'}`;
                    ul.appendChild(li);
                });
                employeeListInModalDiv.innerHTML = '';
                employeeListInModalDiv.appendChild(ul);
            }
        } catch (error) {
            console.error("Error fetching employees for run:", error);
            employeeListInModalDiv.innerHTML = `<p style="color:red; text-align:center;">Error: ${error.message}</p>`;
        }
    }
    if (closeViewEmployeesModalBtn) {
        closeViewEmployeesModalBtn.onclick = () => { if(viewEmployeesModal) viewEmployeesModal.style.display = 'none'; };
    }

    async function approvePayrollRun(runId) {
        if (!confirm(`Apakah Anda yakin ingin MENYETUJUI Payroll Run ID: ${runId.substring(0,8)}...?`)) return;
        showYayasanPayrollMessage(`Memproses persetujuan untuk Payroll Run ID: ${runId.substring(0,8)}...`, 'info', false);
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/yayasan/payroll-runs/${runId}/approve`, { method: 'PUT' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Gagal menyetujui Payroll Run.');
            showYayasanPayrollMessage(result.message || 'Payroll Run berhasil disetujui!', 'success');
            await fetchAndDisplayYayasanPayrollRuns();
        } catch (error) {
            console.error('Error approving payroll run:', error);
            showYayasanPayrollMessage(error.message, 'error');
        }
    }

    function openRejectPayrollRunModal(runId) {
        if (!rejectPayrollRunModal || !rejectPayrollRunForm || !rejectPayrollRunIdInput || !rejectPayrollRunIdDisplay || !payrollRejectionReasonInput) return;
        rejectPayrollRunForm.reset();
        rejectPayrollRunIdInput.value = runId;
        rejectPayrollRunIdDisplay.textContent = runId.substring(0,8) + '...';
        if(rejectPayrollRunModalMessageArea) rejectPayrollRunModalMessageArea.style.display = 'none';
        rejectPayrollRunModal.style.display = 'block';
        payrollRejectionReasonInput.focus();
    }

    if (closeRejectPayrollRunModalBtn) {
        closeRejectPayrollRunModalBtn.onclick = () => { if(rejectPayrollRunModal) rejectPayrollRunModal.style.display = 'none'; };
    }

    if (rejectPayrollRunForm) {
        rejectPayrollRunForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!rejectPayrollRunSubmitBtn || !rejectPayrollRunIdInput || !payrollRejectionReasonInput) return;
            const runId = rejectPayrollRunIdInput.value;
            const reason = payrollRejectionReasonInput.value.trim();
            if (!reason) {
                showRejectPayrollRunModalMessage('Alasan penolakan wajib diisi.', 'error'); return;
            }
            rejectPayrollRunSubmitBtn.disabled = true;
            rejectPayrollRunSubmitBtn.textContent = 'Memproses...';
            if(rejectPayrollRunModalMessageArea) rejectPayrollRunModalMessageArea.style.display = 'none';
            try {
                // PASTIKAN ENDPOINT INI ADA DI BACKEND ANDA: PUT /api/yayasan/payroll-runs/[runId]/reject
                const response = await fetchWithAuth(`${API_BASE_URL}/api/yayasan/payroll-runs/${runId}/reject`, {
                    method: 'PUT',
                    body: JSON.stringify({ rejectionReason: reason })
                });
                const result = await response.json();
                if (!response.ok || !result.success) { // Sesuaikan dengan respons API reject Anda
                    throw new Error(result.message || 'Gagal menolak Payroll Run.');
                }
                showRejectPayrollRunModalMessage(result.message || 'Payroll Run berhasil ditolak!', 'success');
                await fetchAndDisplayYayasanPayrollRuns();
                if(rejectPayrollRunModal) setTimeout(() => { rejectPayrollRunModal.style.display = 'none'; }, 1500);
            } catch (error) {
                showRejectPayrollRunModalMessage(error.message, 'error');
            } finally {
                if(rejectPayrollRunSubmitBtn) {
                    rejectPayrollRunSubmitBtn.disabled = false;
                    rejectPayrollRunSubmitBtn.textContent = 'Tolak Proses Ini';
                }
            }
        });
    }

    function showYayasanPayrollMessage(message, type = 'info', autohide = true) {
        if (!yayasanPayrollMessageArea) return;
        yayasanPayrollMessageArea.textContent = message;
        yayasanPayrollMessageArea.className = `message ${type}`;
        yayasanPayrollMessageArea.style.display = 'block';
        if (autohide) setTimeout(() => { if(yayasanPayrollMessageArea) yayasanPayrollMessageArea.style.display = 'none'; }, 4000);
    }
    function showRejectPayrollRunModalMessage(message, type = 'info') {
        if (!rejectPayrollRunModalMessageArea) return;
        rejectPayrollRunModalMessageArea.textContent = message;
        rejectPayrollRunModalMessageArea.className = `message ${type}`;
        rejectPayrollRunModalMessageArea.style.display = 'block';
    }

    if (loggedInUser && loggedInUser.role === 'YAYASAN') {
         if (typeof fetchWithAuth === 'function') {
            await fetchAndDisplayYayasanPayrollRuns();
        } else {
            console.error("Fungsi fetchWithAuth tidak ditemukan.");
            showYayasanPayrollMessage("Error: Fungsi autentikasi tidak termuat.", "error", false);
        }
    }
    
    if (viewEmployeesModal) { window.addEventListener('click', (event) => { if(event.target == viewEmployeesModal) viewEmployeesModal.style.display = "none"; }); }
    if (rejectPayrollRunModal) { window.addEventListener('click', (event) => { if(event.target == rejectPayrollRunModal) rejectPayrollRunModal.style.display = "none"; }); }
});