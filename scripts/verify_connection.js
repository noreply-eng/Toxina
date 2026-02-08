import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Read .env.local manually
const envPath = path.resolve(__dirname, '../.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')

const env = {}
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) {
    env[key.trim()] = value.trim()
  }
})

const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

console.log('URL:', url)
console.log('Key (first 10 chars):', key?.substring(0, 10))

if (!url || !key) {
    console.error('Error: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
    process.exit(1)
}

const supabase = createClient(url, key)

async function check() {
  console.log('Testing connection to Supabase...')
  const { data, error } = await supabase.from('patients').select('id').limit(1)
  
  if (error) {
    console.error('Connection FAILED:', error.message)
    console.error('Details:', error)
  } else {
    console.log('Connection SUCCESS! Database is reachable.')
    console.log('Data:', data)
  }
}

check()
