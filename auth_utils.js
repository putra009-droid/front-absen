// auth_utils.js

const API_BASE_URL = 'https://akademik.online'; // ATAU http://37.44.244.93 jika belum pakai domain HTTPS
                                             // PASTIKAN INI SESUAI DENGAN SETUP ANDA

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
        console.log('[AuthUtils] Tidak ada refresh token, proses logout.');
        performLogoutClientSide('Sesi refresh tidak valid. Silakan login kembali.'); // Panggil fungsi logout
        return Promise.reject(new Error('No refresh token available'));
    }
    try {
        console.log(`[AuthUtils] Mencoba refresh token dengan: ${currentRefreshToken ? currentRefreshToken.substring(0,15) + "..." : "NULL"}`);
        const response = await fetch(`${API_BASE_URL}/api/refresh-token`, { // Menggunakan API_BASE_URL
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: currentRefreshToken }),
        });
        const data = await response.json();
        if (!response.ok) {
            console.error('[AuthUtils] Refresh token gagal:', data.error || `Unknown error, Status: ${response.status}`);
            performLogoutClientSide(data.error || `Sesi refresh gagal (Status: ${response.status}). Silakan login kembali.`);
            throw new Error(data.error || 'Failed to refresh token');
        }
        localStorage.setItem('accessToken', data.accessToken);
        console.log(`[AuthUtils] Access token berhasil di-refresh. Token baru: ${data.accessToken ? data.accessToken.substring(0,20) + "..." : "NULL"}`);
        return data.accessToken;
    } catch (error) {
        console.error('[AuthUtils] Error saat API refresh token:', error);
        performLogoutClientSide('Error saat memperbarui sesi. Silakan login kembali.');
        throw error;
    }
}

async function fetchWithAuth(url, options = {}) {
    console.log(`[AuthUtils:fetchWithAuth] Memulai untuk URL: ${url}`);
    let token = localStorage.getItem('accessToken');
    console.log(`[AuthUtils:fetchWithAuth] Token awal dari localStorage: ${token ? token.substring(0, 20) + '...' : 'NULL'}`);

    async function makeRequest(currentToken, attempt = 1) {
        console.log(`[AuthUtils:fetchWithAuth] makeRequest (Percobaan ${attempt}) untuk URL: ${url} dengan token: ${currentToken ? currentToken.substring(0, 20) + '...' : 'NULL'}`);
        const headers = { ...options.headers };
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        if (currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
        }
        if (options.body instanceof FormData && headers['Content-Type']) {
            delete headers['Content-Type'];
        }
        const newOptions = { ...options, headers };
        const currentResponse = await fetch(url, newOptions); // Ganti nama variabel agar tidak konflik
        console.log(`[AuthUtils:fetchWithAuth] makeRequest (Percobaan ${attempt}) respons status: ${currentResponse.status} untuk URL: ${url}`);
        return currentResponse;
    }

    let response = await makeRequest(token, 1);

    if (response.status === 401) {
        console.log(`[AuthUtils:fetchWithAuth] Status 401 diterima untuk URL: ${url}. Mencoba periksa pesan error...`);
        // Clone response untuk membaca body error tanpa mengkonsumsinya, karena mungkin akan di-return
        const errorResponseForParsing = response.clone();
        const errorData = await errorResponseForParsing.json().catch(() => ({ message: 'Gagal parse error JSON dari 401' }));
        console.log(`[AuthUtils:fetchWithAuth] Pesan error dari 401:`, errorData.message);

        if (errorData.message && (errorData.message.includes('TokenExpiredError') || errorData.message.includes('kedaluwarsa'))) {
            console.log(`[AuthUtils:fetchWithAuth] Access token kedaluwarsa terdeteksi untuk URL: ${url}.`);
            if (!isRefreshingToken) {
                isRefreshingToken = true;
                console.log(`[AuthUtils:fetchWithAuth] Memulai proses refresh token...`);
                try {
                    const newAccessToken = await getNewAccessToken();
                    isRefreshingToken = false;
                    console.log(`[AuthUtils:fetchWithAuth] Refresh token berhasil. Token baru: ${newAccessToken ? newAccessToken.substring(0, 20) + '...' : 'NULL'}`);
                    processTokenRefreshQueue(null, newAccessToken);
                    console.log(`[AuthUtils:fetchWithAuth] Mengulang permintaan asli ke URL: ${url} dengan token baru.`);
                    response = await makeRequest(newAccessToken, 2); // Percobaan ke-2
                } catch (refreshError) {
                    isRefreshingToken = false;
                    console.error(`[AuthUtils:fetchWithAuth] Gagal refresh token:`, refreshError);
                    processTokenRefreshQueue(refreshError, null);
                    // performLogoutClientSide sudah dipanggil di getNewAccessToken jika gagal total
                    return Promise.reject(refreshError); // Penting untuk menghentikan eksekusi lebih lanjut
                }
            } else {
                console.log(`[AuthUtils:fetchWithAuth] Proses refresh token sudah berjalan, permintaan ke ${url} dimasukkan ke antrian.`);
                return new Promise((resolve, reject) => { // Pastikan promise di-return
                    tokenRefreshQueue.push({
                        resolve: async (newAccessTokenAfterWait) => {
                            console.log(`[AuthUtils:fetchWithAuth] Memproses antrian untuk URL: ${url} dengan token baru dari refresh: ${newAccessTokenAfterWait ? newAccessTokenAfterWait.substring(0, 20) + '...' : 'NULL'}`);
                            response = await makeRequest(newAccessTokenAfterWait, 2); // Percobaan ke-2 dari antrian
                            resolve(response); // Resolve dengan respons baru
                        },
                        reject
                    });
                });
            }
        } else {
            console.warn(`[AuthUtils:fetchWithAuth] Status 401 diterima, TAPI BUKAN karena token kedaluwarsa. Pesan: ${errorData.message}. Tidak melakukan refresh.`);
            // Jika 401 bukan karena token expired, kembalikan response 401 asli agar pemanggil bisa menanganinya
        }
    }
    console.log(`[AuthUtils:fetchWithAuth] Respons akhir untuk URL ${url}: Status ${response.status}`);
    return response; // Pastikan 'response' yang dikembalikan adalah yang terbaru
}

function performLogoutClientSide(message = 'Anda telah logout.', redirectPage = 'login.html') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    if (message) {
        console.log(`[AuthUtils] Logout: ${message}`);
        alert(message);
    }
    window.location.href = redirectPage;
}