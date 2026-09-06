'use client';
import Image from 'next/image';
import { ArrowLeft, ScrollText } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TermsOfService() {
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
          <span className="legal-icon"><ScrollText size={28} /></span>
          <h1>Syarat &amp; Ketentuan Penggunaan</h1>
          <p className="legal-meta">Terakhir diperbarui: {lastUpdated}</p>
        </div>

        <div className="legal-body">
          <p>
            Dengan mengakses atau menggunakan aplikasi <strong>Weaver</strong> ("Layanan"), Anda menyetujui syarat dan ketentuan berikut.
            Harap baca dengan seksama sebelum menggunakan Layanan.
          </p>

          <section className="legal-section">
            <h2>1. Penggunaan Layanan</h2>
            <p>
              Weaver adalah aplikasi pencatatan jam kerja dan manajemen proyek yang diperuntukkan bagi pengguna yang telah mendapat
              akses dari administrator organisasi. Anda setuju untuk:
            </p>
            <ul>
              <li>Menggunakan Layanan hanya untuk keperluan yang sah dan sesuai dengan ketentuan ini.</li>
              <li>Tidak berbagi kredensial akun dengan pihak lain.</li>
              <li>Memasukkan data jam kerja dan proyek yang akurat dan jujur.</li>
              <li>Tidak mencoba mengakses data milik pengguna lain tanpa otorisasi.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>2. Akun &amp; Tanggung Jawab</h2>
            <p>
              Anda bertanggung jawab penuh atas keamanan dan kerahasiaan akun Anda, termasuk kata sandi. Segera laporkan kepada
              administrator jika Anda menduga terjadi akses tidak sah ke akun Anda. Weaver tidak bertanggung jawab atas kerugian
              yang timbul akibat kelalaian menjaga keamanan akun.
            </p>
          </section>

          <section className="legal-section">
            <h2>3. Data &amp; Konten</h2>
            <p>
              Semua data yang Anda masukkan ke dalam Layanan (termasuk log kerja dan data proyek) tetap menjadi milik organisasi
              Anda. Weaver tidak mengklaim kepemilikan atas data tersebut. Anda menyetujui bahwa administrator organisasi dapat
              mengakses, mengekspor, atau menghapus data Anda sesuai kebutuhan operasional.
            </p>
          </section>

          <section className="legal-section">
            <h2>4. Pembatasan Layanan</h2>
            <p>Anda dilarang untuk:</p>
            <ul>
              <li>Merekayasa balik, mendekompilasi, atau memodifikasi Layanan.</li>
              <li>Menggunakan Layanan untuk tujuan yang melanggar hukum yang berlaku.</li>
              <li>Menyalahgunakan sistem dengan memasukkan data palsu atau menyesatkan.</li>
              <li>Mencoba mengganggu ketersediaan atau keamanan Layanan.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>5. Ketersediaan Layanan</h2>
            <p>
              Kami berupaya memberikan Layanan yang andal namun tidak menjamin ketersediaan 100% setiap saat. Pemeliharaan,
              pembaruan, atau gangguan teknis dapat memengaruhi akses. Kami akan berusaha memberi tahu terlebih dahulu bila ada
              pemeliharaan terjadwal.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. Penghentian Akses</h2>
            <p>
              Administrator organisasi dapat menangguhkan atau menghapus akun Anda kapan saja, dengan atau tanpa pemberitahuan
              sebelumnya, jika Anda melanggar ketentuan ini atau atas kebijaksanaan organisasi. Setelah penghentian, akses Anda
              ke Layanan akan dihentikan.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Batasan Tanggung Jawab</h2>
            <p>
              Sejauh diizinkan oleh hukum yang berlaku, Weaver tidak bertanggung jawab atas kerugian tidak langsung, insidental,
              atau konsekuensial yang timbul dari penggunaan atau ketidakmampuan menggunakan Layanan.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. Perubahan Ketentuan</h2>
            <p>
              Kami dapat memperbarui syarat ini sewaktu-waktu. Perubahan signifikan akan diberitahukan melalui Layanan atau email.
              Penggunaan Layanan yang berkelanjutan setelah perubahan berarti Anda menerima ketentuan yang telah diperbarui.
            </p>
          </section>

          <section className="legal-section">
            <h2>9. Hukum yang Berlaku</h2>
            <p>
              Ketentuan ini tunduk pada hukum Republik Indonesia. Sengketa yang timbul akan diselesaikan melalui jalur musyawarah,
              atau jika diperlukan, melalui pengadilan yang berwenang di Indonesia.
            </p>
          </section>

          <section className="legal-section">
            <h2>10. Kontak</h2>
            <p>
              Pertanyaan mengenai Syarat &amp; Ketentuan ini dapat disampaikan kepada tim kami di:
            </p>
            <div className="legal-contact">
              <a href="mailto:support@leonxlab.digital">support@leonxlab.digital</a>
              <span className="legal-contact-sep">·</span>
              <a href="mailto:mailto@leonxlab.app">mailto@leonxlab.app</a>
            </div>
          </section>
        </div>
      </div>

      <footer className="site-footer" style={{ marginTop: 40 }}>
        <div className="footer-copyright">© 2026 Weaver</div>
      </footer>
    </main>
  );
}
