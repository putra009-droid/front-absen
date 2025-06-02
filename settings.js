// settings.js
document.addEventListener('DOMContentLoaded', async () => {
    // === 1. PENGATURAN DASAR & ELEMEN DOM ===
    const API_BASE_URL = 'https://akademik.online'; // PASTIKAN INI SESUAI!

    const adminSettingsInfoArea = document.getElementById('adminSettingsInfo');
    const logoutButtonSettings = document.getElementById('logoutButtonSettings');
    const settingsForm = document.getElementById('attendanceSettingsForm');
    const settingsMessageArea = document.getElementById('settingsMessageArea');

    // Elemen Form
    const workStartTimeHourInput = document.getElementById('workStartTimeHour');
    const workStartTimeMinuteInput = document.getElementById('workStartTimeMinute');
    const lateToleranceMinutesInput = document.getElementById('lateToleranceMinutes');
    const workEndTimeHourInput = document.getElementById('workEndTimeHour');
    const workEndTimeMinuteInput = document.getElementById('workEndTimeMinute');
    const isLocationLockActiveInput = document.getElementById('isLocationLockActive');
    const locationFieldsContainer = document.getElementById('locationFieldsContainer');
    const targetLatitudeInput = document.getElementById('targetLatitude');
    const targetLongitudeInput = document.getElementById('targetLongitude');
    const allowedRadiusMetersInput = document.getElementById('allowedRadiusMeters');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');

    // === 2. FUNGSI-FUNGSI AUTENTIKASI (fetchWithAuth, refreshToken, dll.) ===
    // DIASUMSIKAN FUNGSI-FUNGSI INI SUDAH ADA DARI auth_utils.js atau disalin ke sini.
    // Pastikan `API_BASE_URL` juga digunakan oleh `getNewAccessToken` jika memanggil `/api/refresh-token`
    // Untuk keringkasan, saya tidak akan menyalinnya lagi di sini.
    // Pastikan file auth_utils.js sudah di-include di settings.html SEBELUM settings.js jika dipisah.
    // Jika belum ada file auth_utils.js, salin fungsi-fungsi (isRefreshingToken, tokenRefreshQueue,
    // processTokenRefreshQueue, getNewAccessToken, fetchWithAuth, performLogoutClientSide) dari admin.js ke sini.

    // === 3. PENGECEKAN AUTENTIKASI & OTORISASI ADMIN ===
    const loggedInUserString = localStorage.getItem('user');
    if (!loggedInUserString || !localStorage.getItem('accessToken')) {
        // Ganti dengan `performLogoutClientSide` jika sudah ada di auth_utils.js
        alert('Anda belum login atau sesi telah berakhir. Silakan login kembali.');
        window.location.href = 'login.html';
        return;
    }

    let loggedInUser;
    try {
        loggedInUser = JSON.parse(loggedInUserString);
    } catch (e) {
        alert('Data sesi tidak valid. Silakan login kembali.');
        window.location.href = 'login.html';
        return;
    }

    if (!loggedInUser || loggedInUser.role !== 'SUPER_ADMIN') {
        showSettingsMessage('Akses Ditolak: Halaman ini hanya untuk SUPER_ADMIN.', 'error');
        if(settingsForm) settingsForm.style.display = 'none'; // Sembunyikan form jika bukan admin
        return;
    }

    if(adminSettingsInfoArea) adminSettingsInfoArea.textContent = `Admin: ${loggedInUser.name || loggedInUser.email}`;

    // === 4. FUNGSI LOGOUT ADMIN ===
    if (logoutButtonSettings) {
        logoutButtonSettings.addEventListener('click', async () => {
            const currentRefreshToken = localStorage.getItem('refreshToken');
            logoutButtonSettings.disabled = true;
            logoutButtonSettings.textContent = 'Logging out...';
            try {
                // Ganti `fetchWithAuth` dengan implementasi Anda jika sudah ada
                await fetchWithAuth(`${API_BASE_URL}/api/logout`, {
                    method: 'POST',
                    body: JSON.stringify({ refreshToken: currentRefreshToken })
                });
            } catch (error) {
                console.error('Error saat API logout, tetap logout sisi klien:', error);
            } finally {
                // Ganti dengan `performLogoutClientSide` jika sudah ada
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                alert('Anda telah logout dari panel admin.');
                window.location.href = 'login.html';
            }
        });
    }

    // === 5. FUNGSI UNTUK MENGAMBIL DAN MENGISI PENGATURAN SAAT INI ===
    async function loadAttendanceSettings() {
        showSettingsMessage('Memuat pengaturan...', 'info', false);
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/attendance-settings`);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: `Gagal memuat pengaturan (Status: ${response.status})` }));
                throw new Error(errData.message || errData.error || 'Gagal memuat pengaturan.');
            }
            const result = await response.json();
            if (result.success && result.data) {
                const settings = result.data;
                if(workStartTimeHourInput) workStartTimeHourInput.value = settings.workStartTimeHour;
                if(workStartTimeMinuteInput) workStartTimeMinuteInput.value = settings.workStartTimeMinute;
                if(lateToleranceMinutesInput) lateToleranceMinutesInput.value = settings.lateToleranceMinutes;
                if(workEndTimeHourInput) workEndTimeHourInput.value = settings.workEndTimeHour;
                if(workEndTimeMinuteInput) workEndTimeMinuteInput.value = settings.workEndTimeMinute;
                if(isLocationLockActiveInput) isLocationLockActiveInput.checked = settings.isLocationLockActive;
                if(targetLatitudeInput) targetLatitudeInput.value = settings.targetLatitude !== null ? settings.targetLatitude : '';
                if(targetLongitudeInput) targetLongitudeInput.value = settings.targetLongitude !== null ? settings.targetLongitude : '';
                if(allowedRadiusMetersInput) allowedRadiusMetersInput.value = settings.allowedRadiusMeters !== null ? settings.allowedRadiusMeters : '';

                toggleLocationFields(settings.isLocationLockActive); // Atur visibilitas field lokasi
                showSettingsMessage('Pengaturan berhasil dimuat.', 'success');
            } else {
                throw new Error(result.message || 'Format data pengaturan tidak sesuai.');
            }
        } catch (error) {
            console.error('Error loading attendance settings:', error);
            showSettingsMessage(`Error memuat pengaturan: ${error.message}`, 'error');
        }
    }

    // === 6. FUNGSI UNTUK MENGATUR VISIBILITAS FIELD LOKASI ===
    function toggleLocationFields(isLockActive) {
        if (locationFieldsContainer) {
            locationFieldsContainer.style.display = isLockActive ? 'block' : 'none';
        }
        // Tambahkan/hapus atribut 'required' berdasarkan status lock
        const locationInputs = [targetLatitudeInput, targetLongitudeInput, allowedRadiusMetersInput];
        locationInputs.forEach(input => {
            if (input) {
                if (isLockActive) {
                    // input.required = true; // Anda bisa tambahkan validasi required di sini jika mau
                } else {
                    // input.required = false;
                }
            }
        });
    }

    if (isLocationLockActiveInput) {
        isLocationLockActiveInput.addEventListener('change', (event) => {
            toggleLocationFields(event.target.checked);
        });
    }

    // === 7. FUNGSI UNTUK MENYIMPAN PENGATURAN ===
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if(saveSettingsBtn) {
                saveSettingsBtn.disabled = true;
                saveSettingsBtn.textContent = 'Menyimpan...';
            }
            showSettingsMessage('Menyimpan pengaturan...', 'info', false);

            // Validasi dasar input angka
            const parseNumericInput = (inputElement, fieldName, allowFloat = false) => {
                if (!inputElement || inputElement.value === '') return null; // Boleh null/kosong jika tidak diisi
                const value = allowFloat ? parseFloat(inputElement.value) : parseInt(inputElement.value, 10);
                if (isNaN(value)) {
                    throw new Error(`Nilai untuk ${fieldName} harus berupa angka.`);
                }
                return value;
            };
            
            let payload;
            try {
                payload = {
                    workStartTimeHour: parseNumericInput(workStartTimeHourInput, 'Jam Mulai Kerja'),
                    workStartTimeMinute: parseNumericInput(workStartTimeMinuteInput, 'Menit Mulai Kerja'),
                    lateToleranceMinutes: parseNumericInput(lateToleranceMinutesInput, 'Toleransi Keterlambatan'),
                    workEndTimeHour: parseNumericInput(workEndTimeHourInput, 'Jam Selesai Kerja'),
                    workEndTimeMinute: parseNumericInput(workEndTimeMinuteInput, 'Menit Selesai Kerja'),
                    isLocationLockActive: isLocationLockActiveInput ? isLocationLockActiveInput.checked : false,
                    targetLatitude: null,
                    targetLongitude: null,
                    allowedRadiusMeters: null,
                };

                // Cek field wajib (jam dan menit tidak boleh null)
                if (payload.workStartTimeHour === null || payload.workStartTimeMinute === null || 
                    payload.lateToleranceMinutes === null || payload.workEndTimeHour === null || payload.workEndTimeMinute === null) {
                    throw new Error('Field waktu kerja dan toleransi tidak boleh kosong.');
                }


                if (payload.isLocationLockActive) {
                    payload.targetLatitude = parseNumericInput(targetLatitudeInput, 'Latitude Target', true);
                    payload.targetLongitude = parseNumericInput(targetLongitudeInput, 'Longitude Target', true);
                    payload.allowedRadiusMeters = parseNumericInput(allowedRadiusMetersInput, 'Radius');

                    if (payload.targetLatitude === null || payload.targetLongitude === null || payload.allowedRadiusMeters === null) {
                        throw new Error('Jika kunci lokasi aktif, Latitude, Longitude, dan Radius wajib diisi dengan angka yang valid.');
                    }
                     if (payload.targetLatitude < -90 || payload.targetLatitude > 90) throw new Error('Latitude harus antara -90 dan 90.');
                     if (payload.targetLongitude < -180 || payload.targetLongitude > 180) throw new Error('Longitude harus antara -180 dan 180.');
                     if (payload.allowedRadiusMeters <= 0) throw new Error('Radius harus lebih besar dari 0.');
                }

            } catch (validationError) {
                showSettingsMessage(validationError.message, 'error');
                 if(saveSettingsBtn) {
                    saveSettingsBtn.disabled = false;
                    saveSettingsBtn.textContent = 'Simpan Pengaturan';
                }
                return;
            }


            try {
                const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/attendance-settings`, {
                    method: 'POST', // Backend menggunakan POST untuk create/update (upsert)
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.message || 'Gagal menyimpan pengaturan.');
                }
                showSettingsMessage('Pengaturan berhasil disimpan!', 'success');
                // Muat ulang data untuk memastikan form terupdate dengan nilai dari server (jika ada pembulatan dll)
                await loadAttendanceSettings(); 

            } catch (error) {
                console.error('Error saving attendance settings:', error);
                showSettingsMessage(`Error menyimpan pengaturan: ${error.message}`, 'error');
            } finally {
                 if(saveSettingsBtn) {
                    saveSettingsBtn.disabled = false;
                    saveSettingsBtn.textContent = 'Simpan Pengaturan';
                }
            }
        });
    }

    // === 8. HELPER UNTUK MENAMPILKAN PESAN ===
    function showSettingsMessage(message, type = 'info', autohide = true) {
        if (!settingsMessageArea) return;
        settingsMessageArea.textContent = message;
        settingsMessageArea.className = `message ${type}`;
        settingsMessageArea.style.display = 'block';
        if (autohide) {
            setTimeout(() => { settingsMessageArea.style.display = 'none'; }, 4000);
        }
    }

    // === 9. INISIALISASI HALAMAN ===
    if (loggedInUser && loggedInUser.role === 'SUPER_ADMIN') {
        if (typeof fetchWithAuth === 'function') {
            await loadAttendanceSettings();
        } else {
            console.error("Fungsi fetchWithAuth tidak ditemukan. Pastikan auth_utils.js di-include.");
            showSettingsMessage("Error: Fungsi autentikasi tidak termuat.", "error", false);
        }
    }
});