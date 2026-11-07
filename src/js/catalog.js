// URLs and brand colors are kept together so adding a website is a one-line change.
export const CATALOG = [
  { icon: 'whatsapp', label: 'WhatsApp', url: 'https://web.whatsapp.com/', color: '#25d366' },
  { icon: 'telegram', label: 'Telegram', url: 'https://web.telegram.org/', color: '#26a5e4' },
  { icon: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/', color: '#0866ff' },
  { icon: 'openai', label: 'ChatGPT', url: 'https://chatgpt.com/', color: '#10a37f' },
  { icon: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/', color: '#ff0033' },
  { icon: 'gmail', label: 'Gmail', url: 'https://mail.google.com/', color: '#ea4335' },
  { icon: 'google', label: 'Google', url: 'https://www.google.com/', color: '#4285f4' },
  { icon: 'googledrive', label: 'Google Drive', url: 'https://drive.google.com/', color: '#34a853' },
  { icon: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/', color: '#ff5b91' },
  { icon: 'x', label: 'X (Twitter)', url: 'https://x.com/', color: '#f1f1f1' },
  { icon: 'github', label: 'GitHub', url: 'https://github.com/', color: '#e6edf3' },
  { icon: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/', color: '#0a86d9' },
  { icon: 'reddit', label: 'Reddit', url: 'https://www.reddit.com/', color: '#ff4500' },
  { icon: 'discord', label: 'Discord', url: 'https://discord.com/app', color: '#5865f2' },
  { icon: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/', color: '#f5f5f5' },
  { icon: 'spotify', label: 'Spotify', url: 'https://open.spotify.com/', color: '#1ed760' },
  { icon: 'netflix', label: 'Netflix', url: 'https://www.netflix.com/', color: '#e50914' },
  { icon: 'notion', label: 'Notion', url: 'https://www.notion.so/', color: '#f1f1f1' },
  { icon: 'claude', label: 'Claude', url: 'https://claude.ai/new', color: '#d97757' },
  { icon: 'googlegemini', label: 'Gemini', url: 'https://gemini.google.com/', color: '#8ab4f8' },
];

const website = (name) => ({ ...CATALOG.find((item) => item.label === name) });

// Keep the original nine destinations, including the temporary ChatGPT URL.
export const DEFAULT_CARDS = [
  website('Discord'), website('WhatsApp'), website('YouTube'),
  { ...website('ChatGPT'), url: 'https://chatgpt.com/?temporary-chat=true' },
  website('GitHub'),
  { icon: 'fas fa-store', label: 'Khamsat', url: 'https://khamsat.com', color: '#f5a623' },
  website('Claude'),
  { icon: 'fas fa-crop-simple', label: 'Image Resizer', url: 'https://imageresizer.com/', color: '#00b4d8' },
  website('Gemini'),
];
