// admin.js
document.addEventListener('DOMContentLoaded', async () => {
    // === 1. PENGATURAN DASAR & ELEMEN DOM ===
    const API_BASE_URL = 'https://akademik.online'; // PASTIKAN INI SESUAI! (atau http://37.44.244.93 jika belum pakai domain)

    const adminInfoArea = document.getElementById('adminInfo');
    const logoutButtonAdmin = document.getElementById('logoutButtonAdmin');
    const usersTableBody = document.getElementById('usersTableBody');
    const adminMessageArea = document.getElementById('adminMessageArea');

    // Elemen Modal Tambah/Edit Pengguna
    const userModal = document.getElementById('userModal');
    const userModalTitle = document.getElementById('userModalTitle');
    const userForm = document.getElementById('userForm');
    const userIdInput = document.getElementById('userId'); // Hidden input untuk ID saat edit
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const passwordFieldContainer = document.getElementById('passwordFieldContainer');
    const roleInput = document.getElementById('role');
    const baseSalaryInput = document.getElementById('baseSalary');
    const userFormSubmitBtn = document.getElementById('userFormSubmitBtn');
    const userModalMessageArea = document.getElementById('userModalMessageArea');
    const showAddUserModalBtn = document.getElementById('showAddUserModalBtn');
    const closeUserModalBtn = document.getElementById('closeUserModalBtn');

    // Elemen Modal Reset Password
    const resetPasswordModal = document.getElementById('resetPasswordModal');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const resetPasswordUserIdInput = document.getElementById('resetPasswordUserId');
    const resetPasswordUserNameSpan = document.getElementById('resetPasswordUserName');
    const newPasswordInput = document.getElementById('newPassword');
    const resetPasswordSubmitBtn = document.getElementById('resetPasswordSubmitBtn');
    const resetPasswordModalMessageArea = document.getElementById('resetPasswordModalMessageArea');
    const closeResetPasswordModalBtn = document.getElementById('closeResetPasswordModalBtn');

    let currentUserForEdit = null; // Untuk menyimpan data user yang sedang diedit/dilihat

    // === 2. FUNGSI-FUNGSI AUTENTIKASI (fetchWithAuth, refreshToken, dll.) ===
    // DIASUMSIKAN FUNGSI-FUNGSI INI SUDAH ADA DARI auth_utils.js atau disalin ke sini.
    // Pastikan `API_BASE_URL` juga digunakan oleh `getNewAccessToken` jika memanggil `/api/refresh-token`
    // Contoh deklarasi jika fungsi-fungsi ini ada di file ini:

    let isRefreshingToken = false;
    let tokenRefreshQueue = [];

    const processTokenRefreshQueue = (error, token = null) => {
        tokenRefreshQueue.forEach(prom => {
            if (error) prom.reject(error);
            else prom.resolve(token);
        });
        tokenRefreshQueue = [];
    };

    async function getNewAccessToken() {
        const currentRefreshToken = localStorage.getItem('refreshToken');
        if (!currentRefreshToken) {
            console.log('Tidak ada refresh token, proses logout.');
            performLogoutClientSide('Sesi refresh tidak valid. Silakan login kembali.');
            return Promise.reject(new Error('No refresh token available'));
        }
        try {
            const response = await fetch(`${API_BASE_URL}/api/refresh-token`, { // Menggunakan API_BASE_URL
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: currentRefreshToken }),
            });
            const data = await response.json();
            if (!response.ok) {
                console.error('Refresh token gagal:', data.error || 'Unknown error');
                performLogoutClientSide(data.error || 'Sesi refresh gagal. Silakan login kembali.');
                throw new Error(data.error || 'Failed to refresh token');
            }
            localStorage.setItem('accessToken', data.accessToken);
            console.log('Access token berhasil di-refresh.');
            return data.accessToken;
        } catch (error) {
            console.error('Error saat refresh token:', error);
            performLogoutClientSide('Error saat memperbarui sesi. Silakan login kembali.');
            throw error;
        }
    }

    async function fetchWithAuth(url, options = {}) {
        let token = localStorage.getItem('accessToken');

        async function makeRequest(currentToken) {
            const headers = { ...options.headers }; // Salin headers awal
             // Set Content-Type ke application/json secara default JIKA body bukan FormData
            if (!(options.body instanceof FormData)) {
                headers['Content-Type'] = 'application/json';
            }

            if (currentToken) {
                headers['Authorization'] = `Bearer ${currentToken}`;
            }

            // Untuk FormData, browser akan set Content-Type otomatis termasuk boundary, jadi hapus jika kita set manual
            if (options.body instanceof FormData && headers['Content-Type']) {
                delete headers['Content-Type'];
            }

            const newOptions = { ...options, headers };
            return fetch(url, newOptions);
        }

        let response = await makeRequest(token);

        if (response.status === 401) {
            const errorData = await response.clone().json().catch(() => ({}));
            if (errorData.message && (errorData.message.includes('TokenExpiredError') || errorData.message.includes('kedaluwarsa'))) {
                if (!isRefreshingToken) {
                    isRefreshingToken = true;
                    try {
                        console.log('Access token kedaluwarsa, mencoba refresh...');
                        const newAccessToken = await getNewAccessToken();
                        isRefreshingToken = false;
                        processTokenRefreshQueue(null, newAccessToken);
                        response = await makeRequest(newAccessToken);
                    } catch (refreshError) {
                        isRefreshingToken = false;
                        processTokenRefreshQueue(refreshError, null);
                        return Promise.reject(refreshError);
                    }
                } else {
                    console.log('Antri untuk mendapatkan token baru...');
                    return new Promise((resolve, reject) => {
                        tokenRefreshQueue.push({
                            resolve: async (newAccessTokenAfterWait) => {
                                response = await makeRequest(newAccessTokenAfterWait);
                                resolve(response);
                            },
                            reject
                        });
                    });
                }
            } else if (errorData.message && errorData.message.includes('Akses Ditolak')) {
                console.warn('Akses ditolak (bukan token expired):', errorData.message);
                // Tidak otomatis logout, biarkan pemanggil menangani error otorisasi
            }
        }
        return response;
    }

    function performLogoutClientSide(message = 'Anda telah logout.', redirectPage = 'login.html') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        if (message) alert(message);
        window.location.href = redirectPage;
    }

    // === 3. PENGECEKAN AUTENTIKASI & OTORISASI ADMIN ===
    const loggedInUserString = localStorage.getItem('user');
    if (!loggedInUserString || !localStorage.getItem('accessToken')) {
        performLogoutClientSide('Anda belum login atau sesi telah berakhir. Silakan login kembali.');
        return;
    }

    let loggedInUser;
    try {
        loggedInUser = JSON.parse(loggedInUserString);
    } catch (e) {
        performLogoutClientSide('Data sesi tidak valid. Silakan login kembali.');
        return;
    }

    if (!loggedInUser || loggedInUser.role !== 'SUPER_ADMIN') {
        adminMessageArea.textContent = 'Akses Ditolak: Halaman ini hanya untuk SUPER_ADMIN.';
        adminMessageArea.className = 'message error';
        adminMessageArea.style.display = 'block';
        if(document.querySelector('.user-list-container')) document.querySelector('.user-list-container').style.display = 'none';
        if(showAddUserModalBtn) showAddUserModalBtn.style.display = 'none';
        if(logoutButtonAdmin) logoutButtonAdmin.style.display = 'none'; // Sembunyikan tombol logout juga
        return;
    }

    if(adminInfoArea) adminInfoArea.textContent = `Admin: ${loggedInUser.name || loggedInUser.email}`;

    // === 4. FUNGSI LOGOUT ADMIN ===
    if (logoutButtonAdmin) {
        logoutButtonAdmin.addEventListener('click', async () => {
            const currentRefreshToken = localStorage.getItem('refreshToken');
            logoutButtonAdmin.disabled = true;
            logoutButtonAdmin.textContent = 'Logging out...';
            try {
                await fetchWithAuth(`${API_BASE_URL}/api/logout`, {
                    method: 'POST',
                    body: JSON.stringify({ refreshToken: currentRefreshToken })
                });
            } catch (error) {
                console.error('Error saat API logout, tetap logout sisi klien:', error);
            } finally {
                performLogoutClientSide('Anda telah logout dari panel admin.');
            }
        });
    }

    // === 5. FUNGSI UNTUK MENGAMBIL DAN MENAMPILKAN DAFTAR PENGGUNA ===
    async function fetchAndDisplayUsers() {
        if (!usersTableBody) return;
        usersTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Memuat data pengguna...</td></tr>';
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users`); // Menggunakan API_BASE_URL
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: `Gagal mengambil data pengguna (Status: ${response.status})` }));
                throw new Error(errData.message);
            }
            const users = await response.json();
            usersTableBody.innerHTML = '';

            if (users.length === 0) {
                usersTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Tidak ada data pengguna.</td></tr>';
                return;
            }

            users.forEach((user, index) => {
                const row = usersTableBody.insertRow();
                row.insertCell().textContent = index + 1;
                row.insertCell().textContent = user.name;
                row.insertCell().textContent = user.email;
                row.insertCell().textContent = user.role;
                row.insertCell().textContent = user.baseSalary ? parseFloat(user.baseSalary).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }) : '-';

                const actionsCell = row.insertCell();
                actionsCell.className = 'actions';

                const editBtn = document.createElement('button');
                editBtn.textContent = 'Edit';
                editBtn.className = 'edit-btn';
                editBtn.onclick = () => openUserModalForEdit(user);
                actionsCell.appendChild(editBtn);

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Hapus';
                deleteBtn.className = 'delete-btn';
                if (user.id === loggedInUser.id) {
                    deleteBtn.disabled = true;
                    deleteBtn.title = "Tidak bisa menghapus diri sendiri";
                }
                deleteBtn.onclick = () => deleteUser(user.id, user.name);
                actionsCell.appendChild(deleteBtn);

                const resetPassBtn = document.createElement('button');
                resetPassBtn.textContent = 'Reset Pass';
                resetPassBtn.className = 'reset-password-btn';
                resetPassBtn.onclick = () => openResetPasswordModal(user);
                actionsCell.appendChild(resetPassBtn);
            });
        } catch (error) {
            console.error('Error fetching users:', error);
            if (usersTableBody) usersTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Error: ${error.message}</td></tr>`;
            showAdminMessage(error.message, 'error');
        }
    }

    // === 6. LOGIKA MODAL TAMBAH/EDIT PENGGUNA ===
    function populateRoleDropdown() {
        const roles = ["EMPLOYEE", "YAYASAN", "REKTOR", "PR1", "PR2"]; // SUPER_ADMIN tidak bisa dibuat/diedit dari sini
        if (!roleInput) return;
        roleInput.innerHTML = '';
        roles.forEach(r => {
            const option = document.createElement('option');
            option.value = r;
            option.textContent = r;
            roleInput.appendChild(option);
        });
    }

    function openUserModalForAdd() {
        currentUserForEdit = null;
        if (userModalTitle) userModalTitle.textContent = 'Tambah Pengguna Baru';
        if (userForm) userForm.reset();
        if (userIdInput) userIdInput.value = '';
        if (emailInput) emailInput.disabled = false;
        if (passwordInput) passwordInput.required = true;
        if (passwordFieldContainer) passwordFieldContainer.style.display = 'block';
        populateRoleDropdown();
        if (roleInput) roleInput.value = 'EMPLOYEE';
        if (baseSalaryInput) baseSalaryInput.value = '';
        if (userModalMessageArea) userModalMessageArea.style.display = 'none';
        if (userModal) userModal.style.display = 'block';
    }

    function openUserModalForEdit(user) {
        currentUserForEdit = user;
        if (userModalTitle) userModalTitle.textContent = `Edit Pengguna: ${user.name}`;
        if (userForm) userForm.reset();
        if (userIdInput) userIdInput.value = user.id;
        if (nameInput) nameInput.value = user.name;
        if (emailInput) {
            emailInput.value = user.email;
            emailInput.disabled = true;
        }
        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.required = false; // Password tidak wajib saat edit
            passwordInput.placeholder = "Kosongkan jika tidak ingin ubah";
        }
        if (passwordFieldContainer) passwordFieldContainer.style.display = 'block';
        populateRoleDropdown();
        if (roleInput) roleInput.value = user.role;
        if (baseSalaryInput) baseSalaryInput.value = user.baseSalary ? parseFloat(user.baseSalary) : '';

        if (userModalMessageArea) userModalMessageArea.style.display = 'none';
        if (userModal) userModal.style.display = 'block';
    }

    if (closeUserModalBtn) {
        closeUserModalBtn.onclick = () => { if (userModal) userModal.style.display = 'none'; };
    }
    if (showAddUserModalBtn) {
        showAddUserModalBtn.onclick = openUserModalForAdd;
    }

    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (userFormSubmitBtn) {
                userFormSubmitBtn.disabled = true;
                userFormSubmitBtn.textContent = 'Menyimpan...';
            }
            if (userModalMessageArea) userModalMessageArea.style.display = 'none';

            const id = userIdInput ? userIdInput.value : null;
            const name = nameInput ? nameInput.value : '';
            const email = emailInput ? emailInput.value : '';
            const password = passwordInput ? passwordInput.value : '';
            const role = roleInput ? roleInput.value : 'EMPLOYEE';
            const rawBaseSalary = baseSalaryInput ? baseSalaryInput.value : '';
            const baseSalary = rawBaseSalary === '' || rawBaseSalary === null ? null : String(parseFloat(rawBaseSalary));

            const payload = { name, role, baseSalary };
            let url = `${API_BASE_URL}/api/admin/users`;
            let method = 'POST';

            if (id) { // Mode Edit
                url = `${API_BASE_URL}/api/admin/users/${id}`;
                method = 'PUT';
                // Untuk edit, hanya kirim field yang diisi atau diubah.
                // Backend API PUT /api/admin/users/[userId] mengharapkan field yg mau diupdate saja.
                // Password tidak diupdate melalui endpoint ini, gunakan reset password.
            } else { // Mode Tambah
                payload.email = email;
                if (!password || password.trim() === '' || password.length < 6) {
                    showUserModalMessage('Password wajib diisi (minimal 6 karakter) untuk pengguna baru.', 'error');
                    if (userFormSubmitBtn) {
                        userFormSubmitBtn.disabled = false;
                        userFormSubmitBtn.textContent = 'Simpan';
                    }
                    return;
                }
                payload.password = password;
            }

            try {
                const response = await fetchWithAuth(url, {
                    method: method,
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || `Gagal ${id ? 'memperbarui' : 'menambah'} pengguna.`);
                }
                showUserModalMessage(data.message || `Pengguna berhasil ${id ? 'diperbarui' : 'ditambahkan'}!`, 'success');
                await fetchAndDisplayUsers();
                if (userModal) {
                    setTimeout(() => {
                        userModal.style.display = 'none';
                    }, 1500);
                }
            } catch (error) {
                showUserModalMessage(error.message, 'error');
            } finally {
                if (userFormSubmitBtn) {
                    userFormSubmitBtn.disabled = false;
                    userFormSubmitBtn.textContent = 'Simpan';
                }
            }
        });
    }

    // === 7. FUNGSI HAPUS PENGGUNA ===
    async function deleteUser(userId, userName) {
        if (!confirm(`Apakah Anda yakin ingin menghapus pengguna "${userName}" (ID: ${userId})? Aksi ini tidak bisa dibatalkan.`)) {
            return;
        }
        showAdminMessage(`Menghapus ${userName}...`, 'info', false);
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${userId}`, {
                method: 'DELETE'
            });
            const data = await response.json().catch(() => ({})); // Tangkap jika respons bukan JSON
            if (!response.ok) {
                 // Jika respons adalah 200 tapi body kosong, json() akan error.
                if (response.status === 200 && !data.message) { // Asumsi sukses jika status 200 dan body kosong
                     showAdminMessage(`Pengguna ${userName} berhasil dihapus.`, 'success');
                } else {
                    throw new Error(data.message || `Gagal menghapus pengguna (Status: ${response.status}).`);
                }
            } else {
                 showAdminMessage(data.message || `Pengguna ${userName} berhasil dihapus.`, 'success');
            }
            await fetchAndDisplayUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            showAdminMessage(error.message, 'error');
        }
    }

    // === 8. LOGIKA MODAL RESET PASSWORD ===
    function openResetPasswordModal(user) {
        if (resetPasswordModal) resetPasswordModal.style.display = 'block';
        if (resetPasswordForm) resetPasswordForm.reset();
        if (resetPasswordUserIdInput) resetPasswordUserIdInput.value = user.id;
        if (resetPasswordUserNameSpan) resetPasswordUserNameSpan.textContent = `${user.name} (${user.email})`;
        if (resetPasswordModalMessageArea) resetPasswordModalMessageArea.style.display = 'none';
    }

    if (closeResetPasswordModalBtn) {
        closeResetPasswordModalBtn.onclick = () => { if (resetPasswordModal) resetPasswordModal.style.display = 'none'; };
    }

    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(resetPasswordSubmitBtn) {
                resetPasswordSubmitBtn.disabled = true;
                resetPasswordSubmitBtn.textContent = 'Memproses...';
            }
            if(resetPasswordModalMessageArea) resetPasswordModalMessageArea.style.display = 'none';

            const userId = resetPasswordUserIdInput ? resetPasswordUserIdInput.value : null;
            const newPassword = newPasswordInput ? newPasswordInput.value : '';

            if (newPassword.length < 6) {
                showResetPasswordModalMessage('Password baru minimal 6 karakter.', 'error');
                if (resetPasswordSubmitBtn) {
                    resetPasswordSubmitBtn.disabled = false;
                    resetPasswordSubmitBtn.textContent = 'Reset Password';
                }
                return;
            }

            try {
                const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${userId}/reset-password`, {
                    method: 'POST',
                    body: JSON.stringify({ newPassword })
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Gagal mereset password.');
                }
                showResetPasswordModalMessage(data.message || 'Password berhasil direset!', 'success');
                if (resetPasswordModal) {
                    setTimeout(() => {
                        resetPasswordModal.style.display = 'none';
                    }, 2000);
                }
            } catch (error) {
                showResetPasswordModalMessage(error.message, 'error');
            } finally {
                if (resetPasswordSubmitBtn) {
                    resetPasswordSubmitBtn.disabled = false;
                    resetPasswordSubmitBtn.textContent = 'Reset Password';
                }
            }
        });
    }

    // === 9. HELPER UNTUK MENAMPILKAN PESAN ===
    function showAdminMessage(message, type = 'info', autohide = true) {
        if (!adminMessageArea) return;
        adminMessageArea.textContent = message;
        adminMessageArea.className = `message ${type}`;
        adminMessageArea.style.display = 'block';
        if (autohide) {
            setTimeout(() => { adminMessageArea.style.display = 'none'; }, 4000);
        }
    }
    function showUserModalMessage(message, type = 'info') {
        if (!userModalMessageArea) return;
        userModalMessageArea.textContent = message;
        userModalMessageArea.className = `message ${type}`;
        userModalMessageArea.style.display = 'block';
    }
    function showResetPasswordModalMessage(message, type = 'info') {
        if (!resetPasswordModalMessageArea) return;
        resetPasswordModalMessageArea.textContent = message;
        resetPasswordModalMessageArea.className = `message ${type}`;
        resetPasswordModalMessageArea.style.display = 'block';
    }

    // === 10. INISIALISASI & EVENT LISTENER TAMBAHAN ===
    if (loggedInUser && loggedInUser.role === 'SUPER_ADMIN') {
        await fetchAndDisplayUsers();
    }

    window.onclick = function(event) { // Tutup modal jika klik di luar kontennya
        if (event.target == userModal && userModal) {
            userModal.style.display = "none";
        }
        if (event.target == resetPasswordModal && resetPasswordModal) {
            resetPasswordModal.style.display = "none";
        }
    }
});