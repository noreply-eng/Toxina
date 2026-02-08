-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Patients Table
create table if not exists patients (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  full_name text not null,
  birth_date date,
  email text,
  phone text,
  weight numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Treatments Table
create table if not exists treatments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  patient_id uuid references patients(id) on delete cascade not null,
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  product_name text not null,
  total_units numeric not null,
  dilution numeric,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Treatment Details (Muscles injected)
create table if not exists treatment_details (
  id uuid default uuid_generate_v4() primary key,
  treatment_id uuid references treatments(id) on delete cascade not null,
  muscle_name text not null,
  side text not null, -- 'Left', 'Right', 'Both' (if needed, or row per side)
  units numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table patients enable row level security;
alter table treatments enable row level security;
alter table treatment_details enable row level security;

-- Policies for Patients
create policy "Users can view their own patients" on patients
  for select using (auth.uid() = user_id);

create policy "Users can insert their own patients" on patients
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own patients" on patients
  for update using (auth.uid() = user_id);

create policy "Users can delete their own patients" on patients
  for delete using (auth.uid() = user_id);

-- Policies for Treatments
create policy "Users can view their own treatments" on treatments
  for select using (auth.uid() = user_id);

create policy "Users can insert their own treatments" on treatments
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own treatments" on treatments
  for update using (auth.uid() = user_id);

create policy "Users can delete their own treatments" on treatments
  for delete using (auth.uid() = user_id);

-- Policies for Treatment Details
-- Check if the treatment belongs to the user
create policy "Users can view their own treatment details" on treatment_details
  for select using (
    exists ( select 1 from treatments where id = treatment_details.treatment_id and user_id = auth.uid() )
  );

create policy "Users can insert their own treatment details" on treatment_details
  for insert with check (
    exists ( select 1 from treatments where id = treatment_details.treatment_id and user_id = auth.uid() )
  );
  
create policy "Users can update their own treatment details" on treatment_details
  for update using (
    exists ( select 1 from treatments where id = treatment_details.treatment_id and user_id = auth.uid() )
  );
  
create policy "Users can delete their own treatment details" on treatment_details
  for delete using (
    exists ( select 1 from treatments where id = treatment_details.treatment_id and user_id = auth.uid() )
  );
