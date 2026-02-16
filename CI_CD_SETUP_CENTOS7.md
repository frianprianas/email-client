# Panduan Setup CI/CD GitLab di CentOS 7 (Alibaba Cloud)

Ikuti langkah-langkah ini agar GitLab bisa otomatis deploy ke VPS Anda setiap kali ada update.

## 1. Buat SSH Key Khusus CI/CD (Di Laptop Anda)
Buka terminal (PowerShell atau CMD) di laptop Anda dan jalankan perintah ini untuk membuat kunci baru:

**Cara Paling Aman (Interaktif):**
Jalankan perintah ini:
```powershell
ssh-keygen -t rsa -b 4096 -f gitlab_ci_key
```
1. Saat muncul `Enter passphrase`: **TEKAN ENTER** (kosongkan).
2. Saat muncul `Enter same passphrase again`: **TEKAN ENTER LAGI**.

**Atau Cara Satu Baris (PowerShell):**
Jika ingin langsung tanpa tanya (gunakan tanda kutip tunggal pembungkus):
```powershell
ssh-keygen -t rsa -b 4096 -f gitlab_ci_key -N '""'
```

Ini akan menghasilkan dua file di folder Anda saat ini:
- `gitlab_ci_key` (Private Key - **RAHASIA**)
- `gitlab_ci_key.pub` (Public Key - **UNTUK VPS**)

## 2. Pasang Public Key di VPS
1. Buka file `gitlab_ci_key.pub` dengan Notepad, copy semua isinya.
2. Login ke VPS Anda menggunakan SSH (Putty atau Terminal).
3. Jalankan perintah berikut untuk membuka file `authorized_keys`:

```bash
# Pastikan folder .ssh ada
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Edit/Buat file authorized_keys
nano ~/.ssh/authorized_keys
```

4. **Paste** isi public key tadi di baris paling bawah.
5. Simpan (Ctrl+O, Enter) dan Keluar (Ctrl+X).
6. Atur izin file agar aman:

```bash
chmod 600 ~/.ssh/authorized_keys
```

## 3. Konfigurasi Variable di GitLab
1. Buka Repository GitLab Anda.
2. Masuk ke **Settings** > **CI/CD**.
3. Expand bagian **Variables**.
4. Klik **Add variable** dan masukkan data berikut:

| Key | Value |
|:---|:---|
| `SSH_PRIVATE_KEY` | Copy isi file `gitlab_ci_key` (Private Key) dari laptop Anda. Pastikan copy SELURUHNYA termasuk `-----BEGIN...` dan `-----END...`. |
| `SSH_HOST` | IP Public VPS Alibaba Cloud Anda. |
| `SSH_USER` | `root` (atau user lain yang Anda gunakan). |
| `PROJECT_PATH` | `/root/mail-baknus` (Sesuaikan dengan folder project di VPS). |

## 4. Persiapan di VPS (Sekali Saja)
Masuk ke VPS dan pastikan Git sudah terinstall serta lakukan clone pertama kali.

```bash
# 1. Install Git
sudo yum install git -y

# 2. Masuk ke folder tujuan (misal /root)
cd /root

# 3. Clone repository (Masukan username & password/token GitLab jika diminta)
git clone https://gitlab.com/frianprianas-group/mail-baknus.git

# 4. Masuk ke folder project
cd mail-baknus

# 5. Salin konfigurasi env
cp .env.docker .env
# Edit .env sesuaikan dengan password production
nano .env 
```

## 5. Test Deploy
Lakukan perubahan kecil pada kode di laptop (misal di README.md), lalu commit dan push.

```bash
git add .
git commit -m "Test CI/CD Pipeline"
git push origin main
```

Buka menu **Build** > **Jobs** di GitLab untuk melihat proses deploy berjalan otomatis.

## 6. Troubleshooting: "User not verified"
Jika Pipeline gagal dengan pesan **"User not verified"**, itu karena GitLab mewajibkan verifikasi Kartu Kredit untuk akun gratis guna mencegah penyalahgunaan (mining crypto).

**Solusi 1 (Mudah):** Klik tombol **"Verify my account"** di GitLab dan masukkan data kartu kredit/debit (tidak akan ditarik biaya).

**Solusi 2 (Tanpa Kartu Kredit):** Install **GitLab Runner** sendiri di VPS Anda. Ini akan menggunakan VPS Anda untuk menjalankan deploy, bukan server GitLab gratisan.

### Cara Install GitLab Runner di CentOS 7:

1. **Ambil Token Runner di GitLab:**
   - Buka **Settings** > **CI/CD** > **Runners**.
   - Klik **New project runner**.
   - Tags: kosongi, Checbox: "Run untagged jobs" (pENTING!).
   - Create runner.
   - **COPY TOKEN** yang muncul (misal: `glrt-xxxxxxxx`).

2. **Install di VPS:**
   Masuk ke SSH VPS dan jalankan:

   ```bash
   # 1. Tambahkan Repo
   curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.rpm.sh" | sudo bash

   # 2. Install Runner
   sudo yum install gitlab-runner -y

   # 3. Register Runner (Ganti TOKEN_DARI_GITLAB dengan token anda)
   sudo gitlab-runner register \
     --non-interactive \
     --url "https://gitlab.com/" \
     --token "TOKEN_DARI_GITLAB" \
     --executor "shell" \
     --description "VPS-Runner"
   ```

3. **Selesai!**
   - Refresh halaman GitLab Runners, pastikan ada runner baru (bulatan hijau).
   - Coba jalankan Pipeline lagi (Build > Pipelines > Run pipeline).

