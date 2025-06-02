// deduction-types.js
document.addEventListener('DOMContentLoaded', async () => {
    // === 1. PENGATURAN DASAR & ELEMEN DOM ===
    // const API_BASE_URL = 'https://akademik.online'; // Jika tidak di auth_utils.js

    const adminDeductionInfoArea = document.getElementById('adminDeductionInfo');
    const logoutButtonDeductionTypes = document.getElementById('logoutButtonDeductionTypes');
    const deductionTypesTableBody = document.getElementById('deductionTypesTableBody');
    const deductionTypesMessageArea = document.getElementById('deductionTypesMessageArea');

    // Elemen Modal
    const deductionTypeModal = document.getElementById('deductionTypeModal');
    const deductionTypeModalTitle = document.getElementById('deductionTypeModalTitle');
    const deductionTypeForm = document.getElementById('deductionTypeForm');
    const deductionTypeIdInput = document.getElementById('deductionTypeId');
    const deductionTypeNameInput = document.getElementById('deductionTypeName');
    const deductionTypeDescriptionInput = document.getElementById('deductionTypeDescription');
    const deductionTypeCalculationTypeInput = document.getElementById('deductionTypeCalculationType');
    const ruleAmountContainer = document.getElementById('ruleAmountContainer');
    const deductionTypeRuleAmountInput = document.getElementById('deductionTypeRuleAmount');
    const rulePercentageContainer = document.getElementById('rulePercentageContainer');
    const deductionTypeRulePercentageInput = document.getElementById('deductionTypeRulePercentage');
    const deductionTypeIsMandatoryInput = document.getElementById('deductionTypeIsMandatory');
    const deductionTypeFormSubmitBtn = document.getElementById('deductionTypeFormSubmitBtn');
    const deductionTypeModalMessageArea = document.getElementById('deductionTypeModalMessageArea');
    const showAddDeductionTypeModalBtn = document.getElementById('showAddDeductionTypeModalBtn');
    const closeDeductionTypeModalBtn = document.getElementById('closeDeductionTypeModalBtn');

    let currentDeductionTypeForEdit = null;

    // Enum DeductionCalculationType (sesuai Prisma schema Anda)
    // Ini akan digunakan untuk mengisi dropdown dan logika kondisional
    const DeductionCalculationType = {
        FIXED_USER: 'FIXED_USER',
        PERCENTAGE_USER: 'PERCENTAGE_USER',
        PER_LATE_INSTANCE: 'PER_LATE_INSTANCE',
        PER_ALPHA_DAY: 'PER_ALPHA_DAY',
        PERCENTAGE_ALPHA_DAY: 'PERCENTAGE_ALPHA_DAY',
        MANDATORY_PERCENTAGE: 'MANDATORY_PERCENTAGE'
    };

    // === 2. FUNGSI AUTENTIKASI (DIASUMSIKAN DARI auth_utils.js) ===
    // Pastikan `fetchWithAuth` dan `performLogoutClientSide` tersedia global

    // === 3. PENGECEKAN AUTENTIKASI & OTORISASI ADMIN ===
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
        showDeductionTypesMessage('Akses Ditolak: Halaman ini hanya untuk SUPER_ADMIN.', 'error');
        document.querySelector('.list-container')?.remove();
        if(showAddDeductionTypeModalBtn) showAddDeductionTypeModalBtn.remove();
        return;
    }

    if(adminDeductionInfoArea) adminDeductionInfoArea.textContent = `Admin: ${loggedInUser.name || loggedInUser.email}`;

    // === 4. FUNGSI LOGOUT ===
    if (logoutButtonDeductionTypes) {
        logoutButtonDeductionTypes.addEventListener('click', async () => {
            const currentRefreshToken = localStorage.getItem('refreshToken');
            logoutButtonDeductionTypes.disabled = true;
            logoutButtonDeductionTypes.textContent = 'Logging out...';
            try {
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

    // === 5. FUNGSI UNTUK MENGAMBIL DAN MENAMPILKAN JENIS POTONGAN ===
    async function fetchAndDisplayDeductionTypes() {
        if (!deductionTypesTableBody) return;
        deductionTypesTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Memuat data...</td></tr>';
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/deduction-types`);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: `Gagal memuat (Status: ${response.status})` }));
                throw new Error(errData.message);
            }
            const types = await response.json();
            deductionTypesTableBody.innerHTML = '';

            if (types.length === 0) {
                deductionTypesTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Belum ada jenis potongan.</td></tr>';
                return;
            }

            types.forEach((type, index) => {
                const row = deductionTypesTableBody.insertRow();
                row.insertCell().textContent = index + 1;
                row.insertCell().textContent = type.name;
                row.insertCell().textContent = type.description || '-';
                row.insertCell().textContent = type.calculationType;
                row.insertCell().textContent = type.ruleAmount ? parseFloat(type.ruleAmount).toLocaleString('id-ID') : '-';
                row.insertCell().textContent = type.rulePercentage ? parseFloat(type.rulePercentage) + '%' : '-';
                row.insertCell().textContent = type.isMandatory ? 'Ya' : 'Tidak';

                const actionsCell = row.insertCell();
                actionsCell.className = 'actions';

                const editBtn = document.createElement('button');
                editBtn.textContent = 'Edit';
                editBtn.className = 'edit-btn';
                editBtn.onclick = () => openDeductionTypeModalForEdit(type);
                actionsCell.appendChild(editBtn);

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Hapus';
                deleteBtn.className = 'delete-btn';
                deleteBtn.onclick = () => deleteDeductionType(type.id, type.name);
                actionsCell.appendChild(deleteBtn);
            });
        } catch (error) {
            console.error('Error fetching deduction types:', error);
            if(deductionTypesTableBody) deductionTypesTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Error: ${error.message}</td></tr>`;
            showDeductionTypesMessage(error.message, 'error');
        }
    }

    // === 6. LOGIKA MODAL TAMBAH/EDIT JENIS POTONGAN ===
    function populateCalculationTypeDropdown() {
        if (!deductionTypeCalculationTypeInput) return;
        deductionTypeCalculationTypeInput.innerHTML = ''; // Kosongkan dulu
        for (const key in DeductionCalculationType) {
            const option = document.createElement('option');
            option.value = DeductionCalculationType[key];
            option.textContent = DeductionCalculationType[key];
            deductionTypeCalculationTypeInput.appendChild(option);
        }
    }

    function toggleRuleFields(calculationType) {
        const type = calculationType || (deductionTypeCalculationTypeInput ? deductionTypeCalculationTypeInput.value : null);
        if (!type || !ruleAmountContainer || !rulePercentageContainer) return;

        const needsAmount = [
            DeductionCalculationType.PER_LATE_INSTANCE,
            DeductionCalculationType.PER_ALPHA_DAY
        ].includes(type);

        const needsPercentage = [
            DeductionCalculationType.PERCENTAGE_ALPHA_DAY,
            DeductionCalculationType.MANDATORY_PERCENTAGE,
            // DeductionCalculationType.PERCENTAGE_USER // Untuk PERCENTAGE_USER, rule diatur di level UserDeduction, bukan di sini
        ].includes(type);

        ruleAmountContainer.style.display = needsAmount ? 'block' : 'none';
        if(deductionTypeRuleAmountInput) deductionTypeRuleAmountInput.required = needsAmount;

        rulePercentageContainer.style.display = needsPercentage ? 'block' : 'none';
        if(deductionTypeRulePercentageInput) deductionTypeRulePercentageInput.required = needsPercentage;
    }

    if (deductionTypeCalculationTypeInput) {
        deductionTypeCalculationTypeInput.addEventListener('change', (e) => toggleRuleFields(e.target.value));
    }

    function openDeductionTypeModalForAdd() {
        currentDeductionTypeForEdit = null;
        if(deductionTypeModalTitle) deductionTypeModalTitle.textContent = 'Tambah Jenis Potongan Baru';
        if(deductionTypeForm) deductionTypeForm.reset();
        if(deductionTypeIdInput) deductionTypeIdInput.value = '';
        populateCalculationTypeDropdown();
        if(deductionTypeCalculationTypeInput) deductionTypeCalculationTypeInput.value = DeductionCalculationType.FIXED_USER; // Default
        toggleRuleFields(DeductionCalculationType.FIXED_USER); // Sesuaikan field berdasarkan default
        if(deductionTypeIsMandatoryInput) deductionTypeIsMandatoryInput.checked = false;
        if(deductionTypeModalMessageArea) deductionTypeModalMessageArea.style.display = 'none';
        if(deductionTypeModal) deductionTypeModal.style.display = 'block';
    }

    function openDeductionTypeModalForEdit(type) {
        currentDeductionTypeForEdit = type;
        if(deductionTypeModalTitle) deductionTypeModalTitle.textContent = `Edit Jenis Potongan: ${type.name}`;
        if(deductionTypeForm) deductionTypeForm.reset();
        if(deductionTypeIdInput) deductionTypeIdInput.value = type.id;
        if(deductionTypeNameInput) deductionTypeNameInput.value = type.name;
        if(deductionTypeDescriptionInput) deductionTypeDescriptionInput.value = type.description || '';
        populateCalculationTypeDropdown();
        if(deductionTypeCalculationTypeInput) deductionTypeCalculationTypeInput.value = type.calculationType;
        if(deductionTypeRuleAmountInput) deductionTypeRuleAmountInput.value = type.ruleAmount ? parseFloat(type.ruleAmount) : '';
        if(deductionTypeRulePercentageInput) deductionTypeRulePercentageInput.value = type.rulePercentage ? parseFloat(type.rulePercentage) : '';
        if(deductionTypeIsMandatoryInput) deductionTypeIsMandatoryInput.checked = type.isMandatory;
        toggleRuleFields(type.calculationType);
        if(deductionTypeModalMessageArea) deductionTypeModalMessageArea.style.display = 'none';
        if(deductionTypeModal) deductionTypeModal.style.display = 'block';
    }

    if(closeDeductionTypeModalBtn) {
        closeDeductionTypeModalBtn.onclick = () => { if(deductionTypeModal) deductionTypeModal.style.display = 'none'; };
    }
    if(showAddDeductionTypeModalBtn) {
        showAddDeductionTypeModalBtn.onclick = openDeductionTypeModalForAdd;
    }

    if(deductionTypeForm) {
        deductionTypeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(deductionTypeFormSubmitBtn) {
                deductionTypeFormSubmitBtn.disabled = true;
                deductionTypeFormSubmitBtn.textContent = 'Menyimpan...';
            }
            if(deductionTypeModalMessageArea) deductionTypeModalMessageArea.style.display = 'none';

            const id = deductionTypeIdInput ? deductionTypeIdInput.value : null;
            const name = deductionTypeNameInput ? deductionTypeNameInput.value.trim() : '';
            const description = deductionTypeDescriptionInput ? deductionTypeDescriptionInput.value.trim() : null;
            const calculationType = deductionTypeCalculationTypeInput ? deductionTypeCalculationTypeInput.value : null;
            const ruleAmountRaw = deductionTypeRuleAmountInput ? deductionTypeRuleAmountInput.value : '';
            const rulePercentageRaw = deductionTypeRulePercentageInput ? deductionTypeRulePercentageInput.value : '';
            const isMandatory = deductionTypeIsMandatoryInput ? deductionTypeIsMandatoryInput.checked : false;

            if (!name) {
                showDeductionTypeModalMessage('Nama jenis potongan wajib diisi.', 'error');
                finalizeFormSubmit(); return;
            }
            if (!calculationType) {
                showDeductionTypeModalMessage('Tipe kalkulasi wajib dipilih.', 'error');
                finalizeFormSubmit(); return;
            }

            const payload = { name, description, calculationType, isMandatory };

            if (ruleAmountContainer && ruleAmountContainer.style.display !== 'none') {
                if (ruleAmountRaw === '') {
                    showDeductionTypeModalMessage('Aturan Jumlah wajib diisi untuk tipe kalkulasi ini.', 'error');
                    finalizeFormSubmit(); return;
                }
                payload.ruleAmount = parseFloat(ruleAmountRaw);
                if (isNaN(payload.ruleAmount) || payload.ruleAmount < 0) {
                    showDeductionTypeModalMessage('Aturan Jumlah harus angka positif.', 'error');
                    finalizeFormSubmit(); return;
                }
            } else {
                payload.ruleAmount = null;
            }

            if (rulePercentageContainer && rulePercentageContainer.style.display !== 'none') {
                 if (rulePercentageRaw === '') {
                    showDeductionTypeModalMessage('Aturan Persentase wajib diisi untuk tipe kalkulasi ini.', 'error');
                    finalizeFormSubmit(); return;
                }
                payload.rulePercentage = parseFloat(rulePercentageRaw);
                if (isNaN(payload.rulePercentage) || payload.rulePercentage < 0 || payload.rulePercentage > 100) {
                    showDeductionTypeModalMessage('Aturan Persentase harus antara 0 dan 100.', 'error');
                    finalizeFormSubmit(); return;
                }
            } else {
                 payload.rulePercentage = null;
            }
            // Khusus untuk tipe PERCENTAGE_USER, ruleAmount dan rulePercentage di level Tipe ini biasanya null (diatur per user)
            // Namun API backend Anda mungkin mengizinkan default, jadi frontend tetap mengirimnya jika field terlihat
            if (calculationType === DeductionCalculationType.PERCENTAGE_USER || calculationType === DeductionCalculationType.FIXED_USER) {
                // Untuk tipe USER, ruleAmount & rulePercentage di level TIPE ini bisa jadi null,
                // karena akan di-override di UserDeduction.
                // API POST /api/admin/deduction-types akan menyimpan null jika tidak relevan.
                // API PUT juga akan handle ini.
                // Namun, jika fieldnya visible dan diisi, kita kirim. Jika backend mau mengabaikannya, itu urusan backend.
            }


            let url = `${API_BASE_URL}/api/admin/deduction-types`;
            let method = 'POST';

            if (id) { // Mode Edit
                url = `${API_BASE_URL}/api/admin/deduction-types/${id}`;
                method = 'PUT';
            }

            try {
                const response = await fetchWithAuth(url, {
                    method: method,
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || `Gagal ${id ? 'memperbarui' : 'menambah'} jenis potongan.`);
                }
                showDeductionTypeModalMessage(data.message || `Jenis potongan berhasil ${id ? 'diperbarui' : 'ditambahkan'}!`, 'success');
                await fetchAndDisplayDeductionTypes();
                if(deductionTypeModal) {
                    setTimeout(() => {
                        deductionTypeModal.style.display = 'none';
                    }, 1500);
                }
            } catch (error) {
                showDeductionTypeModalMessage(error.message, 'error');
            } finally {
                finalizeFormSubmit();
            }
            
            function finalizeFormSubmit() {
                if(deductionTypeFormSubmitBtn) {
                    deductionTypeFormSubmitBtn.disabled = false;
                    deductionTypeFormSubmitBtn.textContent = 'Simpan';
                }
            }
        });
    }

    // === 7. FUNGSI HAPUS JENIS POTONGAN ===
    async function deleteDeductionType(typeId, typeName) {
        if (!confirm(`Apakah Anda yakin ingin menghapus jenis potongan "${typeName}"? Ini juga akan menghapus penetapan potongan ini dari semua pengguna.`)) {
            return;
        }
        showDeductionTypesMessage(`Menghapus ${typeName}...`, 'info', false);
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/deduction-types/${typeId}`, {
                method: 'DELETE'
            });
            const data = await response.json().catch(() => ({}));
             if (!response.ok) {
                if (response.status === 200 && !data.message) {
                     showDeductionTypesMessage(`Jenis potongan ${typeName} berhasil dihapus.`, 'success');
                } else {
                    throw new Error(data.message || `Gagal menghapus jenis potongan (Status: ${response.status}).`);
                }
            } else {
                 showDeductionTypesMessage(data.message || `Jenis potongan ${typeName} berhasil dihapus.`, 'success');
            }
            await fetchAndDisplayDeductionTypes();
        } catch (error) {
            console.error('Error deleting deduction type:', error);
            showDeductionTypesMessage(error.message, 'error');
        }
    }

    // === 8. HELPER UNTUK MENAMPILKAN PESAN ===
    function showDeductionTypesMessage(message, type = 'info', autohide = true) {
        if (!deductionTypesMessageArea) return;
        deductionTypesMessageArea.textContent = message;
        deductionTypesMessageArea.className = `message ${type}`;
        deductionTypesMessageArea.style.display = 'block';
        if (autohide) {
            setTimeout(() => { deductionTypesMessageArea.style.display = 'none'; }, 4000);
        }
    }
    function showDeductionTypeModalMessage(message, type = 'info') {
        if (!deductionTypeModalMessageArea) return;
        deductionTypeModalMessageArea.textContent = message;
        deductionTypeModalMessageArea.className = `message ${type}`;
        deductionTypeModalMessageArea.style.display = 'block';
    }

    // === 9. INISIALISASI & EVENT LISTENER TAMBAHAN ===
    if (loggedInUser && loggedInUser.role === 'SUPER_ADMIN') {
        populateCalculationTypeDropdown(); // Isi dropdown sekali saat load
        if (typeof fetchWithAuth === 'function') {
            await fetchAndDisplayDeductionTypes();
        } else {
             console.error("Fungsi fetchWithAuth tidak ditemukan. Pastikan auth_utils.js di-include.");
            showDeductionTypesMessage("Error: Fungsi autentikasi tidak termuat.", "error", false);
        }
    }

    if(deductionTypeModal) {
        window.addEventListener('click', function(event) {
            if (event.target == deductionTypeModal) {
                deductionTypeModal.style.display = "none";
            }
        });
    }
});