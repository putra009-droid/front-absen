// admin-payroll-runs.js
document.addEventListener('DOMContentLoaded', async () => {
    // API_BASE_URL diasumsikan tersedia dari auth_utils.js atau didefinisikan di sana.
    // Jika tidak, uncomment dan set di sini:
    // const API_BASE_URL = 'https://akademik.online';

    const adminPayrollInfoArea = document.getElementById('adminPayrollInfo');
    const logoutButtonAdminPayroll = document.getElementById('logoutButtonAdminPayroll');
    const adminPayrollMessageArea = document.getElementById('adminPayrollMessageArea');

    // Form Start Payroll Run
    const startPayrollRunForm = document.getElementById('startPayrollRunForm');
    const periodStartInput = document.getElementById('periodStart');
    const periodEndInput = document.getElementById('periodEnd');
    const userIdsInput = document.getElementById('userIds'); // Textarea untuk user IDs
    const runPayrollBtn = document.getElementById('runPayrollBtn');

    // Tabel Histori Payroll Runs
    const payrollRunsTableBody = document.getElementById('payrollRunsTableBody');

    // Modal Detail Payroll Run
    const payrollRunDetailsModal = document.getElementById('payrollRunDetailsModal');
    const closePayrollRunDetailsModalBtn = document.getElementById('closePayrollRunDetailsModalBtn');
    const payrollRunDetailsModalTitle = document.getElementById('payrollRunDetailsModalTitle');
    const modalRunPeriodSpan = document.getElementById('modalRunPeriod');
    const modalRunStatusSpan = document.getElementById('modalRunStatus');
    const payslipDetailsTableBody = document.getElementById('payslipDetailsTableBody');

    // Pengecekan fungsi autentikasi dari auth_utils.js
    if (typeof performLogoutClientSide !== 'function' || typeof fetchWithAuth !== 'function') {
        console.error("Fungsi autentikasi (performLogoutClientSide atau fetchWithAuth) tidak ditemukan. Pastikan auth_utils.js di-include dengan benar sebelum skrip ini.");
        if(adminPayrollMessageArea) {
            adminPayrollMessageArea.textContent = "Kesalahan kritis: Fungsi autentikasi tidak termuat.";
            adminPayrollMessageArea.className = 'message error';
            adminPayrollMessageArea.style.display = 'block';
        }
        // Nonaktifkan fungsionalitas utama jika auth tidak ada
        if(startPayrollRunForm) startPayrollRunForm.style.display = 'none';
        if(document.querySelector('.payroll-history')) document.querySelector('.payroll-history').style.display = 'none';
        return;
    }

    // === PENGECEKAN AUTENTIKASI & OTORISASI ADMIN ===
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
        showAdminPayrollMessage('Akses Ditolak: Halaman ini hanya untuk SUPER_ADMIN.', 'error', false);
        if(startPayrollRunForm) startPayrollRunForm.style.display = 'none';
        if(document.querySelector('.payroll-history')) document.querySelector('.payroll-history').style.display = 'none';
        return;
    }
    if(adminPayrollInfoArea) adminPayrollInfoArea.textContent = `Admin: ${loggedInUser.name || loggedInUser.email}`;

    // === FUNGSI LOGOUT ===
    if (logoutButtonAdminPayroll) {
        logoutButtonAdminPayroll.addEventListener('click', async () => {
            const currentRefreshToken = localStorage.getItem('refreshToken');
            logoutButtonAdminPayroll.disabled = true;
            logoutButtonAdminPayroll.textContent = 'Logging out...';
            try {
                await fetchWithAuth(`${API_BASE_URL}/api/logout`, { // API_BASE_URL dari auth_utils.js
                    method: 'POST',
                    body: JSON.stringify({ refreshToken: currentRefreshToken })
                });
            } catch (error) {
                console.error('Error saat API logout:', error);
            } finally {
                performLogoutClientSide('Anda telah logout.', 'login.html');
            }
        });
    }

    // === FUNGSI UNTUK MEMULAI PAYROLL RUN BARU ===
    if (startPayrollRunForm) {
        startPayrollRunForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!periodStartInput || !periodEndInput || !userIdsInput || !runPayrollBtn) return;

            runPayrollBtn.disabled = true;
            runPayrollBtn.textContent = 'Memproses...';
            showAdminPayrollMessage('Memulai proses penggajian, ini mungkin memerlukan waktu...', 'info', false);

            const periodStart = periodStartInput.value;
            const periodEnd = periodEndInput.value;
            const userIdsText = userIdsInput.value.trim();
            const userIdsArray = userIdsText ? userIdsText.split(',').map(id => id.trim()).filter(id => id) : undefined;

            if (!periodStart || !periodEnd) {
                showAdminPayrollMessage('Tanggal Mulai dan Tanggal Akhir periode wajib diisi.', 'error');
                finalizeRunButton(); return;
            }
            if (new Date(periodStart) > new Date(periodEnd)) {
                showAdminPayrollMessage('Tanggal Mulai tidak boleh setelah Tanggal Akhir.', 'error');
                finalizeRunButton(); return;
            }

            const payload = { periodStart, periodEnd };
            if (userIdsArray && userIdsArray.length > 0) {
                payload.userIds = userIdsArray;
            }

            try {
                const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/payroll-runs`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.message || `Gagal memulai proses penggajian (Status: ${response.status})`);
                }
                let successMessage = result.message || 'Proses penggajian berhasil dimulai dan menunggu persetujuan Yayasan.';
                if (result.data && result.data.failedUsers && result.data.failedUsers.length > 0) {
                    successMessage += ` ${result.data.failedUsers.length} karyawan gagal/dilewati. Rincian kegagalan: ${result.data.failedUsers.map(f => `${f.id} (${f.reason})`).join(', ')}`;
                }
                showAdminPayrollMessage(successMessage, 'success', false);
                if(startPayrollRunForm) startPayrollRunForm.reset();
                await fetchAndDisplayPayrollRuns();
            } catch (error) {
                console.error('Error starting payroll run:', error);
                showAdminPayrollMessage(error.message, 'error', false);
            } finally {
                finalizeRunButton();
            }

            function finalizeRunButton() {
                if(runPayrollBtn) {
                    runPayrollBtn.disabled = false;
                    runPayrollBtn.textContent = 'Jalankan Proses Penggajian';
                }
            }
        });
    }

    // === FUNGSI UNTUK MENGAMBIL DAN MENAMPILKAN HISTORI PAYROLL RUNS ===
    async function fetchAndDisplayPayrollRuns() {
        if (!payrollRunsTableBody) return;
        payrollRunsTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Memuat histori payroll...</td></tr>`;
        try {
            // Asumsi backend /api/admin/payroll-runs sudah include payslips dan user di dalamnya
            const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/payroll-runs`);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: `Gagal memuat histori (Status: ${response.status})`}));
                throw new Error(errData.message);
            }
            const runs = await response.json(); // Ini adalah 'formattedRuns' dari backend
            payrollRunsTableBody.innerHTML = '';

            if (runs.length === 0) {
                payrollRunsTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Belum ada histori proses penggajian.</td></tr>`;
                return;
            }

            runs.forEach(run => {
                const row = payrollRunsTableBody.insertRow();
                row.insertCell().textContent = run.id.substring(0, 8) + '...';
                row.insertCell().textContent = `${new Date(run.periodStart).toLocaleDateString('id-ID')} - ${new Date(run.periodEnd).toLocaleDateString('id-ID')}`;
                row.insertCell().textContent = new Date(run.executionDate).toLocaleString('id-ID', { dateStyle:'medium', timeStyle:'short'});
                
                const statusCell = row.insertCell();
                statusCell.textContent = run.status;
                statusCell.className = `status-${run.status}`;

                row.insertCell().textContent = run.executedBy ? run.executedBy.name : '-';
                row.insertCell().textContent = run.approvedByName || (run.rejectedByName || '-');
                row.insertCell().textContent = run.approvedAt ? new Date(run.approvedAt).toLocaleDateString('id-ID') : (run.rejectedAt ? new Date(run.rejectedAt).toLocaleDateString('id-ID') : '-');
                row.insertCell().textContent = run.rejectionReason || '-';

                const actionsCell = row.insertCell();
                actionsCell.className = 'actions';

                const viewDetailsBtn = document.createElement('button');
                viewDetailsBtn.textContent = 'Detail Karyawan';
                viewDetailsBtn.className = 'view-details-btn';
                viewDetailsBtn.onclick = () => openPayrollRunDetailsModal(run); // 'run' sudah berisi payslips
                actionsCell.appendChild(viewDetailsBtn);

                const exportPdfBtn = document.createElement('button');
                exportPdfBtn.textContent = 'Export PDF Run';
                exportPdfBtn.className = 'export-pdf-btn';
                const safePeriodStart = new Date(run.periodStart).toISOString().split('T')[0];
                const filenameRun = `payroll_run_${run.id.substring(0,8)}_${safePeriodStart}.pdf`;
                exportPdfBtn.onclick = () => handleExportPdf(
                    `${API_BASE_URL}/api/admin/payroll-runs/${run.id}/export-pdf`,
                    filenameRun
                );
                actionsCell.appendChild(exportPdfBtn);
            });
        } catch (error) {
            console.error('Error fetching payroll runs:', error);
            if(payrollRunsTableBody) payrollRunsTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Error: ${error.message}</td></tr>`;
            showAdminPayrollMessage(error.message, 'error');
        }
    }
    
    // === FUNGSI EXPORT PDF (dari respons sebelumnya) ===
    async function handleExportPdf(exportUrl, defaultFilename) {
        showAdminPayrollMessage(`Memproses export PDF: ${defaultFilename}...`, 'info', false);
        try {
            const response = await fetchWithAuth(exportUrl);
            if (!response.ok) {
                let errorJson;
                try { errorJson = await response.json(); } catch (e) {
                    throw new Error(`Gagal mengunduh PDF. Status: ${response.status} ${response.statusText}. Server tidak mengirim JSON error.`);
                }
                throw new Error(errorJson.message || `Gagal mengunduh PDF (Status: ${response.status})`);
            }
            const blob = await response.blob();
            if (blob.type !== "application/pdf") {
                const errorText = await blob.text();
                let parsedError;
                try { parsedError = JSON.parse(errorText);
                    throw new Error(parsedError.message || "Server mengembalikan tipe konten yang tidak diharapkan (bukan PDF).");
                } catch (e) {
                     throw new Error("Server mengembalikan tipe konten yang tidak diharapkan dan bukan JSON error yang valid.");
                }
            }
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none'; a.href = url; a.download = defaultFilename;
            document.body.appendChild(a); a.click();
            window.URL.revokeObjectURL(url); a.remove();
            showAdminPayrollMessage('PDF berhasil diunduh.', 'success');
        } catch (error) {
            console.error('Error exporting PDF:', error);
            showAdminPayrollMessage(`Gagal export PDF: ${error.message}`, 'error', false);
        }
    }

    // === FUNGSI MODAL DETAIL PAYROLL RUN ===
    async function openPayrollRunDetailsModal(run) { // 'run' objek dari daftar, diharapkan sudah ada 'payslips'
        if (!payrollRunDetailsModal || !payrollRunDetailsModalTitle || !modalRunPeriodSpan || !modalRunStatusSpan || !payslipDetailsTableBody) return;

        payrollRunDetailsModalTitle.textContent = `Detail Slip Gaji - Run ID: ${run.id.substring(0,8)}...`;
        modalRunPeriodSpan.textContent = `${new Date(run.periodStart).toLocaleDateString('id-ID')} - ${new Date(run.periodEnd).toLocaleDateString('id-ID')}`;
        modalRunStatusSpan.textContent = run.status;
        modalRunStatusSpan.className = `status-${run.status}`;
        payslipDetailsTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center;">Memuat detail slip gaji...</td></tr>`;
        payrollRunDetailsModal.style.display = 'block';

        const payslips = run.payslips || [];

        payslipDetailsTableBody.innerHTML = '';
        if (payslips.length === 0) {
            if (run.payslips === undefined) {
                 payslipDetailsTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center;">Detail slip gaji tidak ditemukan. Pastikan backend mengirimkan data 'payslips' dalam histori payroll run.</td></tr>`;
                 console.warn("[Modal Detail] Objek 'run' tidak memiliki properti 'payslips'. Backend GET /api/admin/payroll-runs perlu dimodifikasi untuk 'include' payslips.");
            } else {
                payslipDetailsTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center;">Tidak ada data slip gaji untuk run ini.</td></tr>`;
            }
            return;
        }

        payslips.forEach(slip => {
            const row = payslipDetailsTableBody.insertRow();
            row.insertCell().textContent = slip.userName || 'N/A';
            row.insertCell().textContent = slip.userEmail || 'N/A';
            row.insertCell().textContent = slip.baseSalary ? parseFloat(slip.baseSalary).toLocaleString('id-ID', {style:'currency', currency:'IDR', minimumFractionDigits:0}) : '-';
            row.insertCell().textContent = slip.totalAllowance ? parseFloat(slip.totalAllowance).toLocaleString('id-ID', {style:'currency', currency:'IDR', minimumFractionDigits:0}) : '-';
            row.insertCell().textContent = slip.totalDeduction ? parseFloat(slip.totalDeduction).toLocaleString('id-ID', {style:'currency', currency:'IDR', minimumFractionDigits:0}) : '-';
            row.insertCell().textContent = slip.netPay ? parseFloat(slip.netPay).toLocaleString('id-ID', {style:'currency', currency:'IDR', minimumFractionDigits:0}) : '-';
            row.insertCell().textContent = slip.attendanceDays !== undefined ? slip.attendanceDays : '-';
            row.insertCell().textContent = slip.lateDays !== undefined ? slip.lateDays : '-';
            row.insertCell().textContent = slip.alphaDays !== undefined ? slip.alphaDays : '-';
            
            const slipActionCell = row.insertCell();
            const exportSlipBtn = document.createElement('button');
            exportSlipBtn.textContent = 'PDF Slip';
            exportSlipBtn.className = 'export-pdf-btn';
            exportSlipBtn.style.backgroundColor = '#0dcaf0';
            const safeUserName = (slip.userName || 'karyawan').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filenameSlip = `slip_gaji_${safeUserName}_${slip.id.substring(0,8)}.pdf`;
            exportSlipBtn.onclick = () => handleExportPdf(
                `${API_BASE_URL}/api/admin/payslips/${slip.id}/export`,
                filenameSlip
            );
            slipActionCell.appendChild(exportSlipBtn);
        });
    }

    if (closePayrollRunDetailsModalBtn) {
        closePayrollRunDetailsModalBtn.onclick = () => { if(payrollRunDetailsModal) payrollRunDetailsModal.style.display = 'none'; };
    }
    
    // === HELPER UNTUK MENAMPILKAN PESAN ===
    function showAdminPayrollMessage(message, type = 'info', autohide = true) {
        if (!adminPayrollMessageArea) return;
        adminPayrollMessageArea.textContent = message;
        adminPayrollMessageArea.className = `message ${type}`;
        adminPayrollMessageArea.style.display = 'block';
        if (autohide) {
            setTimeout(() => { if(adminPayrollMessageArea) adminPayrollMessageArea.style.display = 'none'; }, 6000);
        }
    }

    // === INISIALISASI HALAMAN ===
    if (loggedInUser && loggedInUser.role === 'SUPER_ADMIN') {
         if (typeof fetchWithAuth === 'function') {
            await fetchAndDisplayPayrollRuns();
        } else {
            // Error ini seharusnya sudah ditangani di awal
            console.error("Fungsi fetchWithAuth tidak ditemukan.");
        }
    }
    
    if(payrollRunDetailsModal){
        window.addEventListener('click', function(event) {
            if (event.target == payrollRunDetailsModal) {
                payrollRunDetailsModal.style.display = "none";
            }
        });
    }
});