'use client';
import Image from 'next/image';
import { ArrowLeft, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PrivacyPolicy() {
  const router = useRouter();
  const lastUpdated = '1 September 2026';

  return (
    <main className="shell" style={{ maxWidth: 760 }}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Image src="/logo/weaver.svg" alt="Weaver" width={48} height={48} style={{ objectFit: 'contain' }} />
          </span>
          Weaver
        </div>
        <button className="btn-secondary" onClick={() => router.back()}>
          <ArrowLeft size={14} /> Kembali
        </button>
      </header>

      <div className="legal-page">
        <div className="legal-hero">
          <span className="legal-icon legal-icon-green"><Shield size={28} /></span>
          <h1>Kebijakan Privasi</h1>
          <p className="legal-meta">Terakhir diperbarui: {lastUpdated}</p>
        </div>

        <div className="legal-body">
          <p>
            Kebijakan ini menjelaskan bagaimana <strong>Weaver</strong> mengumpulkan, menggunakan, dan melindungi informasi
            yang Anda berikan saat menggunakan Layanan kami. Privasi Anda penting bagi kami.
          </p>

          <section className="legal-section">
            <h2>1. Informasi yang Kami Kumpulkan</h2>
            <p>Kami mengumpulkan informasi yang Anda berikan secara langsung, termasuk:</p>
            <ul>
              <li><strong>Data akun:</strong> nama lengkap, alamat email, dan kata sandi (terenkripsi).</li>
              <li><strong>Data aktivitas kerja:</strong> log jam kerja harian, proyek yang dikerjakan, dan status cuti.</li>
              <li><strong>Data administratif:</strong> log tindakan admin, perubahan role, dan pengaturan sistem.</li>
            </ul>
            <p>
              Kami <strong>tidak</strong> mengumpulkan data lokasi, data perangkat, atau informasi pelacakan perilaku di luar
              aktivitas dalam aplikasi.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Cara Kami Menggunakan Informasi</h2>
            <p>Informasi yang dikumpulkan digunakan untuk:</p>
            <ul>
              <li>Mengoperasikan dan menyediakan fitur Layanan (pencatatan jam kerja, manajemen proyek).</li>
              <li>Memberikan akses yang sesuai berdasarkan peran pengguna (admin/user).</li>
              <li>Menghasilkan laporan dan ekspor data untuk kebutuhan organisasi.</li>
              <li>Meningkatkan keamanan dan mendeteksi aktivitas mencurigakan.</li>
              <li>Mengirimkan notifikasi teknis yang berkaitan dengan akun Anda (jika diperlukan).</li>
            </ul>
            <p>Kami <strong>tidak</strong> menjual, menyewakan, atau membagikan data pribadi Anda kepada pihak ketiga untuk tujuan komersial.</p>
          </section>

          <section className="legal-section">
            <h2>3. Penyimpanan &amp; Keamanan Data</h2>
            <p>
              Data Anda disimpan di infrastruktur <strong>Supabase</strong> yang menggunakan enkripsi data saat transit (TLS)
              dan saat tersimpan (at-rest encryption). Kata sandi tidak pernah disimpan dalam bentuk teks biasa — selalu dalam
              bentuk hash menggunakan algoritma yang aman.
            </p>
            <p>
              Kami menerapkan kontrol akses berbasis peran (RBAC) sehingga hanya pengguna yang berwenang yang dapat mengakses
              data tertentu. Administrator organisasi memiliki akses lebih luas sesuai kebutuhan operasional.
            </p>
          </section>

          <section className="legal-section">
            <h2>4. Berbagi Data</h2>
            <p>Data Anda hanya dibagikan dalam situasi berikut:</p>
            <ul>
              <li><strong>Dalam organisasi:</strong> data log kerja dapat dilihat oleh administrator organisasi Anda.</li>
              <li><strong>Penyedia layanan teknis:</strong> Supabase sebagai penyedia infrastruktur database dan autentikasi, yang tunduk pada kebijakan privasi mereka sendiri.</li>
              <li><strong>Kewajiban hukum:</strong> jika diwajibkan oleh hukum atau perintah pengadilan yang sah.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>5. Retensi Data</h2>
            <p>
              Data akun dan log kerja Anda disimpan selama akun Anda aktif. Setelah akun dihapus oleh administrator, data
              terkait akan dihapus dari sistem dalam waktu 30 hari, kecuali ada kewajiban hukum untuk menyimpannya lebih lama.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. Hak-Hak Anda</h2>
            <p>Sesuai peraturan perlindungan data yang berlaku, Anda memiliki hak untuk:</p>
            <ul>
              <li><strong>Mengakses</strong> data pribadi yang kami simpan tentang Anda.</li>
              <li><strong>Mengoreksi</strong> data yang tidak akurat melalui administrator.</li>
              <li><strong>Meminta penghapusan</strong> data Anda (subject to legal obligations).</li>
              <li><strong>Menolak pemrosesan</strong> data untuk tujuan tertentu.</li>
            </ul>
            <p>Untuk menggunakan hak-hak tersebut, hubungi administrator organisasi Anda atau tim kami melalui kontak di bawah.</p>
          </section>

          <section className="legal-section">
            <h2>7. Cookie &amp; Penyimpanan Lokal</h2>
            <p>
              Weaver menggunakan penyimpanan sesi browser (session storage) hanya untuk menjaga status autentikasi Anda selama
              sesi aktif. Kami tidak menggunakan cookie pelacak pihak ketiga atau iklan.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. Perubahan Kebijakan</h2>
            <p>
              Kami dapat memperbarui kebijakan ini dari waktu ke waktu. Perubahan material akan diinformasikan melalui Layanan
              atau melalui email ke administrator. Tanggal "Terakhir diperbarui" di bagian atas halaman ini selalu mencerminkan
              versi terbaru.
            </p>
          </section>

          <section className="legal-section">
            <h2>9. Kontak</h2>
            <p>Pertanyaan atau permintaan terkait privasi dapat dikirimkan kepada kami di:</p>
            <div className="legal-contact">
              <a href="mailto:support@leonxlab.digital">support@leonxlab.digital</a>
              <span className="legal-contact-sep">·</span>
              <a href="mailto:mailto@leonxlab.app">mailto@leonxlab.app</a>
            </div>
          </section>
        </div>
      </div>

      <footer className="site-footer" style={{ marginTop: 40 }}>
        <div className="footer-copyright">© 2026 Weaver — Leonx Lab</div>
      </footer>
    </main>
  );
}
