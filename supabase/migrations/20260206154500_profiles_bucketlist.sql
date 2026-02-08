-- Create User Profiles Table
-- This generic profile table extends the auth.users table
create table if not exists user_profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  specialty text,
  avatar_url text,
  subscription_tier text default 'Free', -- 'Free', 'Pro', 'Enterprise'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Profiles
alter table user_profiles enable row level security;

-- Policies for User Profiles
create policy "Users can view their own profile" on user_profiles
  for select using (auth.uid() = id);

create policy "Users can insert their own profile" on user_profiles
  for insert with check (auth.uid() = id);

create policy "Users can update their own profile" on user_profiles
  for update using (auth.uid() = id);

-- Create Bucket List Table
-- Stores goals/wishes for the doctor
create table if not exists bucket_list (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  description text,
  status text default 'pending', -- 'pending', 'done'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Bucket List
alter table bucket_list enable row level security;

-- Policies for Bucket List
create policy "Users can view their own bucket list" on bucket_list
  for select using (auth.uid() = user_id);

create policy "Users can insert their own bucket list" on bucket_list
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own bucket list" on bucket_list
  for update using (auth.uid() = user_id);

create policy "Users can delete their own bucket list" on bucket_list
  for delete using (auth.uid() = user_id);

-- Create a trigger to automatically create a profile entry when a new user signs up
-- (Optional but recommended for smoother UX)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, full_name, specialty, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'specialty', '');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger logic is complex to managing via migrations if it already exists, 
-- usually we check if it exists or drop/create. 
-- For now we will rely on client-side creation if the profile doesn't exist, 
-- or manual insertion for existing users.
