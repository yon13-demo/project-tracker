'use client';
import { useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, Shield, ScrollText, Globe2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PrivacyPolicy() {
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
          <span className="legal-icon legal-icon-green"><Shield size={28} /></span>
          <h1>{en ? 'Privacy Policy' : 'Kebijakan Privasi'}</h1>
          <p className="legal-meta">{en ? 'Last updated' : 'Terakhir diperbarui'}: {lastUpdated}</p>
        </div>

        {en ? <PrivacyEnglish /> : <div className="legal-body">
          <p>
            {en ? <>This policy explains how <strong>WEAVE.app</strong> collects, uses, and protects information you provide while using our service. Your privacy matters to us.</> : <>Kebijakan ini menjelaskan bagaimana <strong>WEAVE.app</strong> mengumpulkan, menggunakan, dan melindungi informasi yang Anda berikan saat menggunakan Layanan kami. Privasi Anda penting bagi kami.</>}
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
        </div>}
      </div>

      <footer className="site-footer" style={{ marginTop: 40 }}>
        <div className="footer-copyright">© 2026 WEAVE.app</div>
        <div className="footer-legal"><a href="/tos"><ScrollText size={11} /> {en ? 'Terms of Service' : 'Syarat & Ketentuan'}</a><span className="footer-dot">•</span><a href="/privacy"><Shield size={11} /> {en ? 'Privacy Policy' : 'Kebijakan Privasi'}</a></div>
      </footer>
    </main>
  );
}

function PrivacyEnglish() {
  return (
    <div className="legal-body">
      <p>This policy explains how <strong>WEAVE.app</strong> collects, uses, and protects information you provide while using our service.</p>
      <section className="legal-section"><h2>1. Information We Collect</h2><p>We collect account information such as your name and email, work activity such as daily work logs and projects, and administrative records such as role changes and system settings.</p><p>We do not collect location data, device data, or behavioral tracking information outside the application.</p></section>
      <section className="legal-section"><h2>2. How We Use Information</h2><p>Information is used to operate work-hour tracking and project management, provide role-based access, generate reports, improve security, and send necessary technical notices.</p><p>We do not sell, rent, or commercially share your personal data with third parties.</p></section>
      <section className="legal-section"><h2>3. Storage and Security</h2><p>Your data is stored on Supabase infrastructure with encryption in transit and at rest. Passwords are never stored as plain text.</p><p>Role-based access controls limit access to authorized users and organization administrators.</p></section>
      <section className="legal-section"><h2>4. Data Sharing</h2><p>Data may be shared with your organization administrators, technical providers such as Supabase, or authorities when legally required.</p></section>
      <section className="legal-section"><h2>5. Data Retention</h2><p>Account and work-log data is retained while your account is active. Data associated with an account deleted by an administrator is removed within 30 days unless law requires otherwise.</p></section>
      <section className="legal-section"><h2>6. Your Rights</h2><p>You may request access to, correction of, or deletion of your personal data, and may object to certain processing. Contact your organization administrator or our team.</p></section>
      <section className="legal-section"><h2>7. Cookies and Local Storage</h2><p>WEAVE.app uses browser storage to maintain authentication state during an active session. We do not use third-party tracking or advertising cookies.</p></section>
      <section className="legal-section"><h2>8. Policy Changes</h2><p>We may update this policy from time to time. Material changes will be communicated through the service or by email.</p></section>
      <section className="legal-section"><h2>9. Contact</h2><p>Privacy questions or requests can be sent to:</p><div className="legal-contact"><a href="mailto:support@leonxlab.digital">support@leonxlab.digital</a><span className="legal-contact-sep">·</span><a href="mailto:mailto@leonxlab.app">mailto@leonxlab.app</a></div></section>
    </div>
  );
}
