// login.js
document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('loginButton');
    const messageArea = document.getElementById('messageArea');

    loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        const email = emailInput.value;
        const password = passwordInput.value;

        loginButton.disabled = true;
        loginButton.textContent = 'Memproses...';
        messageArea.style.display = 'none';
        messageArea.textContent = '';
        messageArea.className = 'message';

        try {
            // Ganti URL ini jika domain Anda berbeda atau jika Anda masih menggunakan IP secara langsung
            // Jika Anda sudah memiliki HTTPS untuk akademik.online, gunakan https://
            const apiUrl = 'https://akademik.online/api/login'; // Lebih baik jika sudah HTTPS
            // const apiUrl = 'http://37.44.244.93/api/login'; // Alternatif jika via IP dan HTTP

            console.log(`Mencoba login ke: ${apiUrl}`);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            let data;
            try {
                data = await response.json();
            } catch (jsonError) {
                console.error('Gagal parse JSON dari respons:', jsonError);
                console.error('Status Respons:', response.status, response.statusText);
                const responseText = await response.text(); // Coba baca sebagai teks
                console.error('Teks Respons:', responseText);

                messageArea.textContent = `Error: Respons dari server tidak valid (Status: ${response.status}). Cek console.`;
                if (response.status === 0) { // Seringkali ini indikasi CORS atau network error
                    messageArea.textContent = 'Gagal terhubung ke server. Periksa koneksi atau konfigurasi CORS.';
                }
                messageArea.classList.add('error');
                messageArea.style.display = 'block';
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
                return;
            }

            if (response.ok) {
                messageArea.textContent = data.message || 'Login berhasil!';
                messageArea.classList.add('success');
                messageArea.style.display = 'block';

                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
                localStorage.setItem('user', JSON.stringify(data.user));

                console.log('Login berhasil:', data);

                setTimeout(() => {
                    window.location.href = 'dashboard.html'; // Anda perlu buat halaman ini nanti
                }, 1500);

            } else {
                messageArea.textContent = data.error || data.message || `Terjadi kesalahan (Status: ${response.status}).`;
                messageArea.classList.add('error');
                messageArea.style.display = 'block';
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
            }
        } catch (error) {
            console.error('Login request failed:', error);
            // Ini biasanya error jaringan atau CORS yang memblokir permintaan sebelum sampai ke server
            messageArea.textContent = 'Tidak dapat terhubung ke server atau permintaan diblokir. Cek koneksi dan konfigurasi CORS di server. Lihat console browser untuk detail.';
            messageArea.classList.add('error');
            messageArea.style.display = 'block';
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
        }
    });
});