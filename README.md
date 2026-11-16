# POS Pro — Clothing Showroom POS

বাংলাদেশের কাপড়ের শোরুমের জন্য সম্পূর্ণ POS (Point of Sale) বিলিং সফটওয়্যার।
**Cloudflare Pages** + **Neon PostgreSQL** দিয়ে তৈরি।

## ✨ ফিচার

- ⚡ **কুইকবিল** — বারকোড স্ক্যান (ক্যামেরা), ছাড় (% ও ৳), VAT, ফেরত হিসাব
- 🧾 **সেলস হিস্ট্রি** — সব বিলের তালিকা, তারিখ/কাস্টমার ফিল্টার, রিপ্রিন্ট
- 📒 **খাতা** — বাকি ম্যানেজমেন্ট, WhatsApp/SMS/Call রিমাইন্ডার
- 📦 **পণ্য** — যোগ/এডিট/মুছা, বারকোড লেবেল প্রিন্ট (৫০×২৫ মিমি)
- 📊 **স্টক** — কম স্টক সতর্কতা, কালার-কোডেড বার
- 👥 **কাস্টমার** — লিস্ট, হিস্ট্রি, বাকি ট্র্যাকিং
- 🚚 **সাপ্লায়ার** — সাপ্লায়ার ও দেনা হিসাব
- 💸 **খরচ** — খরচ এন্ট্রি, ক্যাটাগরি
- ⏰ **শিফট** — ক্যাশিয়ার শিফট, ওপেনিং/ক্লোজিং ক্যাশ
- ⏸️ **হোল্ড বিল** — বিল হোল্ড করে পরে সম্পন্ন
- 📈 **রিপোর্ট** — দৈনিক/সাপ্তাহিক বিক্রি, লাভ-ক্ষতি
- ↩️ **রিটার্ন** — পণ্য ফেরত, বিল বাতিল
- 🔐 **মাল্টি-ইউজার** — Admin / Manager / Cashier রোল
- 🖨️ **রিসিট প্রিন্ট** — ৮০/৫৮ মিমি থার্মাল
- 🌐 **অন/অফলাইন ইন্ডিকেটর**
- 🎲 **ডেমো ডাটা** — এক ক্লিকে ডেমো লোড

## 🏗️ স্ট্রাকচার

```
pos-pro/
├── public/                      # ফ্রন্টএন্ড (Cloudflare Pages static)
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── functions/                   # Cloudflare Pages Functions (API)
│   ├── _shared/
│   │   ├── db.js                # Neon connection
│   │   ├── auth.js              # JWT + PBKDF2 password
│   │   └── response.js          # JSON/CORS helpers
│   └── api/
│       ├── _middleware.js       # CORS
│       ├── auth/                # login, logout, me, setup
│       ├── products/            # CRUD
│       ├── sales/               # create, view, hold, cancel
│       ├── customers/           # CRUD
│       ├── dues/                # list + collect
│       ├── expenses/
│       ├── suppliers/
│       ├── returns/
│       ├── reports/             # dashboard, sales, profit
│       ├── users/               # admin only
│       ├── shifts/
│       ├── settings/
│       └── seed/                # demo data
├── schema.sql                   # Neon ডাটাবেস স্কিমা
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
৫. টেবিল ও সেটিংস তৈরি হয়ে গেছে ✓

### ধাপ ২: GitHub এ পুশ (Termux দিয়ে)

```bash
# Termux এ এই ফোল্ডারে যান
cd pos-pro

# এক কমান্ডে গিটহাবে পুশ করুন
bash push-to-github.sh
```

স্ক্রিপ্ট আপনাকে রিপোজিটরির নাম জিজ্ঞেস করবে। নাম দিন (যেমন: `pos-pro`)।
প্রথমবার GitHub ইউজারনেম/পাসওয়ার্ড বা Personal Access Token লাগবে।

### ধাপ ৩: Cloudflare Pages এ ডিপ্লয়

১. **Cloudflare Dashboard** (https://dash.cloudflare.com) এ যান
২. **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
৩. আপনার GitHub অ্যাকাউন্ট কানেক্ট করুন → `pos-pro` রিপো সিলেক্ট করুন
৪. সেটআপ:
   - **Project name**: `pos-pro`
   - **Production branch**: `main`
   - **Framework preset**: `None`
   - **Build command**: (খালি রাখুন)
   - **Build output directory**: `public`
   - **Root directory**: (খালি)
৫. **Environment variables** (Settings → Environment variables):
   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | আপনার Neon connection string |
   | `JWT_SECRET` | যেকোনো দীর্ঘ র্যান্ডম স্ট্রিং (যেমন: `openssl rand -hex 32` দিয়ে তৈরি করুন) |
   | `JWT_ISSUER` | `pos-pro` |
   | `NODE_VERSION` | `18` |

   > **গুরুত্বপূর্ণ:** Production ও Preview দুটো environment এর জন্যই ভেরিয়েবল সেট করুন।

৬. **Save and Deploy** ক্লিক করুন।
৭. ২-৩ মিনিটে ডিপ্লয় হবে। URL পাবেন: `https://pos-pro.pages.dev`

