// allowance-types.js
document.addEventListener('DOMContentLoaded', async () => {
    // === 1. PENGATURAN DASAR & ELEMEN DOM ===
    // Pastikan API_BASE_URL didefinisikan di auth_utils.js atau di sini jika belum
    // const API_BASE_URL = 'https://akademik.online'; // Jika tidak di auth_utils.js

    const adminAllowanceInfoArea = document.getElementById('adminAllowanceInfo');
    const logoutButtonAllowanceTypes = document.getElementById('logoutButtonAllowanceTypes');
    const allowanceTypesTableBody = document.getElementById('allowanceTypesTableBody');
    const allowanceTypesMessageArea = document.getElementById('allowanceTypesMessageArea');

    // Elemen Modal
    const allowanceTypeModal = document.getElementById('allowanceTypeModal');
    const allowanceTypeModalTitle = document.getElementById('allowanceTypeModalTitle');
    const allowanceTypeForm = document.getElementById('allowanceTypeForm');
    const allowanceTypeIdInput = document.getElementById('allowanceTypeId');
    const allowanceTypeNameInput = document.getElementById('allowanceTypeName');
    const allowanceTypeDescriptionInput = document.getElementById('allowanceTypeDescription');
    const allowanceTypeIsFixedInput = document.getElementById('allowanceTypeIsFixed');
    const allowanceTypeFormSubmitBtn = document.getElementById('allowanceTypeFormSubmitBtn');
    const allowanceTypeModalMessageArea = document.getElementById('allowanceTypeModalMessageArea');
    const showAddAllowanceTypeModalBtn = document.getElementById('showAddAllowanceTypeModalBtn');
    const closeAllowanceTypeModalBtn = document.getElementById('closeAllowanceTypeModalBtn');

    let currentAllowanceTypeForEdit = null;

    // === 2. FUNGSI AUTENTIKASI (DIASUMSIKAN DARI auth_utils.js) ===
    // Pastikan `fetchWithAuth` dan `performLogoutClientSide` tersedia global dari auth_utils.js

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
        showAllowanceTypesMessage('Akses Ditolak: Halaman ini hanya untuk SUPER_ADMIN.', 'error');
        document.querySelector('.list-container')?.remove();
        if(showAddAllowanceTypeModalBtn) showAddAllowanceTypeModalBtn.remove();
        return;
    }

    if(adminAllowanceInfoArea) adminAllowanceInfoArea.textContent = `Admin: ${loggedInUser.name || loggedInUser.email}`;

    // === 4. FUNGSI LOGOUT ===
    if (logoutButtonAllowanceTypes) {
        logoutButtonAllowanceTypes.addEventListener('click', async () => {
            // ... (Logika logout sama seperti di admin.js, panggil performLogoutClientSide)
            const currentRefreshToken = localStorage.getItem('refreshToken');
            logoutButtonAllowanceTypes.disabled = true;
            logoutButtonAllowanceTypes.textContent = 'Logging out...';
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

    // === 5. FUNGSI UNTUK MENGAMBIL DAN MENAMPILKAN JENIS TUNJANGAN ===
    async function fetchAndDisplayAllowanceTypes() {
        if (!allowanceTypesTableBody) return;
        allowanceTypesTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Memuat data...</td></tr>';
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/allowance-types`);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: `Gagal memuat (Status: ${response.status})` }));
                throw new Error(errData.message);
            }
            const types = await response.json();
            allowanceTypesTableBody.innerHTML = '';

            if (types.length === 0) {
                allowanceTypesTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada jenis tunjangan.</td></tr>';
                return;
            }

            types.forEach((type, index) => {
                const row = allowanceTypesTableBody.insertRow();
                row.insertCell().textContent = index + 1;
                row.insertCell().textContent = type.name;
                row.insertCell().textContent = type.description || '-';
                row.insertCell().textContent = type.isFixed ? 'Tetap (Fixed)' : 'Tidak Tetap';

                const actionsCell = row.insertCell();
                actionsCell.className = 'actions';

                const editBtn = document.createElement('button');
                editBtn.textContent = 'Edit';
                editBtn.className = 'edit-btn';
                editBtn.onclick = () => openAllowanceTypeModalForEdit(type);
                actionsCell.appendChild(editBtn);

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Hapus';
                deleteBtn.className = 'delete-btn';
                deleteBtn.onclick = () => deleteAllowanceType(type.id, type.name);
                actionsCell.appendChild(deleteBtn);
            });
        } catch (error) {
            console.error('Error fetching allowance types:', error);
            if(allowanceTypesTableBody) allowanceTypesTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Error: ${error.message}</td></tr>`;
            showAllowanceTypesMessage(error.message, 'error');
        }
    }

    // === 6. LOGIKA MODAL TAMBAH/EDIT JENIS TUNJANGAN ===
    function openAllowanceTypeModalForAdd() {
        currentAllowanceTypeForEdit = null;
        if(allowanceTypeModalTitle) allowanceTypeModalTitle.textContent = 'Tambah Jenis Tunjangan Baru';
        if(allowanceTypeForm) allowanceTypeForm.reset();
        if(allowanceTypeIdInput) allowanceTypeIdInput.value = '';
        if(allowanceTypeIsFixedInput) allowanceTypeIsFixedInput.checked = true; // Default ke true
        if(allowanceTypeModalMessageArea) allowanceTypeModalMessageArea.style.display = 'none';
        if(allowanceTypeModal) allowanceTypeModal.style.display = 'block';
    }

    function openAllowanceTypeModalForEdit(type) {
        currentAllowanceTypeForEdit = type;
        if(allowanceTypeModalTitle) allowanceTypeModalTitle.textContent = `Edit Jenis Tunjangan: ${type.name}`;
        if(allowanceTypeForm) allowanceTypeForm.reset();
        if(allowanceTypeIdInput) allowanceTypeIdInput.value = type.id;
        if(allowanceTypeNameInput) allowanceTypeNameInput.value = type.name;
        if(allowanceTypeDescriptionInput) allowanceTypeDescriptionInput.value = type.description || '';
        if(allowanceTypeIsFixedInput) allowanceTypeIsFixedInput.checked = type.isFixed;
        if(allowanceTypeModalMessageArea) allowanceTypeModalMessageArea.style.display = 'none';
        if(allowanceTypeModal) allowanceTypeModal.style.display = 'block';
    }

    if(closeAllowanceTypeModalBtn) {
        closeAllowanceTypeModalBtn.onclick = () => { if(allowanceTypeModal) allowanceTypeModal.style.display = 'none'; };
    }
    if(showAddAllowanceTypeModalBtn) {
        showAddAllowanceTypeModalBtn.onclick = openAllowanceTypeModalForAdd;
    }

    if(allowanceTypeForm) {
        allowanceTypeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(allowanceTypeFormSubmitBtn) {
                allowanceTypeFormSubmitBtn.disabled = true;
                allowanceTypeFormSubmitBtn.textContent = 'Menyimpan...';
            }
            if(allowanceTypeModalMessageArea) allowanceTypeModalMessageArea.style.display = 'none';

            const id = allowanceTypeIdInput ? allowanceTypeIdInput.value : null;
            const name = allowanceTypeNameInput ? allowanceTypeNameInput.value : '';
            const description = allowanceTypeDescriptionInput ? allowanceTypeDescriptionInput.value : '';
            const isFixed = allowanceTypeIsFixedInput ? allowanceTypeIsFixedInput.checked : true;

            if (!name.trim()) {
                showAllowanceTypeModalMessage('Nama jenis tunjangan wajib diisi.', 'error');
                if(allowanceTypeFormSubmitBtn) {
                    allowanceTypeFormSubmitBtn.disabled = false;
                    allowanceTypeFormSubmitBtn.textContent = 'Simpan';
                }
                return;
            }

            const payload = { name: name.trim(), description: description.trim() || null, isFixed };
            let url = `${API_BASE_URL}/api/admin/allowance-types`;
            let method = 'POST';

            if (id) { // Mode Edit
                url = `${API_BASE_URL}/api/admin/allowance-types/${id}`;
                method = 'PUT';
            }

            try {
                const response = await fetchWithAuth(url, {
                    method: method,
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || `Gagal ${id ? 'memperbarui' : 'menambah'} jenis tunjangan.`);
                }
                showAllowanceTypeModalMessage(data.message || `Jenis tunjangan berhasil ${id ? 'diperbarui' : 'ditambahkan'}!`, 'success');
                await fetchAndDisplayAllowanceTypes();
                if(allowanceTypeModal) {
                    setTimeout(() => {
                        allowanceTypeModal.style.display = 'none';
                    }, 1500);
                }
            } catch (error) {
                showAllowanceTypeModalMessage(error.message, 'error');
            } finally {
                if(allowanceTypeFormSubmitBtn) {
                    allowanceTypeFormSubmitBtn.disabled = false;
                    allowanceTypeFormSubmitBtn.textContent = 'Simpan';
                }
            }
        });
    }

    // === 7. FUNGSI HAPUS JENIS TUNJANGAN ===
    async function deleteAllowanceType(typeId, typeName) {
        if (!confirm(`Apakah Anda yakin ingin menghapus jenis tunjangan "${typeName}"? Ini juga akan menghapus penetapan tunjangan ini dari semua pengguna.`)) {
            return;
        }
        showAllowanceTypesMessage(`Menghapus ${typeName}...`, 'info', false);
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/allowance-types/${typeId}`, {
                method: 'DELETE'
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                if (response.status === 200 && !data.message) { // Handle 200 OK with empty body as success
                     showAllowanceTypesMessage(`Jenis tunjangan ${typeName} berhasil dihapus.`, 'success');
                } else {
                    throw new Error(data.message || `Gagal menghapus jenis tunjangan (Status: ${response.status}).`);
                }
            } else {
                 showAllowanceTypesMessage(data.message || `Jenis tunjangan ${typeName} berhasil dihapus.`, 'success');
            }
            await fetchAndDisplayAllowanceTypes();
        } catch (error) {
            console.error('Error deleting allowance type:', error);
            showAllowanceTypesMessage(error.message, 'error');
        }
    }

    // === 8. HELPER UNTUK MENAMPILKAN PESAN ===
    function showAllowanceTypesMessage(message, type = 'info', autohide = true) {
        if (!allowanceTypesMessageArea) return;
        allowanceTypesMessageArea.textContent = message;
        allowanceTypesMessageArea.className = `message ${type}`;
        allowanceTypesMessageArea.style.display = 'block';
        if (autohide) {
            setTimeout(() => { allowanceTypesMessageArea.style.display = 'none'; }, 4000);
        }
    }
    function showAllowanceTypeModalMessage(message, type = 'info') {
        if (!allowanceTypeModalMessageArea) return;
        allowanceTypeModalMessageArea.textContent = message;
        allowanceTypeModalMessageArea.className = `message ${type}`;
        allowanceTypeModalMessageArea.style.display = 'block';
    }

    // === 9. INISIALISASI & EVENT LISTENER TAMBAHAN ===
    if (loggedInUser && loggedInUser.role === 'SUPER_ADMIN') {
         if (typeof fetchWithAuth === 'function') {
            await fetchAndDisplayAllowanceTypes();
        } else {
            console.error("Fungsi fetchWithAuth tidak ditemukan. Pastikan auth_utils.js di-include.");
            showAllowanceTypesMessage("Error: Fungsi autentikasi tidak termuat.", "error", false);
        }
    }

    if(allowanceTypeModal) { // Tutup modal jika klik di luar kontennya
        window.addEventListener('click', function(event) {
            if (event.target == allowanceTypeModal) {
                allowanceTypeModal.style.display = "none";
            }
        });
    }
});