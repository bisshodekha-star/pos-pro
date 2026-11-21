# POS Pro — Clothing Showroom POS

বাংলাদেশের কাপড়ের শোরুমের জন্য সম্পূর্ণ POS (Point of Sale) বিলিং সফটওয়্যার।
**Cloudflare Pages** + **Neon PostgreSQL** দিয়ে তৈরি।

## ✨ ফিচার

- ⚡ **কুইকবিল** — বারকোড স্ক্যান (ক্যামেরা), ছাড় (% ও ৳), VAT, ফেরত হিসাব
- 📤 **Excel Bulk Upload** — Excel (.xlsx) ফাইল আপলোড করে একসাথে অনেক পণ্য যোগ
- 🧾 **সেলস হিস্ট্রি** — সব বিলের তালিকা, তারিখ/কাস্টমার ফিল্টার, রিপ্রিন্ট
- 📒 **খাতা** — বাকি ম্যানেজমেন্ট, WhatsApp/SMS/Call রিমাইন্ডার
- 📦 **পণ্য** — যোগ/এডিট/মুছা, বারকোড লেবেল প্রিন্ট (৫০×২৫ মিমি)
- 📊 **স্টক** — কম স্টক সতর্কতা (প্রতিটি পণ্যের নিজস্ব সীমা অনুযায়ী)
- 👥 **কাস্টমার** — লিস্ট, যোগ, বাকি ট্র্যাকিং
- 🚚 **সাপ্লায়ার** — সাপ্লায়ার ও দেনা হিসাব
- 💸 **খরচ** — খরচ এন্ট্রি, ক্যাটাগরি, মাল্টি-অ্যাকাউন্ট ক্যাশবুক
- ⏰ **শিফট** — ক্যাশিয়ার শিফট, ওপেনিং/ক্লোজিং ক্যাশ, দিনশেষে ক্যাশ মিলান
- ⏸️ **হোল্ড বিল** — বিল হোল্ড করে পরে সম্পন্ন
- 📈 **রিপোর্ট** — মাসিক/কাস্টম তারিখ, লাভ-ক্ষতি (P&L)
- ↩️ **রিটার্ন** — পণ্য ফেরত, বিল বাতিল
- 🔐 **পাসওয়ার্ড গেট** — পণ্য ও রিসেট মডিউলে আলাদা পাসওয়ার্ড (হ্যাশ করে সংরক্ষিত)
- 🖨️ **রিসিট প্রিন্ট** — ৮০/৫৮ মিমি থার্মাল
- 🌐 **অন/অফলাইন ইন্ডিকেটর**
- 🏠 **রিফ্রেশে সবসময় হোম** — পেজ রিফ্রেশ বা নতুন ঢোকার সময় সবসময় হোম পেজে আসবে

> **নোট:** বর্তমানে এটি একটি সিঙ্গেল-পাসওয়ার্ড লগইন সিস্টেম (শুধু APP_PASSWORD env var দিয়ে লগইন)। `users` টেবিল schema-তে আছে ভবিষ্যতের মাল্টি-ইউজার সাপোর্টের জন্য, কিন্তু বর্তমানে ব্যবহৃত হয় না।

## 🏗️ স্ট্রাকচার

```
pos-pro/
├── public/                      # ফ্রন্টএন্ড (Cloudflare Pages static)
│   ├── index.html
│   ├── styles.css
│   └── src/
│       ├── app.js
│       ├── router.js            # রিফ্রেশে সবসময় হোমে যায়
│       ├── api.js
│       ├── config.js
│       ├── store.js
│       ├── components/          # layout, gate, quickbill, receipt, ...
│       ├── pages/               # home, billing, products, suppliers, returns, ...
│       └── utils/               # format (বাংলা সংখ্যা), auth, accounts
├── functions/                   # Cloudflare Pages Functions (API)
│   ├── _shared/
│   │   ├── db.js                # Neon connection
│   │   ├── auth.js              # JWT + PBKDF2 (fallback secret নেই)
│   │   ├── accounts.js          # cashbook helpers
│   │   └── response.js          # JSON/CORS (Origin reflect)
│   └── api/
│       ├── _middleware.js       # CORS + error catch
│       ├── auth/                # login (rate-limited), logout, me, setup
│       ├── settings/            # GET (filtered) + PUT + verify-gate
│       ├── products/            # CRUD + bulk
│       ├── sales/               # create (sequence), view, hold, cancel
│       ├── customers/           # CRUD
│       ├── dues/                # list + collect
│       ├── expenses/
│       ├── suppliers/
│       ├── returns/
│       ├── reports/             # dashboard, sales, profit
│       ├── users/               # admin only
│       ├── shifts/              # NULL-safe SQL
│       ├── cashbook/            # 5 accounts + transfer
│       ├── reconcile/           # day-end cash match
│       └── reset/               # admin-only, সব টেবিল মুছে ফেলে
├── schema.sql                   # Neon ডাটাবেস স্কিমা (invoice_seq সহ)
├── migration-phase1.sql         # পুরোনো ইনস্টল আপগ্রেডের জন্য
├── wrangler.toml                # Cloudflare config
├── package.json
├── push-to-github.sh            # Termux এর জন্য পুশ স্ক্রিপ্ট
└── README.md
```

