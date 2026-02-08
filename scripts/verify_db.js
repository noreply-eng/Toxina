import { createClient } from '@supabase/supabase-js'

const url = 'https://qwhrdmllpznvqrxygytp.supabase.co'
const key = 'sb_publishable_2_uTHHOdfER13DA8Qvk7EA_CwXYqJl8'
const supabase = createClient(url, key)

async function check() {
  console.log('Testing connection to Supabase...')
  const { data, error } = await supabase.from('patients').select('id').limit(1)
  
  if (error) {
    if (error.code === '42P01') {
        console.log('Result: CONNECTED, BUT TABLE MISSING. (Relation "patients" does not exist)')
        console.log('Action: Please run the db_schema.sql script in Supabase.')
    } else {
        console.error('Result: ERROR', error)
    }
  } else {
    console.log('Result: SUCCESS. Connected and "patients" table exists.')
    console.log('Data sample:', data)
  }
}

check()
