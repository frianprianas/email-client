# Panduan Deployment di CentOS 7 (Alibaba Cloud)

Panduan ini akan membantu Anda menginstall Docker dan menjalankan aplikasi Mail Client di VPS CentOS 7 dengan spesifikasi minimal (1GB RAM + 2GB Swap).

## Persiapan Awal
Pastikan Anda sudah login ke VPS sebagai `root` atau pengguna dengan akses `sudo`.

```bash
# Update sistem
sudo yum update -y
```

## 1. Install Docker & Docker Compose
Docker versi terbaru tidak tersedia langsung di repositori default CentOS 7. Kita perlu menambahkan repo Docker CE.

```bash
# Install paket yang dibutuhkan
sudo yum install -y yum-utils device-mapper-persistent-data lvm2

# Tambahkan repositori Docker
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Install Docker Engine dan Plugin Compose
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Jalankan Docker dan aktifkan agar otomatis jalan saat booting
sudo systemctl start docker
sudo systemctl enable docker

# Cek apakah Docker berjalan
sudo systemctl status docker
```

## 2. Clone Repository
Ambil kode aplikasi dari GitLab/GitHub.

```bash
# Install git jika belum ada
sudo yum install -y git

# Clone repository (ganti URL sesuai repo Anda)
git clone https://gitlab.com/frianprianas-group/mail-baknus.git

# Masuk ke folder project
cd mail-baknus
```

## 3. Konfigurasi Environment
Salin file template environment dan sesuaikan isinya.

```bash
# Salin file .env.docker menjadi .env
cp .env.docker .env

# Edit file .env menggunakan nano atau vi
nano .env
```
*Isi `.env` dengan password database yang aman dan kredensial email yang benar.*

## 4. Jalankan Aplikasi
Karena RAM terbatas (1GB), kita akan menggunakan Docker Compose untuk build dan run. Build frontend mungkin memakan memori, tapi Swap 2GB Anda akan membantu.

```bash
# Build dan jalankan container di background
docker compose up -d --build
```
*Catatan: Jika perintah `docker compose` tidak ditemukan, coba gunakan `docker-compose` (dengan tanda strip).*

## 5. Cek Status Aplikasi
```bash
# Cek apakah semua container berjalan (status Up)
docker compose ps

# Jika ada masalah, cek log
docker compose logs -f
```

## Tips Hemat RAM
Jika proses build gagal karena *Out of Memory*:
1.  **Build di Laptop**: Jalankan `docker build` di laptop Anda, push ke Docker Hub, lalu pull di VPS.
2.  **Tambah Swap**: Pastikan Swap Anda aktif dengan perintah `free -h`.

## Update Aplikasi
Jika ada perubahan kode baru di repository:
```bash
# Tarik perubahan terbaru
git pull

# Restart container dengan build ulang
docker compose up -d --build
```
