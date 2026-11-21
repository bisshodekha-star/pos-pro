#!/bin/bash
# ============================================================
#  POS Pro — GitHub Push Script for Termux
#  এই স্ক্রিপ্টটি চালানোর জন্য:
#    bash push-to-github.sh
#
#  স্ক্রিপ্টটি:
#  1. রিপোজিটরির নাম জিজ্ঞেস করবে
#  2. Git ইনিশিয়ালাইজ করবে
#  3. GitHub CLI (gh) থাকলে অটো রিপো তৈরি করবে
#  4. না থাকলে ম্যানুয়াল গাইড দেখাবে
#  5. কোড পুশ করবে
# ============================================================

set -e

# কালার
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  POS Pro — GitHub Push Script${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# চেক: git আছে কি?
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ git ইনস্টল নেই!${NC}"
    echo -e "${YELLOW}ইনস্টল করুন:${NC}"
    echo "  pkg install git"
    exit 1
fi

# স্ক্রিপ্ট যে ডিরেক্টরিতে আছে সেখানে যান
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
echo -e "${GREEN}📁 ডিরেক্টরি: $SCRIPT_DIR${NC}"
echo ""

# রিপোজিটরির নাম জিজ্ঞেস করুন
read -p "📝 GitHub রিপোজিটরির নাম দিন (ডিফল্ট: pos-pro): " REPO_NAME
REPO_NAME="${REPO_NAME:-pos-pro}"
echo ""

# পাবলিক/প্রাইভেট জিজ্ঞেস করুন
read -p "🔒 রিপো পাবলিক নাকি প্রাইভেট? (public/private, ডিফল্ট: public): " VISIBILITY
VISIBILITY="${VISIBILITY:-public}"
echo ""

# Git ইনিশিয়ালাইজ
echo -e "${YELLOW}📦 Git ইনিশিয়ালাইজ করা হচ্ছে...${NC}"
if [ ! -d ".git" ]; then
    git init
    git branch -M main
    echo -e "${GREEN}✓ Git ইনিশিয়ালাইজ হয়েছে${NC}"
else
    echo -e "${GREEN}✓ Git ইতিমধ্যে ইনিশিয়ালাইজড${NC}"
fi

# .gitignore চেক
if [ ! -f ".gitignore" ]; then
    echo "node_modules/" > .gitignore
    echo ".wrangler/" >> .gitignore
    echo ".dev.vars" >> .gitignore
    echo ".env" >> .gitignore
    echo "*.log" >> .gitignore
    echo -e "${GREEN}✓ .gitignore তৈরি হয়েছে${NC}"
fi

# ফাইল অ্যাড
echo -e "${YELLOW}📝 ফাইল অ্যাড করা হচ্ছে...${NC}"
git add -A
git status -s

# কমিট
echo -e "${YELLOW}💾 কমিট করা হচ্ছে...${NC}"
git commit -m "Initial commit: POS Pro — Clothing Showroom POS (Cloudflare + Neon)" 2>/dev/null || {
    # যদি git config না থাকে
    echo -e "${YELLOW}⚠️  Git user config করা হচ্ছে...${NC}"
    read -p "আপনার নাম দিন: " GIT_NAME
    read -p "আপনার ইমেইল দিন: " GIT_EMAIL
    git config user.name "$GIT_NAME"
    git config user.email "$GIT_EMAIL"
    git commit -m "Initial commit: POS Pro — Clothing Showroom POS (Cloudflare + Neon)"
}
echo -e "${GREEN}✓ কমিট হয়েছে${NC}"
echo ""

# GitHub CLI চেক
if command -v gh &> /dev/null && gh auth status &> /dev/null 2>&1; then
    echo -e "${GREEN}🤖 GitHub CLI পাওয়া গেছে এবং অথেনটিকেটেড${NC}"
    echo -e "${YELLOW}🚀 রিপোজিটরি তৈরি করা হচ্ছে...${NC}"

    if [ "$VISIBILITY" = "private" ]; then
        gh repo create "$REPO_NAME" --private --source=. --remote=origin --push
    else
        gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
    fi

    echo ""
    echo -e "${GREEN}🎉 সফল! রিপো তৈরি ও পুশ হয়েছে${NC}"
    echo -e "${CYAN}🔗 https://github.com/$(gh api user --jq .login)/$REPO_NAME${NC}"
    echo ""
    echo -e "${YELLOW}এখন Cloudflare Pages এ যান:${NC}"
    echo -e "  ${CYAN}https://dash.cloudflare.com${NC}"
    echo -e "  → Workers & Pages → Create → Pages → Connect to Git"
    echo -e "  → এই রিপো সিলেক্ট করুন"
    echo -e "  → Build output: public"
    echo -e "  → Env vars: DATABASE_URL, JWT_SECRET, JWT_ISSUER"
    echo ""
    exit 0
fi

# gh CLI নেই — ম্যানুয়াল পথ
echo -e "${YELLOW}⚠️  GitHub CLI নেই বা অথেনটিকেটেড নয়${NC}"
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  ম্যানুয়াল GitHub পুশ গাইড${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}ধাপ ১: GitHub এ রিপো তৈরি করুন${NC}"
echo -e "  1. ${CYAN}https://github.com/new${NC} খুলুন"
echo -e "  2. Repository name: ${GREEN}$REPO_NAME${NC}"
echo -e "  3. ${VISIBILITY} সিলেক্ট করুন"
echo -e "  4. ${RED}DO NOT${NC} add README/license (আমরা যোগ করেছি)"
echo -e "  5. Create repository"
echo ""
echo -e "${YELLOW}ধাপ ২: আপনার GitHub ইউজারনেম দিন${NC}"
read -p "GitHub ইউজারনেম: " GH_USER
echo ""
echo -e "${YELLOW}ধাপ ৩: remote যোগ ও পুশ${NC}"
echo -e "  নিচের কমান্ডগুলো একটা একটা করে রান করুন:"
echo ""
echo -e "  ${CYAN}git remote add origin https://github.com/$GH_USER/$REPO_NAME.git${NC}"
echo -e "  ${CYAN}git push -u origin main${NC}"
echo ""
echo -e "${YELLOW}প্রথমবার পুশ করার সময়:${NC}"
echo -e "  GitHub ইউজারনেম ও Personal Access Token (PAT) চাইবে"
echo -e "  PAT তৈরি করুন: ${CYAN}https://github.com/settings/tokens/new${NC}"
echo -e "  Scope: ${GREEN}repo${NC} সিলেক্ট করুন"
echo ""
echo -e "${YELLOW}অথবা gh CLI ইনস্টল করে নিন:${NC}"
echo -e "  ${CYAN}pkg install gh${NC}  (Termux এ)"
echo -e "  ${CYAN}gh auth login${NC}"
echo -e "  তারপর আবার এই স্ক্রিপ্ট চালান"
echo ""

# অটো remote যোগ চেষ্টা
read -p "আপনি ইতিমধ্যে GitHub এ রিপো তৈরি করেছেন? (y/n): " REPO_EXISTS
if [ "$REPO_EXISTS" = "y" ] || [ "$REPO_EXISTS" = "Y" ]; then
    if [ -z "$GH_USER" ]; then
        read -p "GitHub ইউজারনেম: " GH_USER
    fi
    REMOTE_URL="https://github.com/$GH_USER/$REPO_NAME.git"

    echo -e "${YELLOW}🔗 Remote যোগ করা হচ্ছে...${NC}"
    git remote remove origin 2>/dev/null || true
    git remote add origin "$REMOTE_URL"

    echo -e "${YELLOW}🚀 পুশ করা হচ্ছে...${NC}"
    if git push -u origin main; then
        echo ""
        echo -e "${GREEN}🎉 সফল! কোড পুশ হয়েছে${NC}"
        echo -e "${CYAN}🔗 $REMOTE_URL${NC}"
        echo ""
        echo -e "${YELLOW}এখন Cloudflare Pages এ যান:${NC}"
        echo -e "  ${CYAN}https://dash.cloudflare.com${NC}"
        echo -e "  → Workers & Pages → Create → Pages → Connect to Git"
        echo -e "  → এই রিপো সিলেক্ট করুন"
        echo -e "  → Build output: public"
        echo -e "  → Env vars: DATABASE_URL, JWT_SECRET, JWT_ISSUER"
    else
        echo ""
        echo -e "${RED}❌ পুশ ব্যর্থ${NC}"
        echo -e "${YELLOW}উপরের গাইড দেখে ম্যানুয়ালি চেষ্টা করুন${NC}"
    fi
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  ধন্যবাদ! POS Pro${NC}"
echo -e "${CYAN}========================================${NC}"
