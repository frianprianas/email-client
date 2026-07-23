# Panduan Workflow Workstation & Deployment

Repositori untuk **email-client** telah berhasil di-clone ke komputer ini (`c:\Users\Administrator\Documents\App\baknusmail`) dan dikonfigurasi sebagai **Workstation (Development)**. Anda dapat melakukan pengodingan di sini tanpa perlu menjalankan aplikasi secara lokal, kemudian deploy hasilnya ke server melalui perantara Git.

---

## 1. Alur Kerja di Workstation (Komputer Lokal)

Setiap kali Anda selesai melakukan perubahan kode (koding) di workstation ini, jalankan perintah berikut untuk mengirimkan perubahan ke GitHub:

```bash
# 1. Cek file mana saja yang berubah
git status

# 2. Tambahkan perubahan ke staging area
git add .

# 3. Lakukan commit dengan pesan penjelasan
git commit -m "Deskripsi singkat tentang perubahan kode Anda"

# 4. Push perubahan ke branch main di GitHub
git push origin main
```

---

## 2. Alur Kerja di Server (Produksi / VPS)

Setelah kode berhasil di-push ke GitHub, masuklah ke server Anda (melalui SSH) dan jalankan langkah-langkah berikut untuk melihat hasilnya:

```bash
# 1. Masuk ke direktori project di server Anda
cd /path/to/mail-baknus   # Ganti dengan path folder project di server Anda

# 2. Tarik kode terbaru dari GitHub
git pull origin main

# 3. Bangun kembali container Docker dengan kode terbaru
docker compose up -d --build
```

### Memantau Status Aplikasi di Server:
```bash
# Cek apakah semua container berjalan normal (Status: Up)
docker compose ps

# Melihat log aplikasi jika terjadi error saat build/run
docker compose logs -f
```

---

## Tips Tambahan:

* **Swap Memory:** Sesuai panduan `DEPLOY_CENTOS7.md`, jika RAM server Anda terbatas (misal 1GB) dan proses build frontend gagal karena kehabisan memori (*Out of Memory*), pastikan server Anda memiliki Swap minimal 2GB aktif (`free -h`).
* **Environment Variables:** File konfigurasi `.env` pada server berisi konfigurasi sensitif (seperti password DB dan kredensial mail server) dan diabaikan oleh Git secara default demi keamanan. Jika Anda menambahkan variabel baru di `.env.docker` lokal, pastikan untuk menyesuaikan file `.env` di server secara manual.

---

## 3. Cara Mendeploy ke Server (VPS) Baru

Jika Anda ingin memindahkan atau men-deploy aplikasi ini di server baru, ikuti langkah-langkah di bawah ini:

### Langkah A: Install Docker & Docker Compose
Aplikasi ini dikemas menggunakan Docker Compose. Jalankan perintah ini di server baru Anda:

**Untuk Ubuntu / Debian:**
```bash
# Update package list
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Tambahkan GPG Key resmi Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Tambahkan Repository Docker
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine & Compose plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Aktifkan Docker agar berjalan otomatis saat booting
sudo systemctl enable docker --now
```

