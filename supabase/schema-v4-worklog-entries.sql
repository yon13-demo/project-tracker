-- Migrasi v4: kategori (Project / Quotation / Training), deskripsi, dan proyek manual pada pencatatan kerja.
-- Jalankan sekali di Supabase SQL Editor untuk project yang sudah memakai schema v2/v3.
-- Aman dijalankan ulang; data lama tidak berubah (semua entri lama menjadi kategori 'project').

alter table public.work_logs add column if not exists custom_project_name text;
alter table public.work_logs add column if not exists custom_project_code text;
alter table public.work_logs add column if not exists category text not null default 'project';
alter table public.work_logs add column if not exists description text;

alter table public.work_logs drop constraint if exists valid_category;
alter table public.work_logs add constraint valid_category check (category in ('project', 'quotation', 'training'));

-- Project: proyek terdaftar ATAU nama proyek manual. Quotation/Training: tanpa proyek.
alter table public.work_logs drop constraint if exists valid_entry;
alter table public.work_logs add constraint valid_entry check (
  (is_leave = true and project_id is null and custom_project_name is null) or
  (is_leave = false and hours is not null and (
    (category = 'project' and (project_id is not null or nullif(trim(custom_project_name), '') is not null)) or
    (category in ('quotation', 'training') and project_id is null and custom_project_name is null)
  ))
);

-- Muat ulang cache schema PostgREST agar kolom baru langsung terbaca.
notify pgrst, 'reload schema';
