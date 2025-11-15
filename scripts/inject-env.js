const fs = require('fs');
const path = require('path');

// Files to process
const files = [
  'index.html',
  'redemption.html'
];

// Get ENV variables
const env = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
  VITE_SUPABASE_KEY: process.env.VITE_SUPABASE_KEY || '',
  WEBENGAGE_LICENSE_CODE: process.env.WEBENGAGE_LICENSE_CODE || '',
  WEBENGAGE_API_KEY: process.env.WEBENGAGE_API_KEY || ''
};

console.log('Injecting environment variables...');

files.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace placeholders
  Object.keys(env).forEach(key => {
    const placeholder = `\${${key}}`;
    const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    content = content.replace(regex, env[key]);
  });
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Processed: ${file}`);
});

console.log('✨ Environment injection complete!');