---

## 🚀 সেটআপ (৩০ মিনিট)

### ধাপ ১: Neon ডাটাবেস তৈরি

১. **Neon** (https://neon.tech) এ লগইন করুন (GitHub/Google দিয়ে ফ্রি)
২. **New Project** → Project name: `pos-pro` → Branch: `main` → Create
৩. Project তৈরি হলে **Connection string** কপি করুন:
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```
৪. বাঁ পাশে **SQL Editor** এ যান → `schema.sql` ফাইলের পুরো কনটেন্ট পেস্ট করুন → **Run**
৫. (পুরোনো ইনস্টল থাকলে) `migration-phase1.sql` চালান আপগ্রেডের জন্য
৬. টেবিল, সেটিংস ও `invoice_seq` তৈরি হয়ে গেছে ✓

### ধাপ ২: GitHub এ পুশ (Termux দিয়ে)

```bash
# Termux এ এই ফোল্ডারে যান
cd pos-pro

# এক কমান্ডে গিটহাবে পুশ করুন
bash push-to-github.sh
```

স্ক্রিপ্ট আপনাকে রিপোজিটরির নাম জিজ্ঞেস করবে। নাম দিন (যেমন: `pos-pro`)।

### ধাপ ৩: Cloudflare Pages এ ডিপ্লয়

১. **Cloudflare Dashboard** (https://dash.cloudflare.com) এ যান
২. **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
৩. আপনার GitHub অ্যাকাউন্ট কানেক্ট করুন → `pos-pro` রিপো সিলেক্ট করুন
৪. সেটআপ:
   - **Project name**: `pos-pro`
   - **Production branch**: `main`
   - **Framework preset**: `None`
   - **Build command**: `npm install` ← অবশ্যই এটা দিন!
   - **Build output directory**: `public`
   - **Root directory**: (খালি)
৫. **Environment variables** (Settings → Environment variables):
   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | আপনার Neon connection string |
   | `JWT_SECRET` | যেকোনো দীর্ঘ র্যান্ডম স্ট্রিং (`openssl rand -hex 32`) |
   | `JWT_ISSUER` | `pos-pro` |
   | `APP_PASSWORD` | লগইন পাসওয়ার্ড (যেমন: `rahman2024`) |

   > **গুরুত্বপূর্ণ:** Production ও Preview দুটো environment এর জন্যই ভেরিয়েবল সেট করুন।
   > **JWT_SECRET না দিলে লগইন API কাজ করবে না** (fallback secret ব্যবহার হয় না)।

৬. (ঐচ্ছিক কিন্তু সুপারিশকৃত) **Rate limiting KV namespace**:
   - Cloudflare Dashboard → Workers & Pages → KV → Create namespace → নাম `RATE_LIMIT`
   - আপনার Pages প্রজেক্ট → Settings → Functions → KV namespace bindings
   - Variable name: `RATE_LIMIT` → তৈরি করা namespace সিলেক্ট করুন
   - এটা না থাকলে লগইন rate limiting soft-mode এ চলবে (একই IP থেকে ১০ বার ভুল পাসওয়ার্ডের পর ব্লক)

৭. **Save and Deploy** ক্লিক করুন।
৮. ২-৩ মিনিটে ডিপ্লয় হবে। URL পাবেন: `https://pos-pro.pages.dev`

### ধাপ ৪: প্রথমবার লগইন

১. আপনার Cloudflare URL খুলুন (`https://pos-pro.pages.dev`)
২. লগইন স্ক্রিনে **APP_PASSWORD** এ সেট করা পাসওয়ার্ড দিন
   (ডিফল্টভ্যালু `.env.example` এ: `rahman2024`)
৩. লগইন হলে সাথে সাথে সেটিংস ড্রয়ার (ডানদিকের ☰ বাটন) খুলে দোকানের তথ্য ভরুন
৪. পণ্য ও রিসেট মডিউলে ঢুকতে আলাদা পাসওয়ার্ড সেট করুন (প্রথমবার ঢুকার সময় সেট করতে বলবে)
   — এই পাসওয়ার্ডগুলো PBKDF2 দিয়ে হ্যাশ করে ডাটাবেসে সংরক্ষিত হয়, ক্লায়েন্ট কখনো দেখতে পায় না।
৫. লগআউট করতে চাইলে সেটিংস ড্রয়ারের একদম নিচে লাল **🚪 লগআউট** বাটনে ক্লিক করুন।

🎉 **ব্যস!** আপনার POS সফটওয়্যার লাইভ।

---

## 📱 ক্লায়েন্টকে দেখানোর জন্য

১. পণ্য বিভাগে গিয়ে নিজের পণ্য ও বারকোড যোগ করুন
২. কুইকবিল খুলুন (⚡ বোতাম)
৩. যোগ করা পণ্যের বারকোড স্ক্যান/লিখুন
৪. পেমেন্ট দিন → বিল সম্পন্ন করুন
৫. রিসিট প্রিন্ট করুন

---

## 🔧 লোকাল ডেভেলপমেন্ট

```bash
# ডিপেন্ডেন্সি ইনস্টল
npm install

# .dev.vars ফাইল তৈরি (env.example থেকে কপি করে পূরণ করুন)
cp .env.example .dev.vars
# DATABASE_URL, JWT_SECRET, APP_PASSWORD ভরুন

# লোকাল সার্ভার চালু
npm run dev
# http://localhost:8788
```

---

## 🔐 সিকিউরিটি

- পাসওয়ার্ড PBKDF2 (SHA-256, ১০০০০০ iterations) দিয়ে হ্যাশ করা হয়
- JWT HS256 দিয়ে সাইন করা, httpOnly cookie তে সংরক্ষিত
- `JWT_SECRET` সেট করা না থাকলে সার্ভার ফেইল করে (fallback সিক্রেট নেই)
- লগইনে rate limiting (KV থাকলে প্রতি IP ১০ বার/১৫ মিনিট)
- `products_password` ও `reset_password` প্লেইন টেক্সটে সংরক্ষিত হয় না — হ্যাশ করে রাখা হয়, GET /settings এ ফেরত দেওয়া হয় না
- গেট পাসওয়ার্ড ভেরিফিকেশন সার্ভার-সাইডে হয় (POST /api/settings/verify-gate)
- `/api/reset` শুধু admin রোল ব্যবহার করতে পারে
- CORS সঠিকভাবে কনফিগার্ড (Origin reflect + Vary: Origin)

**প্রোডাকশনে যাওয়ার আগে:**
- `JWT_SECRET` অবশ্যই একটা শক্তিশালী র্যান্ডম স্ট্রিং দিন
- APP_PASSWORD একটা শক্তিশালী পাসওয়ার্ড দিন

---

## 🆘 সমস্যা ও সমাধান

**"DATABASE_URL is not set"**
→ Cloudflare Pages → Settings → Environment variables এ `DATABASE_URL` যোগ করুন।

**"JWT_SECRET environment variable সেট করা নেই"**
→ Cloudflare Pages → Settings → Environment variables এ `JWT_SECRET` যোগ করুন (`openssl rand -hex 32` দিয়ে তৈরি করুন)।

**"অনুগ্রহ করে লগইন করুন" এরর**
→ Cookie ব্লক হচ্ছে। HTTPS নিশ্চিত করুন (Cloudflare Pages অটো HTTPS দেয়)।

**"বারকোড লাইব্রেরি লোড হয়নি"**
→ ইন্টারনেট কানেকশন চেক করুন (JsBarcode CDN থেকে লোড হয়)।

**ক্যামেরা স্ক্যান কাজ করছে না**
→ ব্রাউজার HTTPS এ থাকতে হবে + ক্যামেরা পারমিশন দিতে হবে। Chrome/Edge দিয়ে চেষ্টা করুন।

**"অনেকবার ভুল পাসওয়ার্ড। ১৫ মিনিট পরে চেষ্টা করুন।"**
→ Rate limit হিট করেছে। ১৫ মিনিট অপেক্ষা করুন অথবা Cloudflare KV namespace `RATE_LIMIT` এর ভেতর থেকে `login_fail:<ip>` কী মুছে ফেলুন।

---

## 📞 সাপোর্ট

কোনো সমস্যা হলে GitHub issue খুলুন বা ডেভেলপারকে কনট্যাক্ট করুন।

**লাইসেন্স:** প্রাইভেট — ক্লায়েন্টের জন্য তৈরি।
