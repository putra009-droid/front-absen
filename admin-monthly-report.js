// admin-monthly-report.js
document.addEventListener('DOMContentLoaded', async () => {
    // API_BASE_URL diasumsikan dari auth_utils.js
    // const API_BASE_URL = 'https://akademik.online'; // Pastikan ini sesuai atau didefinisikan di auth_utils.js

    const adminReportInfoArea = document.getElementById('adminReportInfo');
    const logoutButtonAdminReport = document.getElementById('logoutButtonAdminReport');
    const adminReportMessageArea = document.getElementById('adminReportMessageArea');

    const filterYearInput = document.getElementById('filterYear');
    const filterMonthSelect = document.getElementById('filterMonth');
    const generateReportBtn = document.getElementById('generateReportBtn');
    const exportPdfBtn = document.getElementById('exportPdfBtn');

    // Elemen untuk input Pengaturan PDF
    const pdfSettingsContainer = document.getElementById('pdfSettingsContainer');
    const pdfCompanyNameInput = document.getElementById('pdfCompanyName');
    const pdfSignatoryCityInput = document.getElementById('pdfSignatoryCity');
    const pdfSignatoryNameInput = document.getElementById('pdfSignatoryName');
    const pdfSignatoryRoleInput = document.getElementById('pdfSignatoryRole');

    const reportOutputArea = document.getElementById('reportOutputArea');
    const reportPeriodSpan = document.getElementById('reportPeriod');
    const reportGeneratedDateSpan = document.getElementById('reportGeneratedDate');
    const reportDataContainer = document.getElementById('reportDataContainer');

    const dailyDetailModal = document.getElementById('dailyDetailModal');
    const closeDailyDetailModalBtn = document.getElementById('closeDailyDetailModalBtn');
    const dailyDetailModalTitle = document.getElementById('dailyDetailModalTitle');
    const dailyDetailTableBody = document.getElementById('dailyDetailTableBody');

    // Pengecekan fungsi autentikasi dari auth_utils.js
    if (typeof performLogoutClientSide !== 'function' || typeof fetchWithAuth !== 'function') {
        console.error("Fungsi autentikasi tidak ditemukan. Pastikan auth_utils.js di-include.");
        if(adminReportMessageArea) {
            adminReportMessageArea.textContent = "Kesalahan kritis: Fungsi autentikasi tidak termuat.";
            adminReportMessageArea.className = 'message error';
            adminReportMessageArea.style.display = 'block';
        }
        if(generateReportBtn) generateReportBtn.disabled = true;
        if(exportPdfBtn) exportPdfBtn.disabled = true;
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

    if (!loggedInUser || loggedInUser.role !== 'SUPER_ADMIN') {
        showAdminReportMessage('Akses Ditolak: Halaman ini hanya untuk SUPER_ADMIN.', 'error', false);
        const filtersDiv = document.querySelector('.filters');
        if (filtersDiv) filtersDiv.style.display = 'none';
        if(reportOutputArea) reportOutputArea.style.display = 'none';
        if(exportPdfBtn) exportPdfBtn.style.display = 'none';
        if(pdfSettingsContainer) pdfSettingsContainer.style.display = 'none';
        if(generateReportBtn) generateReportBtn.disabled = true;
        return;
    }
    if(adminReportInfoArea) adminReportInfoArea.textContent = `Admin: ${loggedInUser.name || loggedInUser.email}`;
    
    // Isi default input Pengaturan PDF
    if (pdfCompanyNameInput) {
        pdfCompanyNameInput.value = "PT. KARYA ANAK NEGERI SEJAHTERA"; // Default nama perusahaan
    }
    if (pdfSignatoryCityInput) {
        pdfSignatoryCityInput.value = "Jakarta"; // Default kota
    }
    if (pdfSignatoryNameInput && loggedInUser.name) {
        pdfSignatoryNameInput.value = loggedInUser.name;
    }
    if (pdfSignatoryRoleInput) {
        pdfSignatoryRoleInput.value = "Super Admin"; 
    }

    if (logoutButtonAdminReport) {
        logoutButtonAdminReport.addEventListener('click', async () => {
             const currentRefreshToken = localStorage.getItem('refreshToken');
            logoutButtonAdminReport.disabled = true;
            logoutButtonAdminReport.textContent = 'Logging out...';
            try {
                // Diasumsikan API_BASE_URL telah didefinisikan, misal dari auth_utils.js atau di atas
                await fetchWithAuth(`${API_BASE_URL}/api/logout`, {
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

    function populateMonthYearFilters() {
        if (!filterMonthSelect || !filterYearInput) return;
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        filterYearInput.value = currentYear;
        filterYearInput.max = currentYear + 2;
        filterYearInput.min = currentYear - 10;

        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        filterMonthSelect.innerHTML = '<option value="">-- Pilih Bulan --</option>';
        months.forEach((monthName, index) => {
            const option = document.createElement('option');
            option.value = index + 1;
            option.textContent = monthName;
            if ((index + 1) === currentMonth) {
                option.selected = true;
            }
            filterMonthSelect.appendChild(option);
        });
    }

    async function fetchAndDisplayMonthlyReport() {
        if (!filterYearInput || !filterMonthSelect || !reportOutputArea || !reportDataContainer || !exportPdfBtn || !pdfSettingsContainer) return;
        const year = filterYearInput.value;
        const month = filterMonthSelect.value;

        if (!year || !month) {
            showAdminReportMessage('Tahun dan Bulan wajib dipilih untuk menampilkan laporan.', 'error');
            exportPdfBtn.style.display = 'none';
            pdfSettingsContainer.style.display = 'none';
            return;
        }

        showAdminReportMessage('Memuat laporan...', 'info', false);
        reportOutputArea.style.display = 'none';
        exportPdfBtn.style.display = 'none';
        pdfSettingsContainer.style.display = 'none';
        reportDataContainer.innerHTML = '<p style="text-align:center; padding: 20px;">Memproses data laporan...</p>';

        try {
            // Diasumsikan API_BASE_URL telah didefinisikan
            const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/reports/attendance/monthly?year=${year}&month=${month}`);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: `Gagal memuat laporan (Status: ${response.status})` }));
                throw new Error(errData.message);
            }
            const report = await response.json();

            if(reportPeriodSpan) reportPeriodSpan.textContent = `${filterMonthSelect.options[filterMonthSelect.selectedIndex].text} ${year}`;
            if(reportGeneratedDateSpan) reportGeneratedDateSpan.textContent = new Date(report.reportGeneratedAt).toLocaleString('id-ID', { dateStyle:'full', timeStyle:'long'});
            
            reportDataContainer.innerHTML = '';

            if (!report.data || report.data.length === 0) {
                reportDataContainer.innerHTML = '<p style="text-align:center; padding: 20px;">Tidak ada data absensi ditemukan untuk periode ini.</p>';
                showAdminReportMessage('Tidak ada data untuk laporan periode ini.', 'info');
                exportPdfBtn.style.display = 'none';
                pdfSettingsContainer.style.display = 'none';
            } else {
                report.data.forEach(userData => {
                    const userCard = document.createElement('div');
                    userCard.className = 'user-report-card';

                    const cardHeader = document.createElement('div');
                    cardHeader.className = 'user-report-card-header';
                    const userNameH4 = document.createElement('h4');
                    userNameH4.textContent = `${userData.userName || 'Nama Tidak Diketahui'} (${userData.userEmail || 'Email Tidak Diketahui'})`;
                    cardHeader.appendChild(userNameH4);
                    userCard.appendChild(cardHeader);

                    const cardBody = document.createElement('div');
                    cardBody.className = 'user-report-card-body';

                    if (!userData.recap) {
                        const noRecapP = document.createElement('p');
                        noRecapP.textContent = 'Data rekap absensi tidak tersedia untuk pengguna ini.';
                        cardBody.appendChild(noRecapP);
                    } else {
                        const summaryGrid = document.createElement('div');
                        summaryGrid.className = 'summary-grid';

                        const createSummaryItem = (label, value, valueClass = '') => {
                            const itemDiv = document.createElement('div');
                            itemDiv.className = 'summary-item';
                            const labelSpan = document.createElement('span');
                            labelSpan.className = 'label';
                            labelSpan.textContent = label;
                            const valueSpan = document.createElement('span');
                            valueSpan.className = `value ${valueClass}`;
                            valueSpan.textContent = value !== null && value !== undefined ? value.toString() : '0';
                            itemDiv.appendChild(labelSpan);
                            itemDiv.appendChild(valueSpan);
                            return itemDiv;
                        };

                        summaryGrid.appendChild(createSummaryItem('Total Hadir', userData.recap.totalHadir || 0, 'hadir'));
                        summaryGrid.appendChild(createSummaryItem('Total Terlambat', userData.recap.totalTerlambat || 0, 'terlambat'));
                        summaryGrid.appendChild(createSummaryItem('Total Alpha', userData.recap.totalAlpha || 0, 'alpha'));
                        summaryGrid.appendChild(createSummaryItem('Total Izin', userData.recap.totalIzin || 0));
                        summaryGrid.appendChild(createSummaryItem('Total Sakit', userData.recap.totalSakit || 0));
                        summaryGrid.appendChild(createSummaryItem('Total Cuti', userData.recap.totalCuti || 0));
                        summaryGrid.appendChild(createSummaryItem('Hari Kerja Efektif', userData.recap.totalHariKerja || 0));
                        
                        cardBody.appendChild(summaryGrid);

                        const detailButton = document.createElement('button');
                        detailButton.className = 'view-daily-detail-btn';
                        detailButton.textContent = 'Lihat Detail Harian';
                        detailButton.onclick = () => {
                            openDailyDetailModal(userData.userName, userData.recap.detailPerHari || []);
                        };
                        cardBody.appendChild(detailButton);
                    }
                    userCard.appendChild(cardBody);
                    reportDataContainer.appendChild(userCard);
                });
                showAdminReportMessage('Laporan berhasil dimuat.', 'success');
                if(exportPdfBtn) exportPdfBtn.style.display = 'inline-block';
                if(pdfSettingsContainer) pdfSettingsContainer.style.display = 'flex';
            }
            if(reportOutputArea) reportOutputArea.style.display = 'block';

        } catch (error) {
            console.error('Error fetching monthly report:', error);
            showAdminReportMessage(`Error: ${error.message}`, 'error');
            if(reportOutputArea) reportOutputArea.style.display = 'none';
            if(exportPdfBtn) exportPdfBtn.style.display = 'none';
            if(pdfSettingsContainer) pdfSettingsContainer.style.display = 'none';
        }
    }

    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', fetchAndDisplayMonthlyReport);
    }

    async function exportReportToPDF() {
        if (!reportOutputArea || reportOutputArea.style.display === 'none' || !reportDataContainer.hasChildNodes()) {
            showAdminReportMessage('Tidak ada laporan untuk diexport.', 'error');
            return;
        }
        
        const companyName = pdfCompanyNameInput.value.trim();
        const signatoryCity = pdfSignatoryCityInput.value.trim();
        const signatoryName = pdfSignatoryNameInput.value.trim();
        const signatoryRole = pdfSignatoryRoleInput.value.trim();

        let missingFields = [];
        if (!companyName) missingFields.push("Nama Perusahaan (Kop)");
        if (!signatoryCity) missingFields.push("Kota Penandatanganan (TTD)");
        if (!signatoryName) missingFields.push("Nama Penandatangan (TTD)");
        if (!signatoryRole) missingFields.push("Jabatan Penandatangan (TTD)");

        if (missingFields.length > 0) {
            showAdminReportMessage(`Harap isi field berikut: ${missingFields.join(', ')}.`, 'error');
            if (!companyName) pdfCompanyNameInput.focus();
            else if (!signatoryCity) pdfSignatoryCityInput.focus();
            else if (!signatoryName) pdfSignatoryNameInput.focus();
            else if (!signatoryRole) pdfSignatoryRoleInput.focus();
            return;
        }

        if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
            showAdminReportMessage('Pustaka PDF tidak termuat. Coba refresh halaman.', 'error');
            console.error('jsPDF atau html2canvas tidak termuat.');
            return;
        }

        showAdminReportMessage('Membuat PDF...', 'info', false);
        exportPdfBtn.disabled = true;
        exportPdfBtn.textContent = 'Processing...';

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'pt', 'a4');

        const MARGIN_TOP = 40;
        const MARGIN_LEFT = 40;
        const CONTENT_WIDTH = doc.internal.pageSize.getWidth() - (2 * MARGIN_LEFT);
        let currentY = MARGIN_TOP;

        function addPageHeader() {
            const finalCompanyName = companyName || "NAMA PERUSAHAAN DEFAULT";
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text(finalCompanyName.toUpperCase(), MARGIN_LEFT, currentY);
            currentY += 20;
            doc.setFontSize(12);
            doc.setFont("helvetica", "normal");
            doc.text("Laporan Absensi Karyawan Bulanan", MARGIN_LEFT, currentY);
            currentY += 15;
            if (reportPeriodSpan) {
                doc.text(`Periode: ${reportPeriodSpan.textContent}`, MARGIN_LEFT, currentY);
            }
            currentY += 15;
            doc.setLineWidth(0.5);
            doc.line(MARGIN_LEFT, currentY, doc.internal.pageSize.getWidth() - MARGIN_LEFT, currentY);
            currentY += 25;
        }

        addPageHeader();

        const userCards = reportDataContainer.querySelectorAll('.user-report-card');
        for (let i = 0; i < userCards.length; i++) {
            const card = userCards[i];
            const detailButton = card.querySelector('.view-daily-detail-btn');
            let originalDisplay = '';

            if (detailButton) {
                originalDisplay = detailButton.style.display;
                detailButton.style.display = 'none'; // Sembunyikan tombol
            }

            try {
                const canvas = await html2canvas(card, { 
                    scale: 2,
                    useCORS: true
                });
                const imgData = canvas.toDataURL('image/png');
                const imgProps = doc.getImageProperties(imgData);
                
                const pdfImgWidth = CONTENT_WIDTH;
                const pdfImgHeight = (imgProps.height * pdfImgWidth) / imgProps.width;

                if (currentY + pdfImgHeight > doc.internal.pageSize.getHeight() - MARGIN_TOP - 120) {
                    doc.addPage();
                    currentY = MARGIN_TOP;
                    addPageHeader();
                }

                doc.addImage(imgData, 'PNG', MARGIN_LEFT, currentY, pdfImgWidth, pdfImgHeight);
                currentY += pdfImgHeight + 15;

            } catch(e) {
                console.error("Error rendering card to canvas:", e);
                doc.setFontSize(10);
                doc.setTextColor(255,0,0);
                doc.text("Gagal merender detail karyawan ini ke PDF.", MARGIN_LEFT, currentY);
                doc.setTextColor(0,0,0);
                currentY += 20;
                 if (currentY > doc.internal.pageSize.getHeight() - MARGIN_TOP - 120) {
                    doc.addPage();
                    currentY = MARGIN_TOP;
                    addPageHeader();
                }
            } finally {
                if (detailButton) {
                    detailButton.style.display = originalDisplay; // Kembalikan tombol ke tampilan semula
                }
            }
        }
        
        function addPageFooter() {
            const ttdStartY = doc.internal.pageSize.getHeight() - MARGIN_TOP - 100;
            if (currentY > ttdStartY - 20) {
                doc.addPage();
                currentY = MARGIN_TOP;
                addPageHeader();
            } else {
                 currentY = ttdStartY > currentY ? ttdStartY : currentY + 20;
            }

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");

            const today = new Date().toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric'
            });
            
            const finalSignatoryCity = signatoryCity || "Kota Default"; 
            const finalSignatoryName = signatoryName || (loggedInUser && loggedInUser.name) || "Admin"; 
            const finalSignatoryRole = signatoryRole || "Super Admin"; 

            const placeAndDate = `${finalSignatoryCity}, ${today}`;
            const knowingText = "Mengetahui,";
            
            const textWidthPlaceDate = doc.getStringUnitWidth(placeAndDate) * doc.getFontSize() / doc.internal.scaleFactor;
            const textWidthKnowing = doc.getStringUnitWidth(knowingText) * doc.getFontSize() / doc.internal.scaleFactor;
            const textWidthAdminName = doc.getStringUnitWidth(`(${finalSignatoryName})`) * doc.getFontSize() / doc.internal.scaleFactor;
            const textWidthAdminRole = doc.getStringUnitWidth(finalSignatoryRole) * doc.getFontSize() / doc.internal.scaleFactor;
            
            const ttdXPosition = doc.internal.pageSize.getWidth() - MARGIN_LEFT - Math.max(textWidthPlaceDate, textWidthKnowing, textWidthAdminName, textWidthAdminRole);

            doc.text(placeAndDate, ttdXPosition, currentY);
            currentY += 15;
            doc.text(knowingText, ttdXPosition, currentY);
            currentY += 60;
            doc.text(`(${finalSignatoryName})`, ttdXPosition, currentY);
            currentY += 15;
            doc.text(finalSignatoryRole, ttdXPosition, currentY);
        }

        addPageFooter();

        const monthName = filterMonthSelect.options[filterMonthSelect.selectedIndex].text;
        const year = filterYearInput.value;
        doc.save(`Laporan_Absensi_${monthName}_${year}.pdf`);

        showAdminReportMessage('PDF berhasil dibuat dan diunduh.', 'success');
        exportPdfBtn.disabled = false;
        exportPdfBtn.textContent = 'Export ke PDF';
    }

    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', exportReportToPDF);
    }

    function openDailyDetailModal(userName, dailyDetails) {
        if (!dailyDetailModal || !dailyDetailModalTitle || !dailyDetailTableBody) return;
        dailyDetailModalTitle.textContent = `Detail Absensi Harian untuk: ${userName || 'Karyawan'}`;
        dailyDetailTableBody.innerHTML = '';

        if (!dailyDetails || dailyDetails.length === 0) {
            dailyDetailTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Tidak ada detail harian tersedia.</td></tr>';
        } else {
            dailyDetails.forEach(detail => {
                const row = dailyDetailTableBody.insertRow();
                const localDate = new Date(detail.tanggal);
                row.insertCell().textContent = localDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                row.insertCell().textContent = detail.status;
                row.insertCell().textContent = detail.clockIn ? new Date(detail.clockIn).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit'}) : '-';
                row.insertCell().textContent = detail.clockOut ? new Date(detail.clockOut).toLocaleTimeString('id-ID',  { hour:'2-digit', minute:'2-digit', second:'2-digit'}) : '-';
                const latIn = detail.latitudeIn ? parseFloat(detail.latitudeIn).toFixed(4) : null;
                const lonIn = detail.longitudeIn ? parseFloat(detail.longitudeIn).toFixed(4) : null;
                row.insertCell().textContent = latIn && lonIn ? `${latIn}, ${lonIn}` : '-';
                const latOut = detail.latitudeOut ? parseFloat(detail.latitudeOut).toFixed(4) : null;
                const lonOut = detail.longitudeOut ? parseFloat(detail.longitudeOut).toFixed(4) : null;
                row.insertCell().textContent = latOut && lonOut ? `${latOut}, ${lonOut}` : '-';
                row.insertCell().textContent = detail.notes || '-';
            });
        }
        if(dailyDetailModal) dailyDetailModal.style.display = 'block';
    }

    if (closeDailyDetailModalBtn) {
        closeDailyDetailModalBtn.onclick = () => { if(dailyDetailModal) dailyDetailModal.style.display = 'none'; };
    }
    
    function showAdminReportMessage(message, type = 'info', autohide = true) {
        if (!adminReportMessageArea) return;
        adminReportMessageArea.textContent = message;
        adminReportMessageArea.className = `message ${type}`;
        adminReportMessageArea.style.display = 'block';
        if (autohide) {
            setTimeout(() => { if(adminReportMessageArea) adminReportMessageArea.style.display = 'none'; }, 4000); 
        }
    }

    if (loggedInUser && loggedInUser.role === 'SUPER_ADMIN') {
        if(typeof populateMonthYearFilters === 'function') populateMonthYearFilters();
    }
    
    if(dailyDetailModal) {
        window.addEventListener('click', function(event) {
            if (event.target == dailyDetailModal) {
                dailyDetailModal.style.display = "none";
            }
        });
    }
});