const cron = require('node-cron');
const axios = require('axios');
const { sendAttendReminderToAll } = require('./firebaseService');

/**
 * Memeriksa apakah tanggal yang diberikan adalah weekend (Sabtu/Minggu) atau Libur Nasional.
 * @param {Date} dateObj 
 * @returns {Promise<{isHoliday: boolean, reason?: string}>}
 */
async function checkIsHoliday(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

  // 1. Cek Akhir Pekan (Sabtu = 6, Minggu = 0)
  const dayOfWeek = dateObj.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { isHoliday: true, reason: 'Akhir Pekan (Sabtu/Minggu)' };
  }

  // 2. Cek API Libur Nasional
  try {
    const url = `https://dayoffapi.vercel.app/api?year=${year}&month=${month}`;
    const response = await axios.get(url, { timeout: 5000 });

    if (Array.isArray(response.data)) {
      const holiday = response.data.find(item => item.holiday_date === dayStr && item.is_national_holiday);
      if (holiday) {
        return { isHoliday: true, reason: `Libur Nasional (${holiday.holiday_name})` };
      }
    }
  } catch (err) {
    console.warn('[attendanceCron] Gagal mengecek API Libur Nasional (melanjutkan secara normal):', err.message);
  }

  return { isHoliday: false };
}

/**
 * Memulai Cron Job Pengingat Presensi Otomatis
 */
function startAttendanceCron() {
  console.log('[attendanceCron] Memulai Cron Job Pengingat Presensi Otomatis (Asia/Jakarta)...');

  // 1. Cron Presensi Masuk (Jam 07:45 WIB, Senin-Jumat: '45 7 * * 1-5')
  cron.schedule('45 7 * * 1-5', async () => {
    console.log('[attendanceCron] Menjalankan pengecekan Cron Presensi Masuk (07:45 WIB)...');
    const holidayInfo = await checkIsHoliday(new Date());

    if (holidayInfo.isHoliday) {
      console.log(`[attendanceCron] Pengingat Masuk DILEWATI: ${holidayInfo.reason}`);
      return;
    }

    try {
      await sendAttendReminderToAll(
        '⏰ Pengingat Presensi Masuk',
        'Jangan lupa untuk melakukan presensi masuk pagi ini!',
        'masuk'
      );
      console.log('[attendanceCron] Pengingat Presensi Masuk berhasil dikirim.');
    } catch (err) {
      console.error('[attendanceCron] Error saat mengirim pengingat masuk:', err.message);
    }
  }, {
    timezone: 'Asia/Jakarta'
  });

  // 2. Cron Presensi Pulang (Jam 15:00 WIB, Senin-Jumat: '0 15 * * 1-5')
  cron.schedule('0 15 * * 1-5', async () => {
    console.log('[attendanceCron] Menjalankan pengecekan Cron Presensi Pulang (15:00 WIB)...');
    const holidayInfo = await checkIsHoliday(new Date());

    if (holidayInfo.isHoliday) {
      console.log(`[attendanceCron] Pengingat Pulang DILEWATI: ${holidayInfo.reason}`);
      return;
    }

    try {
      await sendAttendReminderToAll(
        '🔔 Pengingat Presensi Pulang',
        'Sudah jam pulang, silakan lakukan presensi pulang!',
        'pulang'
      );
      console.log('[attendanceCron] Pengingat Presensi Pulang berhasil dikirim.');
    } catch (err) {
      console.error('[attendanceCron] Error saat mengirim pengingat pulang:', err.message);
    }
  }, {
    timezone: 'Asia/Jakarta'
  });
}

module.exports = {
  startAttendanceCron,
  checkIsHoliday
};
