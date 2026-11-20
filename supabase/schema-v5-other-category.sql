-- Migrasi v5: kategori "Lainnya" (category = 'other') pada pencatatan kerja.
-- Jalankan sekali di Supabase SQL Editor project Weave SEBELUM deploy kode yang menampilkan pilihan Lainnya.
-- Aman dijalankan ulang; data lama tidak berubah.

alter table public.work_logs drop constraint if exists valid_category;
alter table public.work_logs add constraint valid_category check (category in ('project', 'quotation', 'training', 'other'));

-- Project: proyek terdaftar ATAU nama proyek manual. Quotation/Training: tanpa proyek.
-- Lainnya: tanpa proyek, dan deskripsi wajib diisi (itulah isi pekerjaannya).
alter table public.work_logs drop constraint if exists valid_entry;
alter table public.work_logs add constraint valid_entry check (
  (is_leave = true and project_id is null and custom_project_name is null) or
  (is_leave = false and hours is not null and (
    (category = 'project' and (project_id is not null or nullif(trim(custom_project_name), '') is not null)) or
    (category in ('quotation', 'training') and project_id is null and custom_project_name is null) or
    (category = 'other' and project_id is null and custom_project_name is null and nullif(trim(description), '') is not null)
  ))
);

notify pgrst, 'reload schema';
