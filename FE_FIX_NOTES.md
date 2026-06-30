# FE Simple LMS - Fix Notes

## Update terbaru v5 (Chatbot Assistant)

Halaman Student Dashboard (`/dashboard`) sekarang dilengkapi dengan fitur **AI Chatbot Assistant Popup** terintegrasi dengan Google Gemini API.

Perubahan utama:

- Penambahan komponen `ChatbotPopup.jsx` di pojok kanan bawah dashboard siswa;
- Chatbot terhubung ke backend `POST /api/v1/chatbot`;
- UI/UX Chatbot yang interaktif dengan:
  - Balasan pesan instan dari AI yang bersahabat dalam Bahasa Indonesia;
  - Rekomendasi kursus otomatis dari database jika ditanyakan;
  - Tampilan balon percakapan yang modern dengan scroll otomatis ke pesan terbaru;
  - Integrasi status loading dan penanganan error.

## Update terbaru v4

Halaman `Learning Progress` (`/progress/:enrollmentId`) sekarang sudah diperbaiki supaya section dan lesson tidak hanya menjadi list statis.

Perubahan utama:

- setiap section di halaman progress bisa expand/collapse;
- setiap lesson bisa dibuka menjadi detail materi langsung di halaman progress;
- detail lesson mengambil data dari backend `GET /courses/{course_id}/contents/{content_id}`;
- video YouTube dari field `video_url` tampil sebagai embedded player;
- file attachment bisa di-download dari detail lesson;
- tombol `Tandai Selesai` tetap tersedia di tiap lesson;
- lesson yang sudah selesai tetap diberi status visual `Selesai`;
- section `Tanpa Section` tetap diperlakukan sebagai section virtual yang bisa dibuka/tutup.


## Update terbaru v3

Course detail sekarang sudah menampilkan video dari field `video_url` backend sebagai player di FE.

Format YouTube yang didukung:

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`
- `https://www.youtube.com/live/VIDEO_ID`
- URL YouTube tanpa protokol seperti `youtube.com/watch?v=VIDEO_ID`
- ID YouTube langsung sepanjang 11 karakter
- parameter waktu seperti `?t=1m30s` atau `?start=90`

Perubahan UI/UX video:

- lesson dengan `video_url` menampilkan panel **Video Materi** di Lesson Detail;
- YouTube otomatis diubah menjadi embed URL `youtube-nocookie.com/embed/...`;
- tersedia link **Buka di YouTube/tab baru** sebagai fallback;
- URL video direct seperti `.mp4`, `.webm`, dan `.ogg` memakai player HTML5;
- URL lain tetap ditampilkan sebagai link eksternal, bukan hilang begitu saja;
- form tambah/edit lesson sekarang memberi placeholder `YouTube URL / Video URL`.

## Update v2

Course detail sudah tidak hanya menampilkan daftar lesson. Halaman `/courses/:id` sekarang memiliki panel **Lesson Detail**:

- klik lesson di curriculum untuk membuka detail materi;
- menampilkan deskripsi lesson, durasi, urutan, video, dan file attachment jika tersedia;
- student yang sudah enroll bisa menandai lesson sebagai selesai dari halaman detail;
- progress lesson ditampilkan di curriculum dan ringkasan learning path;
- lesson tanpa section tetap ditampilkan di grup `Tanpa Section`;
- instructor/admin tetap bisa tambah/edit/hapus section dan lesson, upload/ganti file, serta mengubah status course;
- guest hanya bisa melihat informasi publik dan diarahkan login/enroll untuk progress/download yang membutuhkan auth.

## Catatan backend

Backend memiliki endpoint detail lesson:

- `GET /courses/{course_id}/contents/{content_id}`

Data detail yang tersedia dari model backend saat ini:

- `name`
- `description`
- `video_url`
- `file_attachment`
- `section_id`
- `order`
- `duration_minutes`

Jadi FE sekarang menampilkan detail dari field-field tersebut. Jika dibutuhkan konten materi yang lebih kaya seperti artikel panjang, quiz, markdown body, preview file, atau akses lesson yang hanya terbuka setelah enroll, backend perlu ditambah field/endpoint khusus.
