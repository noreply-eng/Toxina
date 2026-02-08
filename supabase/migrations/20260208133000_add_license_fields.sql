alter table user_profiles
add column if not exists general_license text,
add column if not exists specialist_license text;
