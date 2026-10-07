# Finans Koçu Full-Stack

Node/Express sürümü. `public/` mevcut web arayüzünü içerir.

## Render
- Service: Web Service
- Build Command: `npm install`
- Start Command: `npm start`
- `OPENAI_API_KEY`: gizli API anahtarın
- `OPENAI_MODEL`: hesabında erişilebilir model adı

## Önemli
Bu ilk backend katmanı geliştirme/test içindir. Kullanıcı ve işlemler RAM'de tutulur; Render yeniden başlarsa silinir. Üretim ve ödeme öncesinde Supabase/Postgres + kalıcı auth/RLS katmanına geçirilmelidir.