### ধাপ ৪: প্রথমবার লগইন

১. আপনার Cloudflare URL খুলুন (`https://pos-pro.pages.dev`)
২. লগইন স্ক্রিনে **"🔐 প্রথমবার সেটআপ"** বাটনে ক্লিক করুন
   - এটা default admin ইউজার তৈরি করবে
৩. এখন লগইন করুন:
   - **ইউজারনেম**: `admin`
   - **পাসওয়ার্ড**: `admin123`
৪. লগইন হলে সাথে সাথে পাসওয়ার্ড বদলান (ফাইল → পাসওয়ার্ড বদলান)
৫. ডেমো ডাটা দেখতে হোম স্ক্রিনে **"🎲 ডেমো ডাটা লোড করুন"** বাটনে ক্লিক করুন

🎉 **ব্যস!** আপনার POS সফটওয়্যার লাইভ।

---

## 📱 ক্লায়েন্টকে দেখানোর জন্য

১. ডেমো ডাটা লোড করুন
২. কুইকবিল খুলুন (⚡ বোতাম)
৩. বারকোড `8901001` থেকে `8901012` পর্যন্ত যেকোনো একটা স্ক্যান/লিখুন
৪. পেমেনট দিন → বিল সম্পন্ন করুন
৫. রিসিট প্রিন্ট করুন

---

## 🔧 লোকাল ডেভেলপমেন্ট

```bash
# ডিপেন্ডেন্সি ইনস্টল
npm install

# .dev.vars ফাইল তৈরি (env.example থেকে কপি করে পূরণ করুন)
cp .env.example .dev.vars
# DATABASE_URL, JWT_SECRET ভরুন

# লোকাল সার্ভার চালু
npm run dev
# http://localhost:8788
```

---

## 🔐 সিকিউরিটি নোট

- পাসওয়ার্ড PBKDF2 (SHA-256, ১০০০০০ iterations) দিয়ে হ্যাশ করা হয়
- JWT HS256 দিয়ে সাইন করা, httpOnly cookie তে সংরক্ষিত
- Admin ছাড়া ইউজার ম্যানেজমেন্ট দেখা যায় না
- প্রতিটি API রিকোয়েস্ট অথেনটিকেশন চেক করে
- CORS সব রিকোয়েস্টের জন্য কনফিগার্ড

**প্রোডাকশনে যাওয়ার আগে:**
- `JWT_SECRET` অবশ্যই একটা শক্তিশালী র্যান্ডম স্ট্রিং দিন
- Default `admin/admin123` পাসওয়ার্ড বদলান

---

## 🆘 সমস্যা ও সমাধান

**"DATABASE_URL is not set"**
→ Cloudflare Pages → Settings → Environment variables এ `DATABASE_URL` যোগ করুন।

**"অনুগ্রহ করে লগইন করুন" এরর**
→ Cookie ব্লক হচ্ছে। HTTPS নিশ্চিত করুন (Cloudflare Pages অটো HTTPS দেয়)।

**"বারকোড লাইব্রেরি লোড হয়নি"**
→ ইন্টারনেট কানেকশন চেক করুন (JsBarcode CDN থেকে লোড হয়)।

**ক্যামেরা স্ক্যান কাজ করছে না**
→ ব্রাউজার HTTPS এ থাকতে হবে + ক্যামেরা পারমিশন দিতে হবে। Chrome/Edge দিয়ে চেষ্টা করুন।

---

## 📞 সাপোর্ট

কোনো সমস্যা হলে GitHub issue খুলুন বা ডেভেলপারকে কনট্যাক্ট করুন।

**লাইসেন্স:** প্রাইভেট — ক্লায়েন্টের জন্য তৈরি।
