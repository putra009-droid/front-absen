// dashboard.js

// Diasumsikan API_BASE_URL, fetchWithAuth, performLogoutClientSide, dll.
// sudah tersedia global dari auth_utils.js yang di-include di dashboard.html

document.addEventListener('DOMContentLoaded', async function () {
    const logoutButtonUser = document.getElementById('logoutButtonUser');
    const userInfoArea = document.getElementById('userInfo');
    const adminAccessArea = document.getElementById('adminAccessArea');
    const yayasanAccessArea = document.getElementById('yayasanAccessArea');
    const userFeatures = document.getElementById('userFeatures'); // Kontainer untuk fitur spesifik pengguna
    const payslipAccessArea = document.getElementById('payslipAccessArea'); // Kontainer untuk link slip gaji
    const messageAreaDashboard = document.getElementById('messageAreaDashboard');

    // Elemen untuk fitur absensi pengguna
    const attendanceStatusArea = document.getElementById('attendanceStatusArea');
    const currentAttendanceStatusElem = document.getElementById('currentAttendanceStatus');
    const clockInBtn = document.getElementById('clockInBtn');
    const clockOutBtn = document.getElementById('clockOutBtn');
    const requestLeaveBtn = document.getElementById('requestLeaveBtn');


    // Pengecekan fungsi autentikasi dari auth_utils.js
    if (typeof performLogoutClientSide !== 'function' || typeof fetchWithAuth !== 'function') {
        console.error("Fungsi autentikasi (performLogoutClientSide atau fetchWithAuth) tidak ditemukan. Pastikan auth_utils.js di-include dengan benar sebelum skrip ini.");
        if (userInfoArea) userInfoArea.textContent = "Error: Komponen autentikasi gagal dimuat.";
        // Nonaktifkan semua interaksi jika auth_utils tidak ada
        if(logoutButtonUser) logoutButtonUser.disabled = true;
        if(clockInBtn) clockInBtn.disabled = true;
        if(clockOutBtn) clockOutBtn.disabled = true;
        if(requestLeaveBtn) requestLeaveBtn.disabled = true;
        return;
    }

    // Cek apakah pengguna sudah login
    const accessToken = localStorage.getItem('accessToken');
    const userString = localStorage.getItem('user');

    if (!accessToken || !userString) {
        performLogoutClientSide('Sesi tidak ditemukan atau telah berakhir. Silakan login kembali.', 'login.html');
        return;
    }

    let loggedInUser;
    try {
        loggedInUser = JSON.parse(userString);
        if (userInfoArea) userInfoArea.textContent = `Halo, ${loggedInUser.name || loggedInUser.email}! (${loggedInUser.role})`;
    } catch (e) {
        console.error("Gagal parse info user dari localStorage:", e);
        performLogoutClientSide('Data sesi pengguna rusak. Silakan login kembali.', 'login.html');
        return;
    }

    // Reset tampilan awal elemen kondisional
    if(adminAccessArea) adminAccessArea.style.display = 'none';
    if(yayasanAccessArea) yayasanAccessArea.style.display = 'none';
    if(userFeatures) userFeatures.style.display = 'block'; // Default tampilkan fitur user
    if(payslipAccessArea) payslipAccessArea.style.display = 'none';


    // Tampilkan link navigasi berdasarkan role
    if (loggedInUser) {
        if (loggedInUser.role === 'SUPER_ADMIN') {
            if (adminAccessArea) adminAccessArea.style.display = 'inline-block';
            if (userFeatures) userFeatures.style.display = 'none'; // SUPER_ADMIN tidak melakukan absensi pribadi di sini
        } else if (loggedInUser.role === 'YAYASAN') {
            if (yayasanAccessArea) yayasanAccessArea.style.display = 'inline-block';
            if (userFeatures) userFeatures.style.display = 'none'; // Yayasan tidak melakukan absensi pribadi di sini
        } else {
            // Untuk role lain (EMPLOYEE, REKTOR, PR1, PR2)
            if (userFeatures) userFeatures.style.display = 'block';
            if (payslipAccessArea) payslipAccessArea.style.display = 'block';
            await fetchDailyAttendanceStatus(); // Hanya panggil untuk pengguna yang melakukan absensi
        }
    }


    // Fungsi Logout untuk Dashboard User
    if (logoutButtonUser) {
        logoutButtonUser.addEventListener('click', async function () {
            const currentRefreshToken = localStorage.getItem('refreshToken');
            logoutButtonUser.disabled = true;
            logoutButtonUser.textContent = 'Logging out...';
            try {
                await fetchWithAuth(`${API_BASE_URL}/api/logout`, { // API_BASE_URL dari auth_utils.js
                    method: 'POST',
                    body: JSON.stringify({ refreshToken: currentRefreshToken })
                });
            } catch (error) {
                console.error('Error saat API logout, tetap logout sisi klien:', error);
            } finally {
                performLogoutClientSide('Anda telah logout.', 'login.html');
            }
        });
    }

    // Fungsi untuk mengambil dan menampilkan status absensi hari ini
    async function fetchDailyAttendanceStatus() {
        if (!currentAttendanceStatusElem || !attendanceStatusArea) return;
        if (!loggedInUser || loggedInUser.role === 'SUPER_ADMIN' || loggedInUser.role === 'YAYASAN') {
            attendanceStatusArea.style.display = 'none'; // Sembunyikan bagian absensi untuk role ini
            return;
        }
        attendanceStatusArea.style.display = 'block';
        currentAttendanceStatusElem.textContent = 'Memeriksa status absensi...';

        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/attendance/status-harian`); // API_BASE_URL dari auth_utils.js
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: `Gagal mengambil status absensi (Status: ${response.status})` }));
                throw new Error(errData.message || errData.error || `Gagal memuat status absensi.`);
            }
            const result = await response.json();
            if (result.success && result.data) {
                const statusData = result.data;
                let statusText = `Status Hari Ini: ${statusData.status}`;
                if (statusData.clockIn) {
                    statusText += ` (Clock In: ${new Date(statusData.clockIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit'})})`;
                }
                if (statusData.clockOut) {
                    statusText += ` (Clock Out: ${new Date(statusData.clockOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit'})})`;
                }
                currentAttendanceStatusElem.textContent = statusText;

                // Atur visibilitas tombol Clock In/Out berdasarkan status
                if (clockInBtn && clockOutBtn) {
                    if (statusData.status === 'BELUM' || statusData.status === 'ALPHA') {
                        clockInBtn.style.display = 'inline-block';
                        clockOutBtn.style.display = 'none';
                    } else if (statusData.status === 'HADIR' || statusData.status === 'TERLAMBAT') {
                        clockInBtn.style.display = 'none';
                        clockOutBtn.style.display = 'inline-block';
                    } else { // SELESAI, IZIN, SAKIT, CUTI, LIBUR
                        clockInBtn.style.display = 'none';
                        clockOutBtn.style.display = 'none';
                    }
                }
            } else {
                throw new Error(result.message || 'Format data status tidak sesuai dari server.');
            }
        } catch (error) {
            console.error('Error fetching daily attendance status:', error);
            if (currentAttendanceStatusElem) currentAttendanceStatusElem.textContent = `Error memuat status: ${error.message}`;
            if (clockInBtn) clockInBtn.style.display = 'inline-block'; // Tombol default jika error
            if (clockOutBtn) clockOutBtn.style.display = 'none';
        }
    }

    // Event listener untuk tombol-tombol aksi pengguna (implementasi detail menyusul)
    if (clockInBtn) {
        clockInBtn.addEventListener('click', () => {
            // Nanti akan diarahkan ke halaman/modal clock-in atau langsung proses
            alert('Fungsi Clock In akan diimplementasikan di sini atau di halaman/widget terpisah!');
        });
    }

    if (clockOutBtn) {
        clockOutBtn.addEventListener('click', () => {
            alert('Fungsi Clock Out akan diimplementasikan di sini atau di halaman/widget terpisah!');
        });
    }

    if (requestLeaveBtn) {
        requestLeaveBtn.addEventListener('click', () => {
            // Arahkan ke halaman pengajuan izin, contoh:
            window.location.href = 'request-leave.html'; // Anda perlu buat halaman ini
            // alert('Fungsi Ajukan Izin akan diimplementasikan di halaman terpisah!');
        });
    }

    // Fungsi untuk menampilkan pesan di dashboard
    function showDashboardMessage(message, type = 'info', autohide = true) {
        if (!messageAreaDashboard) return;
        messageAreaDashboard.textContent = message;
        messageAreaDashboard.className = `message ${type}`;
        messageAreaDashboard.style.display = 'block';
        if (autohide) {
            setTimeout(() => { if(messageAreaDashboard) messageAreaDashboard.style.display = 'none'; }, 4000);
        }
    }

    // Panggil fungsi inisialisasi yang memerlukan data async (seperti status absensi)
    // Pemanggilan fetchDailyAttendanceStatus sudah dipindahkan ke dalam blok kondisional role
});