**Untuk CentOS 7:**
*(Ikuti langkah instalasi lengkap di file [DEPLOY_CENTOS7.md](file:///c:/Users/Administrator/Documents/App/baknusmail/DEPLOY_CENTOS7.md))*

---

### Langkah B: Tambahkan Swap Memory (Jika RAM Server < 2GB)
Sangat direkomendasikan jika RAM server Anda hanya 1GB agar proses build frontend tidak macet (*Out of Memory*):
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

### Langkah C: Clone Repository & Setup Environment
1. Pastikan Anda berada di direktori yang memiliki hak akses tulis (seperti direktori Home user Anda):
   ```bash
   # Masuk ke direktori home (sangat direkomendasikan)
   cd ~
   ```
2. Clone repositori ke server baru Anda:
   ```bash
   sudo apt install -y git # (Gunakan yum untuk CentOS)
   git clone https://github.com/frianprianas/email-client.git
   cd email-client
   ```
   *Catatan: Jika Anda mendapatkan error `Permission denied` saat cloning, hal itu terjadi karena user aktif Anda tidak memiliki izin menulis di direktori tersebut. Menjalankan `cd ~` sebelum clone akan memindahkan Anda ke folder Home Anda yang dijamin memiliki izin menulis.*
2. Buat file `.env` untuk konfigurasi:
   ```bash
   cp .env.docker .env
   nano .env
   ```
   *Ubah konfigurasi DB_PASSWORD, JWT_SECRET, dan detail MAIL_HOST sesuai server baru Anda.*

---

### Langkah D: Jalankan Container
Jalankan aplikasi di server baru dengan Docker Compose. 

Jika Anda mendapatkan error `permission denied while trying to connect to the docker API`, Anda bisa mengatasinya dengan dua cara:

* **Cara Cepat:** Tambahkan `sudo` di awal perintah:
  ```bash
  sudo docker compose up -d --build
  ```

* **Cara Permanen (Direkomendasikan):** Masukkan user Anda ke grup `docker` agar bisa menjalankan Docker tanpa `sudo`:
  ```bash
  sudo usermod -aG docker $USER
  newgrp docker  # Terapkan perubahan grup tanpa perlu logout
  docker compose up -d --build
  ```

Setelah berhasil dijalankan, aplikasi akan aktif:
- **Frontend:** `http://IP_SERVER_BARU:8080`
- **Backend:** `http://IP_SERVER_BARU:5000`
- **Database:** Port `5432`

*(Catatan: Peringatan WARN tentang MAILCOW_API_URL/KEY dan tipe versi docker-compose yang usang/obsolete aman untuk diabaikan).*

---

## 4. Konfigurasi Nginx Reverse Proxy (Membuat Aplikasi Online)

Karena kontainer **frontend** dari `baknusmail` sudah memiliki Nginx internal yang menangani file statik sekaligus meneruskan request `/api` ke backend secara otomatis, Anda **hanya perlu mengarahkan domain Anda ke port 8080 (port frontend host)**.

Berikut adalah contoh konfigurasi Nginx untuk ditaruh di server (misalkan menggunakan domain `baknusmail.smkbn666.sch.id`):

### Contoh File Konfigurasi Nginx (`/etc/nginx/sites-available/baknusmail`):

```nginx
# --- BLOK HTTPS (Port 443) ---
server {
    listen 443 ssl;
    server_name baknusmail.smkbn666.sch.id;

    # Batas ukuran payload request (agar file upload/attachment besar tidak error 413)
    client_max_body_size 50M;

    # Konfigurasi Sertifikat SSL Let's Encrypt
    ssl_certificate /etc/letsencrypt/live/baknusmail.smkbn666.sch.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/baknusmail.smkbn666.sch.id/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        # Meneruskan traffic ke port frontend Docker BaknusMail (port 8080)
        proxy_pass http://127.0.0.1:8080; 
        
        # Pengaturan timeout 5 menit agar koneksi IMAP/sync stabil dan tidak terputus
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;

        # Header standar Proxy
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# --- BLOK HTTP (Port 80) - Auto Redirect ke HTTPS ---
server {
    listen 80;
    server_name baknusmail.smkbn666.sch.id;
    return 301 https://$host$request_uri;
}
```

### Langkah Mengaktifkan di Server:
1. Simpan konfigurasi di atas ke file baru di server Anda:
   ```bash
   sudo nano /etc/nginx/sites-available/baknusmail
   ```
2. Buat symlink ke folder `sites-enabled`:
   ```bash
   sudo ln -s /etc/nginx/sites-available/baknusmail /etc/nginx/sites-enabled/
   ```
3. Lakukan pengujian sintaks Nginx dan reload layanan:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

---

## 5. Cara Pasang SSL Gratis (Let's Encrypt dengan Certbot)

Untuk mendapatkan sertifikat SSL gratis yang diperbarui secara otomatis, gunakan **Certbot** dari Let's Encrypt.

### Langkah 1: Install Certbot & Plugin Nginx
**Untuk Ubuntu / Debian:**
```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```
**Untuk CentOS 7:**
```bash
sudo yum install -y epel-release
sudo yum install -y certbot python3-certbot-nginx
```

### Langkah 2: Buat Konfigurasi Nginx Sementara (Port 80)
Sebelum meminta SSL, pastikan domain Anda sudah terarah ke IP server baru (A Record DNS aktif). Buat file Nginx sementara untuk melayani verifikasi Certbot:
```nginx
server {
    listen 80;
    server_name baknusmail.smkbn666.sch.id;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
Jalankan `sudo nginx -t && sudo systemctl reload nginx`.

### Langkah 3: Jalankan Certbot
Jalankan perintah ini di server:
```bash
sudo certbot --nginx -d baknusmail.smkbn666.sch.id
```
**Interaksi:**
- Masukkan email Anda saat diminta (untuk notifikasi kedaluwarsa).
- Setujui Terms of Service (`A`).
- Pilih opsi `2: Redirect` jika ditanya apakah ingin mengalihkan HTTP ke HTTPS secara otomatis.

*Certbot akan otomatis memodifikasi file konfigurasi Nginx Anda dan memasang path SSL-nya secara otomatis.*

### Langkah 4: Tes Auto-Renewal SSL
SSL Let's Encrypt gratis berlaku selama 90 hari. Certbot secara otomatis membuat scheduler di server untuk memperbaruinya sebelum kedaluwarsa. Anda dapat menguji proses pembaruan otomatis ini dengan:
```bash
sudo certbot renew --dry-run
```
