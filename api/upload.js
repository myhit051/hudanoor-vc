import { Storage } from '@google-cloud/storage';
import { authenticate } from '../lib/auth-middleware.js';

function getStorage() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) {
    throw new Error('Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY');
  }
  return new Storage({ credentials: { client_email: clientEmail, private_key: privateKey } });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = authenticate(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { base64, filename, mimeType, sku } = req.body;
    if (!base64 || !filename) return res.status(400).json({ error: 'Missing base64 or filename' });

    const bucketName = process.env.GCS_BUCKET_NAME;
    if (!bucketName) return res.status(500).json({ error: 'GCS_BUCKET_NAME not configured' });

    const buffer = Buffer.from(base64, 'base64');
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const safeSku = (sku || 'product').replace(/[^a-zA-Z0-9-]/g, '-');
    const gcsFilename = `products/${safeSku}-${Date.now()}.${ext}`;

    const storage = getStorage();
    const file = storage.bucket(bucketName).file(gcsFilename);
    await file.save(buffer, {
      metadata: { contentType: mimeType || 'image/jpeg' },
      public: true,
    });

    const url = `https://storage.googleapis.com/${bucketName}/${gcsFilename}`;
    return res.status(200).json({ url });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message });
  }
}
