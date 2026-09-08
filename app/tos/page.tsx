'use client';
import { useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, ScrollText, Shield, Globe2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TermsOfService() {
  const router = useRouter();
  const [lang, setLang] = useState<'id' | 'en'>('id');
  const en = lang === 'en';
  const lastUpdated = '1 September 2026';

  return (
    <main className="shell" style={{ maxWidth: 760 }}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Image src="/logo/weaver-icon.svg" alt="WEAVE.app" width={42} height={42} style={{ objectFit: 'contain' }} />
          </span>
          <span className="brand-lockup"><span className="brand-name">WEAVE<span className="brand-app">.app</span></span><span className="brand-tagline">work, woven together.</span></span>
        </div>
        <div className="top-actions">
          <button className="lang-btn" onClick={() => setLang(en ? 'id' : 'en')}><Globe2 size={14} /> {en ? 'ID' : 'EN'}</button>
          <button className="btn-secondary" onClick={() => router.back()}><ArrowLeft size={14} /> {en ? 'Back' : 'Kembali'}</button>
        </div>
      </header>

      <div className="legal-page">
        <div className="legal-hero">
          <span className="legal-icon"><ScrollText size={28} /></span>
          <h1>{en ? 'Terms of Service' : 'Syarat & Ketentuan Penggunaan'}</h1>
          <p className="legal-meta">{en ? 'Last updated' : 'Terakhir diperbarui'}: {lastUpdated}</p>
        </div>

        {en ? <TermsEnglish /> : <div className="legal-body">
          <p>
            {en ? <>By accessing or using <strong>WEAVE.app</strong> (the “Service”), you agree to these terms and conditions. Please read them carefully before using the Service.</> : <>Dengan mengakses atau menggunakan aplikasi <strong>WEAVE.app</strong> ("Layanan"), Anda menyetujui syarat dan ketentuan berikut. Harap baca dengan seksama sebelum menggunakan Layanan.</>}
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
        </div>}
      </div>

      <footer className="site-footer" style={{ marginTop: 40 }}>
        <div className="footer-copyright">© 2026 WEAVE.app</div>
        <div className="footer-legal"><a href="/tos"><ScrollText size={11} /> {en ? 'Terms of Service' : 'Syarat & Ketentuan'}</a><span className="footer-dot">•</span><a href="/privacy"><Shield size={11} /> {en ? 'Privacy Policy' : 'Kebijakan Privasi'}</a></div>
      </footer>
    </main>
  );
}

function TermsEnglish() {
  return (
    <div className="legal-body">
      <p>By accessing or using <strong>WEAVE.app</strong> (the “Service”), you agree to these terms and conditions.</p>
      <section className="legal-section"><h2>1. Use of the Service</h2><p>WEAVE.app provides work-hour tracking and project management for users authorized by an organization administrator. Use the Service lawfully, keep your credentials private, submit accurate work data, and do not access other users’ data without authorization.</p></section>
      <section className="legal-section"><h2>2. Accounts and Responsibilities</h2><p>You are responsible for the security and confidentiality of your account. Report suspected unauthorized access to your organization administrator promptly.</p></section>
      <section className="legal-section"><h2>3. Data and Content</h2><p>Data entered into the Service remains owned by your organization. Organization administrators may access, export, or delete data for operational purposes.</p></section>
      <section className="legal-section"><h2>4. Restrictions</h2><p>You may not reverse engineer, modify, misuse, unlawfully use, disrupt, or attempt to compromise the availability or security of the Service.</p></section>
      <section className="legal-section"><h2>5. Service Availability</h2><p>We work to provide a reliable service but do not guarantee uninterrupted availability. Maintenance, updates, or technical issues may affect access.</p></section>
      <section className="legal-section"><h2>6. Termination</h2><p>Organization administrators may suspend or delete your account if these terms are violated or when required for organizational operations.</p></section>
      <section className="legal-section"><h2>7. Limitation of Liability</h2><p>To the extent permitted by law, WEAVE.app is not liable for indirect, incidental, or consequential losses arising from use of or inability to use the Service.</p></section>
      <section className="legal-section"><h2>8. Changes to These Terms</h2><p>We may update these terms from time to time. Continued use after changes means that you accept the updated terms.</p></section>
      <section className="legal-section"><h2>9. Governing Law</h2><p>These terms are governed by the laws of the Republic of Indonesia. Disputes will first be addressed through good-faith discussion and, when necessary, the competent courts in Indonesia.</p></section>
      <section className="legal-section"><h2>10. Contact</h2><p>Questions about these Terms can be sent to:</p><div className="legal-contact"><a href="mailto:support@leonxlab.digital">support@leonxlab.digital</a><span className="legal-contact-sep">·</span><a href="mailto:mailto@leonxlab.app">mailto@leonxlab.app</a></div></section>
    </div>
  );
}
